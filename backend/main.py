"""
RAGBench FastAPI application entry-point.

Start with:
    uvicorn main:app --reload --port 8000
"""
from __future__ import annotations

import sys
import os

# Ensure the backend directory is on the path when running from project root
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from config import CORS_ORIGINS
from database import create_tables, seed_default_configuration, SessionLocal
from routers.documents import router as documents_router
from routers.rag import router as rag_router
from routers.evaluations import router as evaluations_router
from routers.misc import router as misc_router

# ── App setup ─────────────────────────────────────────────────────────────────

app = FastAPI(
    title="RAGBench API",
    description="Retrieval-Augmented Generation Evaluation Harness",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    # Accept any localhost / 127.0.0.1 port during local development
    allow_origin_regex=r"https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Debug helper: prints the origin of every preflight request.
# Added after CORSMiddleware, so it runs first. Remove once uploads work.
@app.middleware("http")
async def log_preflight(request: Request, call_next):
    if request.method == "OPTIONS":
        print(
            "PREFLIGHT origin=",
            request.headers.get("origin"),
            "| method=",
            request.headers.get("access-control-request-method"),
            "| headers=",
            request.headers.get("access-control-request-headers"),
        )
    return await call_next(request)


app.include_router(documents_router)
app.include_router(rag_router)
app.include_router(evaluations_router)
app.include_router(misc_router)


# ── Startup ───────────────────────────────────────────────────────────────────

@app.on_event("startup")
def startup() -> None:
    create_tables()
    db = SessionLocal()
    try:
        seed_default_configuration(db)
        from evaluation_service import seed_baseline_evaluations
        seed_baseline_evaluations(db)
    finally:
        db.close()
    print("RAGBench API started -- visit http://localhost:8000/api/docs")


# ── Run directly ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)