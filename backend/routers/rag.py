"""Router: /api/rag — configurations and query."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from config import DEFAULT_LLM, DEFAULT_TEMPERATURE
from database import RAGConfigRow, get_db
from rag_service import rag_query

router = APIRouter(prefix="/api/rag", tags=["rag"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ConfigurationBody(BaseModel):
    id: str | None = None
    name: str
    embeddingModel: str = "all-MiniLM-L6-v2"
    retrievalStrategy: str = "vector"
    topK: int = Field(5, ge=1, le=50)
    chunkSize: int = 500
    chunkOverlap: int = 64
    reranker: str = "disabled"
    llm: str = DEFAULT_LLM
    temperature: float = Field(DEFAULT_TEMPERATURE, ge=0.0, le=1.0)
    isActive: bool = False


class QueryBody(BaseModel):
    question: str
    configuration: ConfigurationBody


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/configurations")
def list_configurations(db: Session = Depends(get_db)):
    rows = db.query(RAGConfigRow).order_by(RAGConfigRow.name).all()
    return [r.to_api() for r in rows]


@router.post("/configurations")
def save_configuration(body: ConfigurationBody, db: Session = Depends(get_db)):
    if body.id:
        row = db.query(RAGConfigRow).filter(RAGConfigRow.id == body.id).first()
        if not row:
            raise HTTPException(status_code=404, detail="Configuration not found.")
    else:
        import uuid
        row = RAGConfigRow(id=str(uuid.uuid4()))
        db.add(row)

    row.name = body.name
    row.embedding_model = body.embeddingModel
    row.retrieval_strategy = body.retrievalStrategy
    row.top_k = body.topK
    row.chunk_size = body.chunkSize
    row.chunk_overlap = body.chunkOverlap
    row.reranker = body.reranker
    row.llm = body.llm
    row.temperature = body.temperature
    row.is_active = body.isActive
    db.commit()
    db.refresh(row)
    return row.to_api()


@router.post("/query")
def query_rag(body: QueryBody):
    cfg = body.configuration
    result = rag_query(
        question=body.question,
        top_k=cfg.topK,
        llm=cfg.llm,
        temperature=cfg.temperature,
        configuration_id=cfg.id or "cfg-default",
    )
    return result
