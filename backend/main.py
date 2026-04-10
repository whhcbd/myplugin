from __future__ import annotations

import json
import logging
import os
from pathlib import Path
from typing import Any

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes.plugins import router as plugins_router

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("plugin-backend")

PLUGINS_DIR = Path(__file__).resolve().parent.parent / "plugins"

app = FastAPI(title="AhaTutor Plugin Backend", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.state.plugins_dir = PLUGINS_DIR


@app.on_event("startup")
async def startup() -> None:
    count = 0
    for entry in sorted(PLUGINS_DIR.iterdir()):
        if not entry.is_dir() or entry.name.startswith("_"):
            continue
        manifest_path = entry / "manifest.json"
        if manifest_path.is_file():
            try:
                data = json.loads(manifest_path.read_text(encoding="utf-8"))
                logger.info(
                    "Loaded plugin '%s' (%s)",
                    data.get("id", "?"),
                    data.get("name", "?"),
                )
                count += 1
            except Exception as exc:
                logger.warning("Failed to read %s: %s", manifest_path, exc)
    logger.info("Plugin backend started — %d plugin(s) found in %s", count, PLUGINS_DIR)


@app.get("/api/v1/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


app.include_router(plugins_router, prefix="/api/v1")
