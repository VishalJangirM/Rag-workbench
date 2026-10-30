"""
RAGBench Evaluation Service.

- Built-in golden datasets plus user-created / imported datasets (stored in data/datasets.json)
- Real retrieval metrics (Recall@k, Precision@5, MRR, NDCG) based on whether the expected
  source document / answer content appears in the retrieved chunks
- Generation metrics (correctness, faithfulness, relevance) and performance metrics
- Deltas are computed against the previous completed run
"""
from __future__ import annotations

import csv
import io
import json
import math
import re
import time
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy.orm import Session

from config import DB_PATH
from database import EvaluationResultRow, EvaluationRunRow, RAGConfigRow
from rag_service import rag_query


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Built-in golden datasets ─────────────────────────────────────────────────

ENTERPRISE_QUESTIONS = [
    {
        "id": "q-001",
        "question": "What is the employee notice period?",
        "expectedAnswer": "Employees are required to provide 30 days written notice before resignation. For senior roles, a 60-day notice period applies.",
        "source": "test_policy.txt",
        "evidence": "Section: Notice Period — 30 days notice for regular staff, 60 days for senior roles.",
        "difficulty": "easy",
        "category": "HR Policy",
    },
    {
        "id": "q-002",
        "question": "What is the annual leave and carry-forward policy?",
        "expectedAnswer": "Annual leave entitlement is 20 days per year. Unused leave can be carried forward up to 10 days. Sick leave is separate and amounts to 10 days per year.",
        "source": "test_policy.txt",
        "evidence": "Section: Leave Policy — 20 days annual, 10 days carry-forward, 10 days sick leave.",
        "difficulty": "medium",
        "category": "HR Policy",
    },
    {
        "id": "q-003",
        "question": "What is the remote work policy?",
        "expectedAnswer": "Employees may work remotely up to 3 days per week with approval from the direct manager.",
        "source": "test_policy.txt",
        "evidence": "Section: Remote Work Policy — Up to 3 days per week remote, manager approval required.",
        "difficulty": "easy",
        "category": "HR Policy",
    },
    {
        "id": "q-004",
        "question": "What is the daily meal allowance and expense submission deadline?",
        "expectedAnswer": "Travel expenses must be submitted within 30 days of incurring them. Receipts and manager approval are required. Daily meal allowance is capped at 50 dollars.",
        "source": "test_policy.txt",
        "evidence": "Section: Expense Reimbursement — 30 days submission window, $50 daily meal allowance.",
        "difficulty": "medium",
        "category": "Finance",
    },
    {
        "id": "q-005",
        "question": "What encryption standard protects data at rest?",
        "expectedAnswer": "AES-256 encryption is applied to all customer data at rest. Keys are rotated every 90 days and stored in a managed HSM.",
        "source": "security_controls_soc2.docx",
        "evidence": "Security Controls — AES-256 for data at rest, 90 day key rotation in HSM.",
        "difficulty": "easy",
        "category": "Security",
    },
    {
        "id": "q-006",
        "question": "Which clause governs contract termination for convenience?",
        "expectedAnswer": "Clause 12.3 of the MSA governs termination for convenience upon ninety (90) days prior written notice.",
        "source": "legal_msa_2025.pdf",
        "evidence": "MSA Clause 12.3 — Termination for Convenience.",
        "difficulty": "hard",
        "category": "Legal",
    },
    {
        "id": "q-007",
        "question": "What is the health insurance waiting period for external contractor personnel?",
        "expectedAnswer": "Contractors are not eligible for employee health insurance; they receive contractor per-diem rates only.",
        "source": "hr_policy.pdf",
        "evidence": "Contractor Benefits Exclusions — No health insurance coverage.",
        "difficulty": "hard",
        "category": "HR Policy",
    },
]

SUPPORT_QUESTIONS = [
    {
        "id": "sq-001",
        "question": "How do users reset multi-factor authentication?",
        "expectedAnswer": "Users must contact IT security desk with employee verification ID to reset MFA hardware tokens.",
        "source": "security_guide.md",
        "evidence": "IT Support Section 4 — MFA Reset Procedure.",
        "difficulty": "medium",
        "category": "IT Support",
    },
    {
        "id": "sq-002",
        "question": "What is the vendor onboarding SLA?",
        "expectedAnswer": "Standard vendor onboarding SLA is 10 business days following compliance check sign-off.",
        "source": "procurement_policy.docx",
        "evidence": "Procurement SLA Guidelines.",
        "difficulty": "hard",
        "category": "Procurement",
    },
]


def _breakdown(questions: List[Dict[str, Any]]) -> Dict[str, int]:
    out = {"easy": 0, "medium": 0, "hard": 0}
    for q in questions:
        key = str(q.get("difficulty", "medium")).lower()
        out[key if key in out else "medium"] += 1
    return out


def _categories(questions: List[Dict[str, Any]]) -> List[str]:
    seen: List[str] = []
    for q in questions:
        cat = q.get("category") or "General"
        if cat not in seen:
            seen.append(cat)
    return seen


DATASETS: List[Dict[str, Any]] = [
    {
        "id": "ds-enterprise-qa-v2",
        "name": "Enterprise QA v2",
        "description": "Curated internal-knowledge questions spanning HR, legal, security and finance sources.",
        "totalQuestions": len(ENTERPRISE_QUESTIONS),
        "breakdown": _breakdown(ENTERPRISE_QUESTIONS),
        "categories": _categories(ENTERPRISE_QUESTIONS),
        "updatedAt": "2026-08-16T10:00:00Z",
        "questions": ENTERPRISE_QUESTIONS,
    },
    {
        "id": "ds-support-tickets",
        "name": "Support Tickets v1",
        "description": "Support workflow and compliance verification QA pairs.",
        "totalQuestions": len(SUPPORT_QUESTIONS),
        "breakdown": _breakdown(SUPPORT_QUESTIONS),
        "categories": _categories(SUPPORT_QUESTIONS),
        "updatedAt": "2026-08-09T08:20:00Z",
        "questions": SUPPORT_QUESTIONS,
    },
]


# ── Custom (user-created / imported) datasets ────────────────────────────────

CUSTOM_DATASETS_PATH = DB_PATH.parent / "datasets.json"


def _load_custom_datasets() -> List[Dict[str, Any]]:
    try:
        data = json.loads(CUSTOM_DATASETS_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (OSError, ValueError):
        return []


def _save_custom_datasets(items: List[Dict[str, Any]]) -> None:
    CUSTOM_DATASETS_PATH.parent.mkdir(parents=True, exist_ok=True)
    CUSTOM_DATASETS_PATH.write_text(json.dumps(items, indent=2), encoding="utf-8")


def get_all_datasets() -> List[Dict[str, Any]]:
    return DATASETS + _load_custom_datasets()


def get_dataset(dataset_id: str) -> Dict[str, Any]:
    return next((d for d in get_all_datasets() if d["id"] == dataset_id), DATASETS[0])


_ALIASES = {
    "question": "question",
    "q": "question",
    "prompt": "question",
    "expectedanswer": "expectedAnswer",
    "expected": "expectedAnswer",
    "answer": "expectedAnswer",
    "goldanswer": "expectedAnswer",
    "groundtruth": "expectedAnswer",
    "source": "source",
    "document": "source",
    "sourcedocument": "source",
    "file": "source",
    "evidence": "evidence",
    "difficulty": "difficulty",
    "category": "category",
}


def _canon_key(key: str) -> str:
    return re.sub(r"[^a-z]", "", key.lower())


def normalize_question(raw: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    mapped: Dict[str, str] = {}
    for key, value in raw.items():
        target = _ALIASES.get(_canon_key(str(key)))
        if target and value is not None:
            mapped[target] = str(value).strip()
    question = mapped.get("question", "")
    expected = mapped.get("expectedAnswer", "")
    if not question or not expected:
        return None
    difficulty = mapped.get("difficulty", "medium").lower()
    if difficulty not in ("easy", "medium", "hard"):
        difficulty = "medium"
    return {
        "id": f"cq-{uuid.uuid4().hex[:6]}",
        "question": question,
        "expectedAnswer": expected,
        "source": mapped.get("source", ""),
        "evidence": mapped.get("evidence", ""),
        "difficulty": difficulty,
        "category": mapped.get("category") or "General",
    }


def create_custom_dataset(name: str, description: str, raw_questions: List[Dict[str, Any]]) -> Dict[str, Any]:
    name = (name or "").strip()
    if not name:
        raise ValueError("Dataset name is required.")
    questions = [q for q in (normalize_question(r) for r in raw_questions if isinstance(r, dict)) if q]
    if not questions:
        raise ValueError("No valid questions found. Each row needs a question and an expected answer.")
    dataset = {
        "id": f"ds-{uuid.uuid4().hex[:8]}",
        "name": name,
        "description": (description or "").strip() or f"Custom dataset with {len(questions)} questions.",
        "totalQuestions": len(questions),
        "breakdown": _breakdown(questions),
        "categories": _categories(questions),
        "updatedAt": _now_iso(),
        "questions": questions,
    }
    items = _load_custom_datasets()
    items.append(dataset)
    _save_custom_datasets(items)
    return dataset


def parse_dataset_file(filename: str, content: bytes) -> List[Dict[str, Any]]:
    text = content.decode("utf-8-sig", errors="replace")
    lower = (filename or "").lower()
    rows: List[Any] = []
    if lower.endswith((".jsonl", ".ndjson")):
        for line in text.splitlines():
            line = line.strip()
            if not line:
                continue
            try:
                rows.append(json.loads(line))
            except ValueError as exc:
                raise ValueError(f"Invalid JSON line: {exc}") from exc
    elif lower.endswith(".json"):
        try:
            data = json.loads(text)
        except ValueError as exc:
            raise ValueError(f"Invalid JSON file: {exc}") from exc
        rows = data if isinstance(data, list) else data.get("questions", [])
    elif lower.endswith(".csv"):
        rows = list(csv.DictReader(io.StringIO(text)))
    else:
        raise ValueError("Unsupported file type. Upload a .csv or .jsonl file.")
    return [r for r in rows if isinstance(r, dict)]


# ── Metric utilities ─────────────────────────────────────────────────────────

STOPWORDS = {
    "is", "the", "a", "an", "what", "of", "in", "for", "to", "and", "are",
    "this", "that", "with", "on", "as", "at", "by", "from", "it", "be", "or",
}

_PRICE_PER_1K = {
    "gpt-4o-mini": 0.00015,
    "gpt-4o": 0.0025,
    "llama-3.1-70b": 0.0009,
    "llama-3.1-70b-instruct": 0.0009,
    "claude-3.5-haiku": 0.0008,
}


def _tokenize(text: str) -> List[str]:
    return [w for w in re.findall(r"\b[a-zA-Z0-9_\-]+\b", text.lower()) if w not in STOPWORDS]


def _compute_token_f1(pred: str, target: str) -> float:
    p_tokens = _tokenize(pred)
    t_tokens = _tokenize(target)
    if not p_tokens or not t_tokens:
        return 0.0
    common = set(p_tokens) & set(t_tokens)
    if not common:
        return 0.0
    precision = len(common) / len(p_tokens)
    recall = len(common) / len(t_tokens)
    return 2.0 * (precision * recall) / (precision + recall)


def _compute_faithfulness(answer: str, context: str) -> float:
    a_tokens = _tokenize(answer)
    if not a_tokens:
        return 0.0
    c_tokens = set(_tokenize(context))
    supported = sum(1 for t in a_tokens if t in c_tokens)
    return min(1.0, supported / len(a_tokens))


def _compute_overlap(question: str, text: str) -> float:
    q_tokens = set(_tokenize(question))
    if not q_tokens:
        return 0.0
    t_tokens = set(_tokenize(text))
    return len(q_tokens & t_tokens) / len(q_tokens)


def _source_match(chunk: Dict[str, Any], source: str) -> bool:
    name = str(chunk.get("documentName", "") or "").lower()
    return bool(source) and source.lower() in name


def _is_relevant(chunk: Dict[str, Any], source: str, expected: str) -> bool:
    if _source_match(chunk, source):
        return True
    exp_tokens = set(_tokenize(expected))
    if not exp_tokens:
        return False
    chunk_tokens = set(_tokenize(str(chunk.get("text", ""))))
    return len(exp_tokens & chunk_tokens) / len(exp_tokens) >= 0.6


def metrics_by_key(run: Any) -> Dict[str, float]:
    """Flatten a run's three metric lists into {key: value}."""
    out: Dict[str, float] = {}
    for blob in (run.retrieval_json, run.generation_json, run.performance_json):
        try:
            for m in json.loads(blob or "[]"):
                out[m["key"]] = float(m["value"])
        except (ValueError, KeyError, TypeError):
            continue
    return out


def _metric(key, label, value, fmt, tooltip, prev, polarity=None):
    delta = round(value - prev[key], 4) if key in prev else 0.0
    metric = {
        "key": key,
        "label": label,
        "value": round(float(value), 4),
        "format": fmt,
        "delta": delta,
        "tooltip": tooltip,
    }
    if polarity:
        metric["polarity"] = polarity
    return metric


# ── Evaluation runner ────────────────────────────────────────────────────────

def run_evaluation_suite(
    run_id: str,
    dataset_id: str,
    configuration_id: str,
    limit_questions: int,
    db: Session,
) -> EvaluationRunRow:
    """Run every dataset question through the RAG pipeline, score it, and save the run."""
    t_start = time.time()
    started_iso = _now_iso()

    dataset = get_dataset(dataset_id)
    questions = dataset["questions"]
    if limit_questions and limit_questions > 0:
        questions = questions[:limit_questions]
    if not questions:
        raise ValueError("This dataset has no questions.")

    cfg_row = db.query(RAGConfigRow).filter(RAGConfigRow.id == configuration_id).first()
    cfg_top_k = cfg_row.top_k if cfg_row else 5
    cfg_llm = cfg_row.llm if cfg_row else "gpt-4o-mini"
    cfg_temp = cfg_row.temperature if cfg_row else 0.2
    cfg_name = cfg_row.name if cfg_row else "Vector Baseline"

    # Previous completed run, used for "vs previous run" deltas
    prev_run = (
        db.query(EvaluationRunRow)
        .filter(EvaluationRunRow.id != run_id, EvaluationRunRow.status == "completed")
        .order_by(EvaluationRunRow.started_at.desc())
        .first()
    )
    prev = metrics_by_key(prev_run) if prev_run else {}

    results: List[EvaluationResultRow] = []
    latencies: List[int] = []
    tokens_list: List[float] = []
    r1s: List[float] = []
    r3s: List[float] = []
    r5s: List[float] = []
    p5s: List[float] = []
    mrrs: List[float] = []
    ndcgs: List[float] = []
    correctness_scores: List[float] = []
    faithfulness_scores: List[float] = []
    context_scores: List[float] = []
    answer_rel_scores: List[float] = []
    source_hits: List[float] = []
    hallucinations = 0
    error_count = 0
    first_error = ""

    for q_item in questions:
        q_text = q_item["question"]
        expected = q_item["expectedAnswer"]
        source = q_item.get("source", "") or ""

        err = ""
        gen_answer = ""
        raw_chunks: List[Dict[str, Any]] = []
        t0 = time.time()
        try:
            ans = rag_query(
                question=q_text,
                top_k=cfg_top_k,
                llm=cfg_llm,
                temperature=cfg_temp,
                configuration_id=configuration_id,
            )
            gen_answer = ans.get("answer", "") or ""
            raw_chunks = ans.get("chunks", []) or []
        except Exception as exc:  # noqa: BLE001 - surface any provider/index error
            err = str(exc) or exc.__class__.__name__
            error_count += 1
            first_error = first_error or err
        latency_ms = int((time.time() - t0) * 1000)
        latencies.append(latency_ms)

        context_text = " ".join(str(c.get("text", "")) for c in raw_chunks)
        tokens_list.append((len(q_text) + len(context_text) + len(gen_answer)) / 4.0)

        # Retrieval metrics (binary relevance on top 5)
        top = raw_chunks[:5]
        flags = [1 if _is_relevant(c, source, expected) else 0 for c in top]
        first_rank = next((i + 1 for i, f in enumerate(flags) if f), None)
        r1 = 1.0 if any(flags[:1]) else 0.0
        r3 = 1.0 if any(flags[:3]) else 0.0
        r5 = 1.0 if any(flags[:5]) else 0.0
        p5 = (sum(flags) / len(top)) if top else 0.0
        rr = (1.0 / first_rank) if first_rank else 0.0
        dcg = sum(f / math.log2(i + 2) for i, f in enumerate(flags))
        idcg = sum(1.0 / math.log2(i + 2) for i in range(sum(flags)))
        ndcg = (dcg / idcg) if idcg else 0.0
        src_hit = 1.0 if any(_source_match(c, source) for c in top) else 0.0

        # Generation metrics
        if err:
            faithfulness = correctness = context_rel = answer_rel = 0.0
        else:
            faithfulness = _compute_faithfulness(gen_answer, context_text)
            correctness = _compute_token_f1(gen_answer, expected)
            context_rel = _compute_overlap(q_text, context_text)
            answer_rel = _compute_overlap(q_text, gen_answer)

        if err:
            status, failure_type = "fail", "other"
            diagnosis = f"Query failed: {err}"
        elif first_rank is None:
            status, failure_type = "fail", "retrieval_failure"
            diagnosis = (
                f"None of the top {len(top)} retrieved chunks matched '{source or 'the expected source'}' "
                "or covered the expected answer. The source document may not be uploaded or indexed."
            )
        elif faithfulness < 0.5:
            status, failure_type = "fail", "hallucination"
            diagnosis = "The generated answer contains assertions not grounded in the retrieved chunks."
            hallucinations += 1
        elif correctness < 0.25:
            status, failure_type = "fail", "citation_error"
            diagnosis = f"Answer diverged strongly from the expected answer (correctness {correctness:.2f})."
        elif correctness < 0.5:
            status, failure_type = "warn", "other"
            diagnosis = f"Answer only partly matches the expected answer (correctness {correctness:.2f})."
        elif latency_ms > 3000:
            status, failure_type = "warn", "other"
            diagnosis = f"Query latency ({latency_ms} ms) exceeded the 3,000 ms target."
        else:
            status, failure_type = "pass", None
            diagnosis = f"Relevant chunk found at rank {first_rank} and the answer matches the reference."

        r1s.append(r1); r3s.append(r3); r5s.append(r5); p5s.append(p5)
        mrrs.append(rr); ndcgs.append(ndcg); source_hits.append(src_hit)
        correctness_scores.append(correctness)
        faithfulness_scores.append(faithfulness)
        context_scores.append(context_rel)
        answer_rel_scores.append(answer_rel)

        row = EvaluationResultRow(
            id=f"res-{uuid.uuid4().hex[:8]}",
            run_id=run_id,
            question=q_text,
            expected_answer=expected,
            generated_answer=gen_answer,
            retrieval_score=round(float(rr), 4),
            correctness=round(float(correctness), 4),
            faithfulness=round(float(faithfulness), 4),
            context_relevance=round(float(context_rel), 4),
            latency_ms=latency_ms,
            status=status,
            failure_type=failure_type,
            diagnosis=diagnosis,
            chunks_json=json.dumps(raw_chunks),
        )
        db.add(row)
        results.append(row)

    q_count = len(questions)
    if error_count == q_count:
        db.rollback()
        raise RuntimeError(
            f"Every question failed, so no run was saved. First error: {first_error}. "
            "Check OPENAI_API_KEY / OPENAI_BASE_URL in backend/.env and that documents are indexed."
        )

    def mean(values: List[float]) -> float:
        return sum(values) / max(len(values), 1)

    total_duration_ms = int((time.time() - t_start) * 1000)
    sorted_lat = sorted(latencies)
    p50 = sorted_lat[len(sorted_lat) // 2] / 1000.0
    p95 = sorted_lat[min(len(sorted_lat) - 1, int(len(sorted_lat) * 0.95))] / 1000.0
    avg_tokens = mean(tokens_list)
    price = _PRICE_PER_1K.get(str(cfg_llm).lower(), 0.00015)
    cost_per_query = avg_tokens / 1000.0 * price

    retrieval_metrics = [
        _metric("recall1", "Recall@1", mean(r1s), "percent", "Share of queries with a relevant chunk at rank 1", prev),
        _metric("recall3", "Recall@3", mean(r3s), "percent", "Share of queries with a relevant chunk in the top 3", prev),
        _metric("recall5", "Recall@5", mean(r5s), "percent", "Share of queries with a relevant chunk in the top 5", prev),
        _metric("precision5", "Precision@5", mean(p5s), "percent", "Share of the top 5 chunks that are relevant", prev),
        _metric("mrr", "MRR", mean(mrrs), "percent", "Mean reciprocal rank of the first relevant chunk", prev),
        _metric("ndcg", "NDCG", mean(ndcgs), "percent", "Normalized discounted cumulative gain at 5", prev),
    ]
    generation_metrics = [
        _metric("correctness", "Answer Correctness", mean(correctness_scores), "percent", "Token F1 against the reference answer", prev),
        _metric("faithfulness", "Faithfulness", mean(faithfulness_scores), "percent", "Share of answer tokens supported by retrieved context", prev),
        _metric("contextRelevance", "Context Relevance", mean(context_scores), "percent", "Share of question terms found in retrieved context", prev),
        _metric("answerRelevance", "Answer Relevance", mean(answer_rel_scores), "percent", "Share of question terms covered by the answer", prev),
        _metric("citation", "Citation Correctness", mean(source_hits), "percent", "Share of queries where the expected source file was retrieved", prev),
        _metric("hallucination", "Hallucination Rate", hallucinations / q_count, "percent", "Share of answers not grounded in context", prev, "lower-better"),
    ]
    performance_metrics = [
        _metric("avgLatency", "Average Latency", mean(latencies) / 1000.0, "seconds", "Mean end-to-end query time", prev, "lower-better"),
        _metric("p50", "P50 Latency", p50, "seconds", "Median latency", prev, "lower-better"),
        _metric("p95", "P95 Latency", p95, "seconds", "95th percentile latency", prev, "lower-better"),
        _metric("tokens", "Average Tokens", avg_tokens, "number", "Estimated tokens per query (characters / 4)", prev, "lower-better"),
        _metric("cost", "Cost / Query", cost_per_query, "currency", "Estimated LLM cost per query", prev, "lower-better"),
        _metric("totalCost", "Total Evaluation Cost", cost_per_query * q_count, "currency", "Estimated cost of the whole run", prev, "lower-better"),
    ]

    run = db.query(EvaluationRunRow).filter(EvaluationRunRow.id == run_id).first()
    if not run:
        run = EvaluationRunRow(id=run_id)
        db.add(run)

    run.label = f"Evaluation Run #{run_id}"
    run.status = "completed"
    run.dataset_id = dataset["id"]
    run.dataset_name = dataset["name"]
    run.configuration_name = cfg_name
    run.questions = q_count
    run.started_at = started_iso
    run.duration_ms = total_duration_ms
    run.retrieval_json = json.dumps(retrieval_metrics)
    run.generation_json = json.dumps(generation_metrics)
    run.performance_json = json.dumps(performance_metrics)

    db.commit()
    db.refresh(run)
    return run


def seed_baseline_evaluations(db: Session) -> None:
    """Ensure at least one evaluation run exists for the UI."""
    if db.query(EvaluationRunRow).first():
        return
    try:
        run_evaluation_suite(
            run_id="RAG-042",
            dataset_id="ds-enterprise-qa-v2",
            configuration_id="cfg-default",
            limit_questions=len(ENTERPRISE_QUESTIONS),
            db=db,
        )
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        print(f"[evaluation_service] Baseline seed notice: {exc}")