"""
Centralised configuration loaded from environment variables.
Copy .env.example to .env and fill in your values.
"""
import os
from pathlib import Path

BASE_DIR = Path(__file__).parent

# Load backend/.env if python-dotenv is installed (safe if it is not)
try:
    from dotenv import load_dotenv

    load_dotenv(BASE_DIR / ".env")
except ImportError:
    pass

# ── Storage ───────────────────────────────────────────────────────────────────
UPLOAD_DIR = Path(os.getenv("UPLOAD_DIR", str(BASE_DIR / "data" / "uploads")))
INDEX_DIR = Path(os.getenv("INDEX_DIR", str(BASE_DIR / "data" / "indexes")))
DB_PATH = Path(os.getenv("DB_PATH", str(BASE_DIR / "data" / "ragbench.db")))

UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
INDEX_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH.parent.mkdir(parents=True, exist_ok=True)

# ── Upload limits ─────────────────────────────────────────────────────────────
MAX_UPLOAD_BYTES = int(os.getenv("MAX_UPLOAD_MB", "50")) * 1024 * 1024
ALLOWED_EXTENSIONS = {"pdf", "docx", "txt", "md"}

# ── Embeddings ────────────────────────────────────────────────────────────────
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")

# ── Chunking defaults ─────────────────────────────────────────────────────────
DEFAULT_CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "500"))
DEFAULT_CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "64"))

# ── LLM provider (OpenAI-compatible) ─────────────────────────────────────────
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1")
DEFAULT_LLM = os.getenv("DEFAULT_LLM", "gpt-4o-mini")
DEFAULT_TEMPERATURE = float(os.getenv("DEFAULT_TEMPERATURE", "0.2"))

# ── CORS ──────────────────────────────────────────────────────────────────────
# These frontend origins are always allowed; extra ones can be added via the
# CORS_ORIGINS environment variable (comma-separated).
_DEFAULT_ORIGINS = [
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
]
_extra_origins = [
    origin.strip()
    for origin in os.getenv("CORS_ORIGINS", "").split(",")
    if origin.strip()
]
CORS_ORIGINS = list(dict.fromkeys(_DEFAULT_ORIGINS + _extra_origins))