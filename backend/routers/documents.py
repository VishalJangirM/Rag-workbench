"""Router: /api/documents — list, upload, delete, reindex."""
from __future__ import annotations

import os
import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

import document_processor as dp
from config import ALLOWED_EXTENSIONS, MAX_UPLOAD_BYTES, UPLOAD_DIR
from database import ChunkRow, DocumentRow, get_db

router = APIRouter(prefix="/api/documents", tags=["documents"])


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _ext(filename: str) -> str:
    return Path(filename).suffix.lstrip(".").lower()


# ── Background indexing ────────────────────────────────────────────────────────

def _index_document(doc_id: str, file_path: Path, file_name: str, file_type: str, db_url: str) -> None:
    """Run in background: extract → chunk → embed → index, then update DB."""
    # Create a new DB session inside the background thread
    from sqlalchemy import create_engine
    from sqlalchemy.orm import sessionmaker

    eng = create_engine(db_url, connect_args={"check_same_thread": False})
    Sess = sessionmaker(bind=eng)
    db = Sess()

    try:
        doc = db.query(DocumentRow).filter(DocumentRow.id == doc_id).first()
        if not doc:
            return

        doc.status = "processing"
        db.commit()

        result = dp.process_document(
            document_id=doc_id,
            file_path=file_path,
            file_name=file_name,
            file_type=file_type,
        )

        doc.status = "indexed"
        doc.pages = result["pages"]
        doc.chunks = result["chunks"]
        doc.processing_time_ms = result["processing_time_ms"]
        doc.indexed_at = _now_iso()
        doc.updated_at = _now_iso()
        db.commit()

        # Persist chunk metadata to DB for reference
        for meta in result["chunk_metas"]:
            row = ChunkRow(
                id=str(uuid.uuid4()),
                document_id=doc_id,
                document_name=file_name,
                chunk_index=meta["faiss_idx"],
                text=meta["text"],
                page=meta["page"],
                faiss_index=meta["faiss_idx"],
            )
            db.add(row)
        db.commit()

    except Exception as exc:
        doc = db.query(DocumentRow).filter(DocumentRow.id == doc_id).first()
        if doc:
            doc.status = "failed"
            doc.error_message = str(exc)
            doc.updated_at = _now_iso()
            db.commit()
    finally:
        db.close()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("")
def list_documents(db: Session = Depends(get_db)):
    docs = db.query(DocumentRow).order_by(DocumentRow.updated_at.desc()).all()
    return [d.to_api() for d in docs]


@router.post("/upload")
async def upload_documents(
    background_tasks: BackgroundTasks,
    files: list[UploadFile] = File(default=[]),
    file: UploadFile | None = File(default=None),
    db: Session = Depends(get_db),
):
    """Accept one or more files via multipart/form-data and queue them for processing."""
    upload_list = list(files)
    if file and file not in upload_list:
        upload_list.append(file)
    if not upload_list:
        raise HTTPException(status_code=422, detail="No files received.")

    created = []
    from config import DB_PATH
    db_url = f"sqlite:///{DB_PATH}"

    for upload in upload_list:
        filename = upload.filename or "unknown"
        ext = _ext(filename)

        # Validate extension
        if ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=422,
                detail=f"'{filename}': unsupported file type '{ext}'. Allowed: {sorted(ALLOWED_EXTENSIONS)}",
            )

        # Read into memory to check size
        content = await upload.read()
        if not content:
            raise HTTPException(status_code=422, detail=f"'{filename}' is empty.")
        if len(content) > MAX_UPLOAD_BYTES:
            mb = MAX_UPLOAD_BYTES // (1024 * 1024)
            raise HTTPException(
                status_code=413, detail=f"'{filename}' exceeds the {mb} MB limit."
            )

        # Persist file to disk
        doc_id = str(uuid.uuid4())
        dest_path = UPLOAD_DIR / f"{doc_id}_{filename}"
        dest_path.write_bytes(content)

        # Insert DB record
        doc = DocumentRow(
            id=doc_id,
            name=filename,
            type=ext,
            size_bytes=len(content),
            status="processing",
            embedding_model=dp.EMBEDDING_MODEL,
            updated_at=_now_iso(),
            file_path=str(dest_path),
        )
        db.add(doc)
        db.commit()
        db.refresh(doc)
        created.append(doc.to_api())

        # Queue background indexing
        background_tasks.add_task(
            _index_document, doc_id, dest_path, filename, ext, db_url
        )

    return created


@router.post("/{doc_id}/reindex")
def reindex_document(
    doc_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    doc = db.query(DocumentRow).filter(DocumentRow.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")
    if not doc.file_path or not Path(doc.file_path).exists():
        raise HTTPException(status_code=409, detail="Original file no longer on disk.")

    # Remove old chunks from index
    dp.remove_document_from_index(doc_id)
    db.query(ChunkRow).filter(ChunkRow.document_id == doc_id).delete()

    doc.status = "processing"
    doc.updated_at = _now_iso()
    db.commit()

    from config import DB_PATH
    db_url = f"sqlite:///{DB_PATH}"
    background_tasks.add_task(
        _index_document, doc_id, Path(doc.file_path), doc.name, doc.type, db_url
    )
    return {"ok": True}


@router.delete("/{doc_id}")
def delete_document(doc_id: str, db: Session = Depends(get_db)):
    doc = db.query(DocumentRow).filter(DocumentRow.id == doc_id).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found.")

    # Remove from vector index
    dp.remove_document_from_index(doc_id)

    # Remove from DB
    db.query(ChunkRow).filter(ChunkRow.document_id == doc_id).delete()
    db.delete(doc)
    db.commit()

    # Remove file from disk
    if doc.file_path:
        try:
            Path(doc.file_path).unlink(missing_ok=True)
        except OSError:
            pass

    return {"ok": True}
