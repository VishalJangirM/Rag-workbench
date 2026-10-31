"""
LLM-based RAG query service.

- If OPENAI_BASE_URL points at Google (generativelanguage.googleapis.com), the Gemini
  native generateContent API is used (key sent in the x-goog-api-key header).
- Otherwise any OpenAI-compatible endpoint is used through the openai client.
- With no key, a retrieval-only answer is returned.
"""
from __future__ import annotations

import json
import time
import urllib.error
import urllib.request

from config import DEFAULT_LLM, DEFAULT_TEMPERATURE, OPENAI_API_KEY, OPENAI_BASE_URL
from document_processor import search_chunks

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

GEMINI_NATIVE_URL = "https://generativelanguage.googleapis.com/v1beta/models"


def _is_google() -> bool:
    return "generativelanguage.googleapis.com" in (OPENAI_BASE_URL or "")


def _resolve_model(llm: str) -> str:
    """Saved configurations may still hold a gpt-* name; use DEFAULT_LLM for Google then."""
    name = (llm or "").strip()
    if name.startswith("models/"):
        name = name[len("models/"):]
    if _is_google() and not name.lower().startswith(("gemini", "gemma")):
        return DEFAULT_LLM
    return name or DEFAULT_LLM


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


def _call_gemini(model: str, user_message: str, temperature: float) -> tuple[str, int, int]:
    """Gemini native API. Returns (answer, prompt_tokens, completion_tokens)."""
    url = f"{GEMINI_NATIVE_URL}/{model}:generateContent"
    payload = {
        "systemInstruction": {"parts": [{"text": SYSTEM_PROMPT}]},
        "contents": [{"role": "user", "parts": [{"text": user_message}]}],
        "generationConfig": {
            "temperature": temperature,
            # Thinking models spend part of this budget on reasoning, so keep it generous.
            "maxOutputTokens": 4096,
        },
    }
    request = urllib.request.Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": OPENAI_API_KEY},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            data = json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as err:
        body = err.read().decode("utf-8", errors="replace")
        try:
            message = json.loads(body).get("error", {}).get("message", body)
        except ValueError:
            message = body
        raise RuntimeError(f"Gemini API {err.code} ({model}): {message[:400]}") from None
    except urllib.error.URLError as err:
        raise RuntimeError(f"Could not reach the Gemini API: {err.reason}") from None

    candidates = data.get("candidates") or []
    if not candidates:
        feedback = data.get("promptFeedback", {})
        raise RuntimeError(f"Gemini returned no answer. {feedback or ''}".strip())

    parts = (candidates[0].get("content") or {}).get("parts") or []
    text = "".join(p.get("text", "") for p in parts if not p.get("thought")).strip()
    if not text:
        reason = candidates[0].get("finishReason", "unknown")
        raise RuntimeError(f"Gemini returned an empty answer (finishReason={reason}).")

    usage = data.get("usageMetadata", {})
    prompt_tokens = int(usage.get("promptTokenCount", 0))
    completion_tokens = int(usage.get("candidatesTokenCount", 0)) + int(
        usage.get("thoughtsTokenCount", 0)
    )
    return text, prompt_tokens, completion_tokens


def _call_openai_compatible(
    model: str, user_message: str, temperature: float
) -> tuple[str, int, int]:
    from openai import OpenAI

    client = OpenAI(api_key=OPENAI_API_KEY, base_url=OPENAI_BASE_URL)
    response = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_message},
        ],
        temperature=temperature,
        max_tokens=512,
    )
    text = response.choices[0].message.content or ""
    prompt_tokens = response.usage.prompt_tokens if response.usage else 0
    completion_tokens = response.usage.completion_tokens if response.usage else 0
    return text, prompt_tokens, completion_tokens


# ── Main query function ───────────────────────────────────────────────────────

def rag_query(
    question: str,
    top_k: int = 5,
    llm: str = DEFAULT_LLM,
    temperature: float = DEFAULT_TEMPERATURE,
    configuration_id: str = "cfg-default",
) -> dict:
    """Run a full RAG query. Returns the API-shaped response dict."""
    t0 = time.time()

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

    context = _build_context(raw_chunks)
    formatted_chunks = [_format_chunk_for_api(c, i) for i, c in enumerate(raw_chunks)]

    answer_text = ""
    prompt_tokens = 0
    completion_tokens = 0
    cost_usd = 0.0

    if OPENAI_API_KEY:
        model = _resolve_model(llm)
        user_message = QUERY_TEMPLATE.format(context=context, question=question)
        try:
            if _is_google():
                answer_text, prompt_tokens, completion_tokens = _call_gemini(
                    model, user_message, temperature
                )
                # Rough estimate (Gemini Flash class pricing per token)
                cost_usd = prompt_tokens * 0.0000003 + completion_tokens * 0.0000025
            else:
                answer_text, prompt_tokens, completion_tokens = _call_openai_compatible(
                    model, user_message, temperature
                )
                cost_usd = prompt_tokens * 0.00000015 + completion_tokens * 0.0000006
        except Exception as exc:  # noqa: BLE001
            answer_text = (
                f"[LLM error: {exc}]\n\n"
                "Returning the top retrieved chunk as a fallback answer:\n\n"
                + raw_chunks[0]["text"]
            )
    else:
        top_texts = [c["text"] for c in raw_chunks[:2]]
        answer_text = (
            "⚠️ No LLM API key configured (set OPENAI_API_KEY in .env). "
            "Showing the most relevant retrieved passages:\n\n"
            + "\n\n".join(top_texts)
        )

    latency_ms = int((time.time() - t0) * 1000)

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