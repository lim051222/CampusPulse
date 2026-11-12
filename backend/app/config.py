"""Runtime configuration, all overridable through environment variables."""

from __future__ import annotations

import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = BACKEND_DIR / "data" / "campuspulse.db"


class Settings:
    def __init__(self) -> None:
        self.database_url = os.getenv("CAMPUSPULSE_DB", f"sqlite:///{DEFAULT_DB_PATH.as_posix()}")

        raw_origins = os.getenv(
            "CAMPUSPULSE_CORS_ORIGINS",
            "http://localhost:5173,http://127.0.0.1:5173",
        )
        self.cors_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

        self.ai_base_url = os.getenv("AI_BASE_URL", "").rstrip("/")
        self.ai_api_key = os.getenv("AI_API_KEY", "")
        self.ai_model = os.getenv("AI_MODEL", "gpt-4o-mini")
        self.ai_timeout_s = float(os.getenv("AI_TIMEOUT_S", "15"))

    @property
    def ai_enabled(self) -> bool:
        return bool(self.ai_base_url and self.ai_api_key)


settings = Settings()
