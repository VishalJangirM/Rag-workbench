"""Router: /api/evaluations — list runs, get run, get results, trigger run."""
from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import EvaluationResultRow, EvaluationRunRow, get_db

router = APIRouter(prefix="/api/evaluations", tags=["evaluations"])


class RunPayload(BaseModel):
    datasetId: str
    configurationId: str
    questions: int = 0


@router.get("")
def list_evaluations(db: Session = Depends(get_db)):
    rows = db.query(EvaluationRunRow).order_by(EvaluationRunRow.started_at.desc()).all()
    return [r.to_api() for r in rows]


@router.get("/{run_id}")
def get_evaluation(run_id: str, db: Session = Depends(get_db)):
    row = db.query(EvaluationRunRow).filter(EvaluationRunRow.id == run_id).first()
    if not row:
        raise HTTPException(status_code=404, detail="Evaluation run not found.")
    return row.to_api()


@router.get("/{run_id}/results")
def get_evaluation_results(run_id: str, db: Session = Depends(get_db)):
    rows = (
        db.query(EvaluationResultRow)
        .filter(EvaluationResultRow.run_id == run_id)
        .all()
    )
    return [r.to_api() for r in rows]


@router.post("/run")
def trigger_evaluation_run(payload: RunPayload, db: Session = Depends(get_db)):
    """Run a real evaluation against the indexed knowledge base."""
    from evaluation_service import run_evaluation_suite

    run_id = f"RAG-{str(uuid.uuid4())[:8].upper()}"
    try:
        run = run_evaluation_suite(
            run_id=run_id,
            dataset_id=payload.datasetId,
            configuration_id=payload.configurationId,
            limit_questions=payload.questions,
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except RuntimeError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return run.to_api()