from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

from fastapi import APIRouter, Request

logger = logging.getLogger("plugin-backend")

router = APIRouter(tags=["plugins"])


def _plugins_dir(request: Request) -> Path:
    return request.app.state.plugins_dir


def _load_manifest(plugin_dir: Path) -> dict[str, Any] | None:
    manifest_path = plugin_dir / "manifest.json"
    if not manifest_path.is_file():
        return None
    try:
        return json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception as exc:
        logger.warning("Cannot read %s: %s", manifest_path, exc)
        return None


@router.get("/plugins")
async def list_plugins(request: Request) -> list[dict[str, Any]]:
    plugins_dir = _plugins_dir(request)
    result: list[dict[str, Any]] = []
    if not plugins_dir.is_dir():
        return result
    for entry in sorted(plugins_dir.iterdir()):
        if not entry.is_dir() or entry.name.startswith("_"):
            continue
        manifest = _load_manifest(entry)
        if manifest is not None:
            result.append(manifest)
    return result


@router.get("/plugins/{plugin_id}")
async def get_plugin(plugin_id: str, request: Request) -> dict[str, Any] | None:
    plugins_dir = _plugins_dir(request)
    plugin_dir = plugins_dir / plugin_id
    if not plugin_dir.is_dir():
        return None
    return _load_manifest(plugin_dir)


@router.get("/plugins/{plugin_id}/capabilities")
async def get_capabilities(plugin_id: str, request: Request) -> list[dict[str, Any]]:
    plugins_dir = _plugins_dir(request)
    plugin_dir = plugins_dir / plugin_id
    manifest = _load_manifest(plugin_dir)
    if manifest is None:
        return []
    return manifest.get("capabilities", [])
