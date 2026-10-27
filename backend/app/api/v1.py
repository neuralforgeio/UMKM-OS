"""API v1 — aggregates every router that belongs to version 1.

Adding an endpoint to v1:
    1. Create its router in app/api/routes/<feature>.py
    2. Import and include it in the APIRouter below

When a breaking change is needed in the future, create app/api/v2.py
with the new contract and mount it alongside in main.py — old clients
keep calling /api/v1/* untouched.
"""

from fastapi import APIRouter

from app.api.routes import assistant, forecast, health

router = APIRouter()
router.include_router(health.router)
router.include_router(forecast.router)
# v3.1.0 — Asisten AI (POST /assistant/chat, GET /assistant/history,
# GET /assistant/status publik). Tetap di bawah /api/v1/*; klien lama
# tidak terpengaruh (router baru murni aditif).
router.include_router(assistant.router)
