"""
LLM-based RAG query service.
Uses the OpenAI client (or any OpenAI-compatible endpoint) if an API key is set.
Falls back to a retrieval-only mode when no LLM key is available.
"""
from __future__ import annotations

import time
from typing import Optional

from config import DEFAULT_LLM, DEFAULT_TEMPERATURE, OPENAI_API_KEY, OPENAI_BASE_URL
from document_processor import search_chunks

# ── RAG prompt template ───────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are a precise, evidence-based assistant.
Answer ONLY based on the retrieved context provided below.
If the context does not contain enough information to answer the question,
say "I could not find sufficient information in the uploaded documents to answer this question."
Do not fabricate facts. Cite chunk sources by document name when relevant."""

QUERY_TEMPLATE = """\
Context chunks retrieved from the knowledge base:
{context}

Question: {question}

Answer (ground your response strictly in the context above):"""


def _build_context(chunks: list[dict]) -> str:
    parts = []
    for i, chunk in enumerate(chunks):
        parts.append(
            f"[Chunk {i + 1} | {chunk['document_name']} p.{chunk['page']} | sim={chunk['similarity']:.2f}]\n"
            f"{chunk['text']}"
        )
    return "\n\n---\n\n".join(parts)


def _format_chunk_for_api(chunk: dict, index: int) -> dict:
    return {
        "id": f"chunk-{index}",
        "documentName": chunk["document_name"],
        "page": chunk["page"],
        "chunkId": chunk["chunk_id"],
        "similarity": round(chunk["similarity"], 4),
        "text": chunk["text"],
    }


# ── Main query function ───────────────────────────────────────────────────────

def rag_query(
    question: str,
    top_k: int = 5,
    llm: str = DEFAULT_LLM,
    temperature: float = DEFAULT_TEMPERATURE,
    configuration_id: str = "cfg-default",
) -> dict:
    """
    Run a full RAG query. Returns the API-shaped response dict.
    """
    t0 = time.time()

    # Step 1: Retrieve relevant chunks
    raw_chunks = search_chunks(question, top_k=top_k)

    if not raw_chunks:
        latency_ms = int((time.time() - t0) * 1000)
        return {
            "id": f"ans-{int(t0)}",
            "question": question,
            "answer": (
                "No documents have been indexed yet. "
                "Please upload and process documents before asking questions."
            ),
            "chunks": [],
            "confidence": 0.0,
            "faithfulness": 0.0,
            "latencyMs": latency_ms,
            "tokens": {"prompt": 0, "completion": 0},
            "costUsd": 0.0,
            "configurationId": configuration_id,
        }

    # Step 2: Build context
    context = _build_context(raw_chunks)
    formatted_chunks = [_format_chunk_for_api(c, i) for i, c in enumerate(raw_chunks)]

    # Step 3: Call LLM (if API key available)
    answer_text = ""
    prompt_tokens = 0
    completion_tokens = 0
    cost_usd = 0.0

    if OPENAI_API_KEY:
        try:
            from openai import OpenAI

            client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)
            user_message = QUERY_TEMPLATE.format(context=context, question=question)
            response = client.chat.completions.create(
                model=llm,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_message},
                ],
                temperature=temperature,
                max_tokens=512,
            )
            answer_text = response.choices[0].message.content or ""
            if response.usage:
                prompt_tokens = response.usage.prompt_tokens
                completion_tokens = response.usage.completion_tokens
                # Rough cost estimate for gpt-4o-mini
                cost_usd = (prompt_tokens * 0.00000015) + (completion_tokens * 0.0000006)
        except Exception as exc:
            answer_text = (
                f"[LLM error: {exc}]\n\n"
                "Returning the top retrieved chunk as a fallback answer:\n\n"
                + raw_chunks[0]["text"]
            )
    else:
        # No API key — return a synthesised answer from context only
        top_texts = [c["text"] for c in raw_chunks[:2]]
        answer_text = (
            "⚠️ No LLM API key configured (set OPENAI_API_KEY in .env). "
            "Showing the most relevant retrieved passages:\n\n"
            + "\n\n".join(top_texts)
        )

    latency_ms = int((time.time() - t0) * 1000)

    # Approximate confidence from top similarity score
    top_sim = raw_chunks[0]["similarity"] if raw_chunks else 0.0
    confidence = round(float(top_sim), 4)
    faithfulness = round(float(sum(c["similarity"] for c in raw_chunks) / len(raw_chunks)), 4)

    return {
        "id": f"ans-{int(t0)}",
        "question": question,
        "answer": answer_text,
        "chunks": formatted_chunks,
        "confidence": confidence,
        "faithfulness": faithfulness,
        "latencyMs": latency_ms,
        "tokens": {"prompt": prompt_tokens, "completion": completion_tokens},
        "costUsd": round(cost_usd, 6),
        "configurationId": configuration_id,
    }
