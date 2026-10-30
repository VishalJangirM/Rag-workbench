"""Remaining routers: dashboard, experiments, failures, datasets, models, settings."""
from __future__ import annotations

import json
import re
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from config import DB_PATH
from database import DocumentRow, EvaluationRunRow, EvaluationResultRow, RAGConfigRow, get_db
from evaluation_service import (
    DATASETS,
    create_custom_dataset,
    get_all_datasets,
    get_dataset,
    metrics_by_key,
    parse_dataset_file,
    run_evaluation_suite,
)

router = APIRouter(tags=["misc"])

# Set to False to hide the 4 example experiments and show only real ones.
SHOW_SAMPLE_EXPERIMENTS = True

EXPERIMENTS_PATH = DB_PATH.parent / "experiments.json"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ── Health ────────────────────────────────────────────────────────────────────

@router.get("/api/health")
def health():
    return {"status": "ok", "service": "RAGBench API", "version": "1.0.0"}


# ── Experiments (stored in data/experiments.json) ────────────────────────────

def _sample(id_, name, model, embedding, retrieval, reranker, acc, faith, recall, lat, cost, created):
    return {
        "id": id_, "name": name, "model": model, "embedding": embedding,
        "retrieval": retrieval, "reranker": reranker, "accuracy": acc,
        "faithfulness": faith, "recall": recall, "latencySeconds": lat,
        "costUsd": cost, "overallScore": acc, "status": "completed", "createdAt": created,
    }


SAMPLE_EXPERIMENTS = [
    _sample("RAG-001", "Vector baseline", "gpt-4o-mini", "MiniLM-L6-v2", "Vector", "Disabled", 81.2, 87.4, 84.1, 1.2, 0.001, "2026-07-28T11:00:00Z"),
    _sample("RAG-002", "Vector + reranker", "gpt-4o-mini", "E5-base-v2", "Vector", "Cross Encoder", 88.7, 92.3, 90.3, 1.7, 0.0015, "2026-08-03T09:30:00Z"),
    _sample("RAG-003", "Hybrid + reranker", "gpt-4o-mini", "BGE-large-en-v1.5", "Hybrid", "Cross Encoder", 94.6, 96.2, 95.8, 1.8, 0.002, "2026-08-14T16:12:00Z"),
    _sample("RAG-004", "Hybrid + large LLM", "llama-3.1-70b", "BGE-large-en-v1.5", "Hybrid", "Custom", 92.1, 94.0, 95.1, 3.4, 0.0041, "2026-08-16T08:45:00Z"),
]


def _load_saved_experiments() -> List[Dict[str, Any]]:
    try:
        data = json.loads(EXPERIMENTS_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, list) else []
    except (OSError, ValueError):
        return []


def _save_experiments(items: List[Dict[str, Any]]) -> None:
    EXPERIMENTS_PATH.parent.mkdir(parents=True, exist_ok=True)
    EXPERIMENTS_PATH.write_text(json.dumps(items, indent=2), encoding="utf-8")


def _all_experiments() -> List[Dict[str, Any]]:
    items = (SAMPLE_EXPERIMENTS if SHOW_SAMPLE_EXPERIMENTS else []) + _load_saved_experiments()
    if not items:
        return []
    best_id = max(items, key=lambda e: e.get("overallScore", 0))["id"]
    return [{**e, "isBest": e["id"] == best_id} for e in items]


def _next_experiment_id() -> str:
    numbers = []
    for e in _all_experiments():
        m = re.match(r"RAG-(\d+)$", str(e["id"]))
        if m:
            numbers.append(int(m.group(1)))
    return f"RAG-{(max(numbers) + 1 if numbers else 1):03d}"


class ExperimentPayload(BaseModel):
    name: Optional[str] = None
    datasetId: Optional[str] = None
    configurationId: Optional[str] = None


@router.get("/api/experiments")
def list_experiments():
    return _all_experiments()


@router.post("/api/experiments")
def create_experiment(payload: Optional[ExperimentPayload] = None, db: Session = Depends(get_db)):
    """Run a real evaluation with the chosen/active configuration and save it as an experiment."""
    payload = payload or ExperimentPayload()

    cfg_row = None
    if payload.configurationId:
        cfg_row = db.query(RAGConfigRow).filter(RAGConfigRow.id == payload.configurationId).first()
    if cfg_row is None:
        cfg_row = db.query(RAGConfigRow).filter(RAGConfigRow.is_active == True).first()  # noqa: E712
    cfg = cfg_row.to_api() if cfg_row else {}
    configuration_id = cfg_row.id if cfg_row else "cfg-default"

    dataset = get_dataset(payload.datasetId or DATASETS[0]["id"])
    run_id = f"EXP-RUN-{uuid.uuid4().hex[:6].upper()}"
    try:
        run = run_evaluation_suite(run_id, dataset["id"], configuration_id, 0, db)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    m = metrics_by_key(run)
    exp_id = _next_experiment_id()
    experiment = {
        "id": exp_id,
        "name": (payload.name or "").strip() or f"{cfg.get('name', 'Experiment')} on {dataset['name']}",
        "model": str(cfg.get("llm", "")),
        "embedding": str(cfg.get("embeddingModel", "")),
        "retrieval": str(cfg.get("retrievalStrategy", "vector")).title(),
        "reranker": str(cfg.get("reranker", "disabled")).replace("_", " ").title(),
        "accuracy": round(m.get("correctness", 0.0) * 100, 1),
        "faithfulness": round(m.get("faithfulness", 0.0) * 100, 1),
        "recall": round(m.get("recall5", 0.0) * 100, 1),
        "latencySeconds": round(m.get("avgLatency", 0.0), 2),
        "costUsd": round(m.get("cost", 0.0), 5),
        "overallScore": round(m.get("correctness", 0.0) * 100, 1),
        "status": "completed",
        "createdAt": _now_iso(),
        "runId": run.id,
    }
    saved = _load_saved_experiments()
    saved.append(experiment)
    _save_experiments(saved)
    return experiment


@router.get("/api/experiments/compare")
def compare_experiments(ids: str = ""):
    all_exps = _all_experiments()
    if not ids:
        return all_exps
    wanted = set(ids.split(","))
    return [e for e in all_exps if e["id"] in wanted]


# ── Dashboard ─────────────────────────────────────────────────────────────────

_FAILURE_LABELS = {
    "hallucination": "Hallucination",
    "retrieval_failure": "Retrieval Failure",
    "citation_error": "Citation Error",
    "context_irrelevance": "Context Irrelevance",
    "other": "Other",
}


def _breakdown_from_types(types: List[str]) -> List[Dict[str, Any]]:
    counts: Dict[str, int] = {}
    for t in types:
        key = t if t in _FAILURE_LABELS else "other"
        counts[key] = counts.get(key, 0) + 1
    return [{"type": k, "count": counts.get(k, 0), "label": label} for k, label in _FAILURE_LABELS.items()]


@router.get("/api/dashboard")
def dashboard(db: Session = Depends(get_db)):
    doc_count = db.query(DocumentRow).count()
    run_count = db.query(EvaluationRunRow).count()
    active_cfg = db.query(RAGConfigRow).filter(RAGConfigRow.is_active == True).first()  # noqa: E712
    runs = db.query(EvaluationRunRow).order_by(EvaluationRunRow.started_at.desc()).all()
    completed = [r for r in runs if r.status == "completed"]

    latest = metrics_by_key(completed[0]) if completed else {}
    previous = metrics_by_key(completed[1]) if len(completed) > 1 else {}

    def val(key: str) -> float:
        return latest.get(key, 0.0)

    def dlt(key: str) -> float:
        return round(latest[key] - previous[key], 4) if key in latest and key in previous else 0.0

    avg_recall = val("recall5")
    avg_correctness = val("correctness")
    avg_faithfulness = val("faithfulness")
    avg_quality = (avg_recall + avg_correctness + avg_faithfulness) / 3.0
    prev_quality = (
        (previous["recall5"] + previous["correctness"] + previous["faithfulness"]) / 3.0
        if all(k in previous for k in ("recall5", "correctness", "faithfulness"))
        else None
    )

    score_trend = []
    for r in reversed(completed[:6]):
        m = metrics_by_key(r)
        rec, fth, cor = m.get("recall5", 0.0), m.get("faithfulness", 0.0), m.get("correctness", 0.0)
        score_trend.append({
            "run": r.id,
            "overall": round((rec + fth + cor) / 3.0 * 100, 1),
            "retrieval": round(rec * 100, 1),
            "generation": round(cor * 100, 1),
            "faithfulness": round(fth * 100, 1),
        })

    experiments_list = _all_experiments()
    accuracy_vs_latency = [
        {"experiment": e["id"], "latency": e["latencySeconds"], "accuracy": e["accuracy"], "cost": e["costUsd"]}
        for e in experiments_list
    ]

    failed_types = [
        (r.failure_type or "other")
        for r in db.query(EvaluationResultRow).filter(EvaluationResultRow.status.in_(["fail", "warn"])).all()
    ]
    failure_breakdown = _breakdown_from_types(failed_types)

    weakest = "Retrieval" if avg_recall < avg_faithfulness else "Generation"
    datasets_all = get_all_datasets()

    return {
        "kpis": [
            {"key": "overall", "label": "Overall Quality", "value": round(avg_quality, 4), "format": "percent",
             "delta": round(avg_quality - prev_quality, 4) if prev_quality is not None else 0.0,
             "tooltip": "Average of Recall@5, answer correctness and faithfulness in the latest run"},
            {"key": "recall", "label": "Retrieval Recall", "value": round(avg_recall, 4), "format": "percent",
             "delta": dlt("recall5"), "tooltip": "Share of queries with a relevant chunk in the top 5"},
            {"key": "correctness", "label": "Answer Correctness", "value": round(avg_correctness, 4), "format": "percent",
             "delta": dlt("correctness"), "tooltip": "Token F1 against the reference answers"},
            {"key": "faithfulness", "label": "Faithfulness", "value": round(avg_faithfulness, 4), "format": "percent",
             "delta": dlt("faithfulness"), "tooltip": "Share of answer tokens supported by retrieved context"},
            {"key": "documents", "label": "Documents Indexed", "value": doc_count, "format": "number",
             "delta": doc_count, "tooltip": "Total documents in the knowledge base"},
            {"key": "evaluations", "label": "Evaluation Runs", "value": run_count, "format": "number",
             "delta": run_count, "tooltip": "Total evaluation runs"},
        ],
        "scoreTrend": score_trend,
        "experimentComparison": experiments_list,
        "accuracyVsLatency": accuracy_vs_latency,
        "failureBreakdown": failure_breakdown,
        "recommendation": {
            "id": "rec-live",
            "title": f"Improve {weakest}",
            "summary": (
                f"{doc_count} document(s) indexed, {run_count} evaluation run(s). Latest run: "
                f"Recall@5 {avg_recall * 100:.1f}%, correctness {avg_correctness * 100:.1f}%, "
                f"faithfulness {avg_faithfulness * 100:.1f}%. The weakest area is {weakest.lower()}."
            ),
            "bottleneck": weakest,
            "impact": "high",
            "suggestions": [
                "Upload the source documents your dataset questions refer to",
                "Increase Top-K from 5 to 8 in the RAG Playground configuration",
                "Test cross-encoder reranking after the candidate retrieval pass",
                "Run another evaluation to verify the change",
            ],
        },
        "activeConfiguration": active_cfg.to_api() if active_cfg else {
            "id": "cfg-default",
            "name": "Vector Baseline",
            "embeddingModel": "all-MiniLM-L6-v2",
            "retrievalStrategy": "vector",
            "topK": 5,
            "chunkSize": 500,
            "chunkOverlap": 64,
            "reranker": "disabled",
            "llm": "gpt-4o-mini",
            "temperature": 0.2,
            "isActive": True,
        },
        "activeDataset": {
            "id": datasets_all[0]["id"],
            "name": datasets_all[0]["name"],
            "questions": datasets_all[0]["totalQuestions"],
        },
    }


# ── Failures ──────────────────────────────────────────────────────────────────

@router.get("/api/failures")
def list_failures(db: Session = Depends(get_db)):
    failed_rows = (
        db.query(EvaluationResultRow)
        .filter(EvaluationResultRow.status.in_(["fail", "warn"]))
        .all()
    )
    run_dates = {r.id: (r.started_at or "")[:10] for r in db.query(EvaluationRunRow).all()}
    today = _now_iso()[:10]

    failures = []
    trend_map: Dict[str, Dict[str, Any]] = {}
    for r in failed_rows:
        ftype = r.failure_type or "other"
        sev = "critical" if ftype == "hallucination" else "high" if ftype == "retrieval_failure" else "medium"
        failures.append({
            "id": f"f-{r.id}",
            "question": r.question,
            "failureType": ftype,
            "severity": sev,
            "experiment": r.run_id,
            "runId": r.run_id,
            "detectedAt": _now_iso(),
        })
        day = run_dates.get(r.run_id) or today
        bucket = trend_map.setdefault(
            day, {"date": day, "hallucination": 0, "retrieval_failure": 0, "other": 0}
        )
        bucket[ftype if ftype in ("hallucination", "retrieval_failure") else "other"] += 1

    if failures:
        trend = [trend_map[d] for d in sorted(trend_map)]
    else:
        # No failures yet: keep example rows so the page layout still renders.
        failures = [
            {"id": "f-001", "question": "What is the employee leave carry-forward policy?", "failureType": "hallucination", "severity": "critical", "experiment": "RAG-003", "runId": "RAG-042", "detectedAt": "2026-08-17T04:18:00Z"},
            {"id": "f-002", "question": "How are travel reimbursements processed for contractors?", "failureType": "retrieval_failure", "severity": "high", "experiment": "RAG-003", "runId": "RAG-042", "detectedAt": "2026-08-17T04:19:00Z"},
        ]
        trend = [
            {"date": "2026-08-16", "hallucination": 5, "retrieval_failure": 7, "other": 3},
            {"date": "2026-08-17", "hallucination": 4, "retrieval_failure": 6, "other": 2},
        ]

    return {
        "failures": failures,
        "breakdown": _breakdown_from_types([f["failureType"] for f in failures]),
        "trend": trend,
        "total": len(failures),
    }


# ── Recommendations ───────────────────────────────────────────────────────────

@router.get("/api/recommendations")
def list_recommendations():
    return [
        {
            "id": "rec-01",
            "title": "Enable Hybrid Search for Policy Queries",
            "summary": "Keyword-heavy questions (clause numbers, specific thresholds) usually retrieve better when BM25 keyword matching is combined with dense vector similarity.",
            "bottleneck": "Retrieval",
            "impact": "high",
            "suggestions": [
                "Configure Hybrid Retrieval strategy in RAG Settings",
                "Set Top-K to 8 for multi-part questions",
                "Ensure document chunks include table headers",
            ],
        },
        {
            "id": "rec-02",
            "title": "Add Cross-Encoder Reranker",
            "summary": "Re-ranking the top candidate chunks with a cross-encoder reduces context noise and helps prevent hallucinations on edge-case questions.",
            "bottleneck": "Generation",
            "impact": "medium",
            "suggestions": [
                "Enable cross-encoder reranking in pipeline configuration",
                "Budget 80-120ms additional latency for the rerank pass",
            ],
        },
    ]


# ── Datasets ──────────────────────────────────────────────────────────────────

class DatasetCreatePayload(BaseModel):
    name: str
    description: str = ""
    questions: List[Dict[str, Any]]


@router.get("/api/datasets")
def list_datasets():
    return get_all_datasets()


@router.post("/api/datasets")
def create_dataset(payload: DatasetCreatePayload):
    try:
        return create_custom_dataset(payload.name, payload.description, payload.questions)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.post("/api/datasets/import")
async def import_dataset(file: UploadFile = File(...), name: Optional[str] = Form(None)):
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    filename = file.filename or "dataset"
    try:
        rows = parse_dataset_file(filename, content)
        dataset_name = (name or "").strip() or re.sub(r"\.[^.]+$", "", filename)
        return create_custom_dataset(dataset_name, f"Imported from {filename}.", rows)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


# ── Models ────────────────────────────────────────────────────────────────────

@router.get("/api/models")
def list_models():
    from config import DEFAULT_LLM, EMBEDDING_MODEL

    def entry(id_, name, provider, kind, ctx, lat, cost, score, enabled):
        return {
            "id": id_, "name": name, "provider": provider, "kind": kind,
            "contextWindow": ctx, "avgLatencySeconds": lat,
            "costPer1kTokensUsd": cost, "benchmarkScore": score, "enabled": enabled,
        }

    # Reference catalog (benchmark / latency / cost are reference values, not measured here).
    catalog = [
        entry("m-llm-01", "gpt-4o-mini", "OpenAI", "llm", 128000, 1.4, 0.00015, 92.4, True),
        entry("m-llm-02", "llama-3.1-70b-instruct", "Together AI", "llm", 131072, 3.1, 0.0009, 90.8, True),
        entry("m-llm-03", "claude-3.5-haiku", "Anthropic", "llm", 200000, 1.1, 0.0008, 91.2, False),
        entry("m-embed-01", "BGE-large-en-v1.5", "BAAI", "embedding", 512, 0.04, 0.00002, 95.8, True),
        entry("m-embed-02", "E5-base-v2", "Microsoft", "embedding", 512, 0.03, 0.00001, 91.4, True),
        entry("m-embed-03", "all-MiniLM-L6-v2", "Sentence Transformers", "embedding", 256, 0.01, 0.0, 84.1, True),
        entry("m-rerank-01", "bge-reranker-large", "BAAI", "reranker", 512, 0.22, 0.00004, 93.6, True),
        entry("m-rerank-02", "cohere-rerank-v3", "Cohere", "reranker", 4096, 0.18, 0.0002, 94.2, False),
    ]
    names = {m["name"].lower() for m in catalog}
    if DEFAULT_LLM.lower() not in names:
        catalog.insert(0, entry("m-llm-cfg", DEFAULT_LLM, "OpenAI-compatible", "llm", 128000, 1.4, 0.00015, 90.0, True))
    if EMBEDDING_MODEL.lower() not in names:
        catalog.insert(0, entry("m-embed-cfg", EMBEDDING_MODEL, "Sentence Transformers", "embedding", 256, 0.02, 0.0, 84.0, True))
    return catalog


# ── Settings ──────────────────────────────────────────────────────────────────

@router.get("/api/settings")
def get_settings():
    from config import ALLOWED_EXTENSIONS, DEFAULT_LLM, EMBEDDING_MODEL, MAX_UPLOAD_BYTES
    return {
        "embeddingModel": EMBEDDING_MODEL,
        "defaultLlm": DEFAULT_LLM,
        "maxUploadMb": MAX_UPLOAD_BYTES // (1024 * 1024),
        "allowedExtensions": sorted(ALLOWED_EXTENSIONS),
    }