"""
SQLite persistence layer using SQLAlchemy (sync, for simplicity).
Tables: documents, chunks, evaluation_runs, evaluation_results, rag_configurations
"""
from __future__ import annotations

import json
import uuid
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import (
    JSON,
    Boolean,
    Column,
    Float,
    Integer,
    String,
    Text,
    create_engine,
)
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from config import DB_PATH

engine = create_engine(f"sqlite:///{DB_PATH}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(bind=engine, autoflush=False)


class Base(DeclarativeBase):
    pass


# ─────────────────────────── ORM models ──────────────────────────────────────


class DocumentRow(Base):
    __tablename__ = "documents"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    type = Column(String, nullable=False)
    size_bytes = Column(Integer, nullable=False)
    pages = Column(Integer, default=0)
    chunks = Column(Integer, default=0)
    status = Column(String, default="uploading")  # uploading|processing|chunking|embedding|indexed|failed
    embedding_model = Column(String, default="")
    indexed_at = Column(String, nullable=True)
    updated_at = Column(String, nullable=False)
    processing_time_ms = Column(Integer, nullable=True)
    error_message = Column(Text, nullable=True)
    file_path = Column(String, nullable=True)

    def to_api(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type,
            "sizeBytes": self.size_bytes,
            "pages": self.pages,
            "chunks": self.chunks,
            "status": self.status,
            "embeddingModel": self.embedding_model,
            "indexedAt": self.indexed_at,
            "updatedAt": self.updated_at,
            "processingTimeMs": self.processing_time_ms,
            "errorMessage": self.error_message,
        }


class ChunkRow(Base):
    __tablename__ = "chunks"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    document_id = Column(String, nullable=False, index=True)
    document_name = Column(String, nullable=False)
    chunk_index = Column(Integer, nullable=False)
    text = Column(Text, nullable=False)
    page = Column(Integer, default=1)
    faiss_index = Column(Integer, nullable=True)  # position in FAISS index


class RAGConfigRow(Base):
    __tablename__ = "rag_configurations"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String, nullable=False)
    embedding_model = Column(String, default="all-MiniLM-L6-v2")
    retrieval_strategy = Column(String, default="vector")
    top_k = Column(Integer, default=5)
    chunk_size = Column(Integer, default=500)
    chunk_overlap = Column(Integer, default=64)
    reranker = Column(String, default="disabled")
    llm = Column(String, default="gpt-4o-mini")
    temperature = Column(Float, default=0.2)
    is_active = Column(Boolean, default=False)

    def to_api(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "embeddingModel": self.embedding_model,
            "retrievalStrategy": self.retrieval_strategy,
            "topK": self.top_k,
            "chunkSize": self.chunk_size,
            "chunkOverlap": self.chunk_overlap,
            "reranker": self.reranker,
            "llm": self.llm,
            "temperature": self.temperature,
            "isActive": self.is_active,
        }


class EvaluationRunRow(Base):
    __tablename__ = "evaluation_runs"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    label = Column(String, nullable=False)
    status = Column(String, default="queued")
    dataset_id = Column(String, nullable=False)
    dataset_name = Column(String, nullable=False)
    configuration_name = Column(String, nullable=False)
    questions = Column(Integer, default=0)
    started_at = Column(String, nullable=False)
    duration_ms = Column(Integer, default=0)
    retrieval_json = Column(Text, default="[]")
    generation_json = Column(Text, default="[]")
    performance_json = Column(Text, default="[]")

    def to_api(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "label": self.label,
            "status": self.status,
            "datasetId": self.dataset_id,
            "datasetName": self.dataset_name,
            "configurationName": self.configuration_name,
            "questions": self.questions,
            "startedAt": self.started_at,
            "durationMs": self.duration_ms,
            "retrieval": json.loads(self.retrieval_json or "[]"),
            "generation": json.loads(self.generation_json or "[]"),
            "performance": json.loads(self.performance_json or "[]"),
        }


class EvaluationResultRow(Base):
    __tablename__ = "evaluation_results"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    run_id = Column(String, nullable=False, index=True)
    question = Column(Text, nullable=False)
    expected_answer = Column(Text, default="")
    generated_answer = Column(Text, default="")
    retrieval_score = Column(Float, default=0.0)
    correctness = Column(Float, default=0.0)
    faithfulness = Column(Float, default=0.0)
    context_relevance = Column(Float, default=0.0)
    latency_ms = Column(Integer, default=0)
    status = Column(String, default="pass")
    failure_type = Column(String, nullable=True)
    diagnosis = Column(Text, nullable=True)
    chunks_json = Column(Text, default="[]")

    def to_api(self) -> dict[str, Any]:
        return {
            "id": self.id,
            "runId": self.run_id,
            "question": self.question,
            "expectedAnswer": self.expected_answer,
            "generatedAnswer": self.generated_answer,
            "retrievalScore": self.retrieval_score,
            "correctness": self.correctness,
            "faithfulness": self.faithfulness,
            "contextRelevance": self.context_relevance,
            "latencyMs": self.latency_ms,
            "status": self.status,
            "failureType": self.failure_type,
            "diagnosis": self.diagnosis,
            "chunks": json.loads(self.chunks_json or "[]"),
        }


def get_db() -> Session:
    """FastAPI dependency — yields a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def create_tables() -> None:
    Base.metadata.create_all(engine)


def seed_default_configuration(db: Session) -> None:
    """Insert a default active configuration if none exists."""
    existing = db.query(RAGConfigRow).first()
    if existing:
        return
    cfg = RAGConfigRow(
        id="cfg-default",
        name="Vector Baseline",
        embedding_model="all-MiniLM-L6-v2",
        retrieval_strategy="vector",
        top_k=5,
        chunk_size=500,
        chunk_overlap=64,
        reranker="disabled",
        llm="gpt-4o-mini",
        temperature=0.2,
        is_active=True,
    )
    db.add(cfg)
    db.commit()
