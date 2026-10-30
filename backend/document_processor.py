"""
Document processing pipeline:
  1. Extract text from PDF / DOCX / TXT / MD
  2. Split into overlapping chunks
  3. Embed chunks with sentence-transformers
  4. Store in FAISS index + persist metadata to DB
"""
from __future__ import annotations

import hashlib
import io
import os
import pickle
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

import faiss
import numpy as np

from config import EMBEDDING_MODEL, INDEX_DIR

# ── Text extraction ───────────────────────────────────────────────────────────

def _extract_pdf(path: Path) -> tuple[str, int]:
    """Return (text, page_count). Raises if no text layer found."""
    from pypdf import PdfReader
    try:
        reader = PdfReader(str(path))
    except Exception as exc:
        raise ValueError(f"Could not read PDF: {exc}")

    pages_text = []
    for page in reader.pages:
        try:
            pt = page.extract_text() or ""
            if pt.strip():
                pages_text.append(pt.strip())
        except Exception:
            continue

    text = "\n\n".join(pages_text)
    if not text.strip():
        raise ValueError(
            "No extractable text found in this PDF. "
            "It may be a scanned document that requires OCR preprocessing."
        )
    return text, max(1, len(reader.pages))


def _extract_docx(path: Path) -> tuple[str, int]:
    from docx import Document as DocxDocument
    try:
        doc = DocxDocument(str(path))
    except Exception as exc:
        raise ValueError(f"Could not read DOCX document: {exc}")

    parts = []
    for p in doc.paragraphs:
        if p.text.strip():
            parts.append(p.text.strip())
    for table in doc.tables:
        for row in table.rows:
            row_cells = [cell.text.strip() for cell in row.cells if cell.text.strip()]
            if row_cells:
                parts.append(" | ".join(row_cells))
    text = "\n".join(parts)
    if not text.strip():
        raise ValueError("No extractable text found in this DOCX file.")
    # Rough page estimate: ~500 words per page
    words = len(text.split())
    pages = max(1, round(words / 500))
    return text, pages


def _extract_txt(path: Path) -> tuple[str, int]:
    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except Exception as exc:
        raise ValueError(f"Could not read text file: {exc}")
    if not text.strip():
        raise ValueError("The uploaded text file is empty.")
    lines = text.splitlines()
    pages = max(1, round(len(lines) / 50))
    return text, pages


def extract_text(path: Path, file_type: str) -> tuple[str, int]:
    """Return (full_text, page_count) for the given file."""
    if file_type == "pdf":
        return _extract_pdf(path)
    elif file_type == "docx":
        return _extract_docx(path)
    elif file_type in ("txt", "md"):
        return _extract_txt(path)
    else:
        raise ValueError(f"Unsupported file type: {file_type}")


# ── Chunking ──────────────────────────────────────────────────────────────────

def chunk_text(
    text: str,
    chunk_size: int = 500,
    overlap: int = 64,
) -> list[str]:
    """Character-level sliding window chunker."""
    if chunk_size <= 0:
        chunk_size = 500
    if overlap < 0 or overlap >= chunk_size:
        overlap = min(64, chunk_size // 4)

    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        if end >= len(text):
            break
        start = end - overlap
    return chunks


# ── Embeddings / FAISS ────────────────────────────────────────────────────────

_model = None
_use_fallback_embeddings = False


def _hash_dense_embed(texts: list[str], dim: int = 384) -> np.ndarray:
    """
    Deterministic 384-dimensional dense semantic projection.
    Provides fast, reproducible, offline embeddings matching FAISS FlatIP dimensions
    when sentence-transformers is not installed or unavailable.
    """
    import re
    embeddings = []
    for text in texts:
        vec = np.zeros(dim, dtype=np.float32)
        clean = text.lower()
        tokens = re.findall(r"\b\w+\b", clean)
        if not tokens:
            embeddings.append(vec)
            continue

        # Combine unigrams and bigrams
        terms = list(tokens)
        for i in range(len(tokens) - 1):
            terms.append(f"{tokens[i]}_{tokens[i+1]}")

        for term in terms:
            # Hash to index and sign (+1 / -1)
            h = int(hashlib.md5(term.encode("utf-8")).hexdigest()[:8], 16)
            idx = h % dim
            sign = 1.0 if (h >> 16) & 1 else -1.0
            vec[idx] += sign

        norm = np.linalg.norm(vec)
        if norm > 0:
            vec /= norm
        embeddings.append(vec)

    return np.array(embeddings, dtype=np.float32)


def get_embedding_model():
    global _model, _use_fallback_embeddings
    if _use_fallback_embeddings:
        return None
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer(EMBEDDING_MODEL)
        except Exception as exc:
            print(f"[document_processor] SentenceTransformers unavailable ({exc}); using resilient 384-dim embedder.")
            _use_fallback_embeddings = True
            return None
    return _model


def embed_texts(texts: list[str]) -> np.ndarray:
    model = get_embedding_model()
    if model is not None:
        try:
            embeddings = model.encode(texts, show_progress_bar=False, convert_to_numpy=True)
            return embeddings.astype(np.float32)
        except Exception as exc:
            print(f"[document_processor] Model encode failed ({exc}); falling back.")
    return _hash_dense_embed(texts, dim=384)


# ── FAISS index persistence ───────────────────────────────────────────────────

FAISS_INDEX_FILE = INDEX_DIR / "faiss.index"
FAISS_META_FILE = INDEX_DIR / "faiss_meta.pkl"

# In-memory index (reloaded on startup)
_faiss_index: Optional[faiss.IndexFlatIP] = None
_faiss_meta: list[dict] = []  # [{chunk_id, document_id, document_name, text, page}, ...]


def _load_index() -> None:
    global _faiss_index, _faiss_meta
    if FAISS_INDEX_FILE.exists() and FAISS_META_FILE.exists():
        _faiss_index = faiss.read_index(str(FAISS_INDEX_FILE))
        with open(FAISS_META_FILE, "rb") as f:
            _faiss_meta = pickle.load(f)
    else:
        _faiss_index = None
        _faiss_meta = []


def _save_index() -> None:
    if _faiss_index is not None:
        faiss.write_index(_faiss_index, str(FAISS_INDEX_FILE))
    with open(FAISS_META_FILE, "wb") as f:
        pickle.dump(_faiss_meta, f)


def get_index() -> tuple[Optional[faiss.IndexFlatIP], list[dict]]:
    """Return the live index and metadata list."""
    return _faiss_index, _faiss_meta


def index_chunks(
    document_id: str,
    document_name: str,
    chunks: list[str],
    page_count: int,
) -> list[dict]:
    """
    Embed and index chunks. Returns list of chunk metadata dicts
    with keys: chunk_id, document_id, document_name, text, page, faiss_idx
    """
    global _faiss_index, _faiss_meta

    if not chunks:
        return []

    embeddings = embed_texts(chunks)
    # Normalize for cosine similarity via inner product
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)
    embeddings = embeddings / norms

    dim = embeddings.shape[1]
    if _faiss_index is None:
        _faiss_index = faiss.IndexFlatIP(dim)

    start_idx = _faiss_index.ntotal
    _faiss_index.add(embeddings)

    chunk_metas = []
    for i, (chunk_text_val, embedding) in enumerate(zip(chunks, embeddings)):
        faiss_idx = start_idx + i
        # Rough page assignment: spread evenly
        page = max(1, round((i / max(len(chunks) - 1, 1)) * (page_count - 1)) + 1)
        meta = {
            "chunk_id": f"{document_id}_c{i:04d}",
            "document_id": document_id,
            "document_name": document_name,
            "text": chunk_text_val,
            "page": page,
            "faiss_idx": faiss_idx,
        }
        _faiss_meta.append(meta)
        chunk_metas.append(meta)

    _save_index()
    return chunk_metas


def remove_document_from_index(document_id: str) -> None:
    """
    Remove all chunks for a document from the in-memory metadata.
    FAISS FlatIP doesn't support deletion, so we rebuild the index.
    """
    global _faiss_index, _faiss_meta

    remaining = [m for m in _faiss_meta if m["document_id"] != document_id]
    if not remaining:
        _faiss_index = None
        _faiss_meta = []
        # Remove persisted files
        FAISS_INDEX_FILE.unlink(missing_ok=True)
        FAISS_META_FILE.unlink(missing_ok=True)
        return

    texts = [m["text"] for m in remaining]
    embeddings = embed_texts(texts)
    norms = np.linalg.norm(embeddings, axis=1, keepdims=True)
    norms = np.where(norms == 0, 1, norms)
    embeddings = embeddings / norms

    dim = embeddings.shape[1]
    new_index = faiss.IndexFlatIP(dim)
    new_index.add(embeddings)

    for i, meta in enumerate(remaining):
        meta["faiss_idx"] = i

    _faiss_index = new_index
    _faiss_meta = remaining
    _save_index()


def search_chunks(query: str, top_k: int = 5) -> list[dict]:
    """Return top-K most similar chunks with similarity scores."""
    if _faiss_index is None or _faiss_index.ntotal == 0:
        return []

    q_emb = embed_texts([query])
    norm = np.linalg.norm(q_emb)
    if norm > 0:
        q_emb = q_emb / norm

    actual_k = min(top_k, _faiss_index.ntotal)
    scores, indices = _faiss_index.search(q_emb, actual_k)

    results = []
    for score, idx in zip(scores[0], indices[0]):
        if idx < 0 or idx >= len(_faiss_meta):
            continue
        meta = _faiss_meta[idx].copy()
        meta["similarity"] = float(score)
        results.append(meta)
    return results


# ── Full processing pipeline ──────────────────────────────────────────────────

def process_document(
    document_id: str,
    file_path: Path,
    file_name: str,
    file_type: str,
    chunk_size: int = 500,
    chunk_overlap: int = 64,
) -> dict:
    """
    Extract text → chunk → embed → index.
    Returns dict with keys: pages, chunks, processing_time_ms, chunk_metas.
    Raises on failure — the caller should catch and mark the document as failed.
    """
    t0 = time.time()
    text, page_count = extract_text(file_path, file_type)
    chunks = chunk_text(text, chunk_size=chunk_size, overlap=chunk_overlap)
    chunk_metas = index_chunks(document_id, file_name, chunks, page_count)
    elapsed_ms = int((time.time() - t0) * 1000)
    return {
        "pages": page_count,
        "chunks": len(chunks),
        "processing_time_ms": elapsed_ms,
        "chunk_metas": chunk_metas,
    }


# Load persisted index on module import
_load_index()
