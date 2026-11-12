"""FastAPI application factory.

Run directly:  uvicorn app.main:app --reload --port 8000
"""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import db as db_module
from .config import settings
from .routes_ai import router as ai_router
from .routes_badges import ensure_roster
from .routes_badges import router as badges_router
from .routes_campus import router as campus_router
from .routes_devices import router as devices_router
from .routes_ingest import router as ingest_router
from .routes_insights import router as insights_router
from .routes_sim import router as sim_router
from .sim_engine import SimWorker, ensure_defaults

__version__ = "0.1.0"


def create_app(database_url: str | None = None, start_sim_worker: bool = True) -> FastAPI:
    db_module.configure(database_url or settings.database_url)

    with db_module.session_factory()() as session:
        ensure_defaults(session)
        ensure_roster(session)

    worker = SimWorker() if start_sim_worker else None

    @asynccontextmanager
    async def lifespan(_app: FastAPI):
        if worker is not None:
            worker.start()
        try:
            yield
        finally:
            if worker is not None:
                worker.stop()

    app = FastAPI(
        title="CampusPulse API",
        version=__version__,
        description=(
            "Sensor ingest, insights and simulated campus data. "
            "Every reading carries source=real|simulated; simulated data is never relabelled."
        ),
        lifespan=lifespan,
    )

    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_credentials=True,
            allow_methods=["GET", "POST", "OPTIONS"],
            allow_headers=["Content-Type"],
        )

    app.include_router(ingest_router)
    app.include_router(badges_router)
    app.include_router(campus_router)
    app.include_router(devices_router)
    app.include_router(insights_router)
    app.include_router(sim_router)
    app.include_router(ai_router)

    @app.get("/healthz", tags=["meta"])
    def healthz():
        return {
            "status": "ok",
            "version": __version__,
            "ai_enabled": settings.ai_enabled,
            "cors_origins": settings.cors_origins,
        }

    return app


app = create_app()
