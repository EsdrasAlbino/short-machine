import json
import os
import sys
from typing import Any, Dict

from fastapi import APIRouter, HTTPException

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO_ROOT = os.path.dirname(os.path.dirname(BACKEND_DIR))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from pipeline.config import ConfigError, load_config  # noqa: E402
from pipeline_ui.backend.state import CONFIGS_DIR  # noqa: E402

router = APIRouter(prefix="/api/presets", tags=["presets"])


def _preset_path(name):
    return os.path.join(CONFIGS_DIR, f"{name}.json")


def list_presets():
    return sorted(f[:-5] for f in os.listdir(CONFIGS_DIR) if f.endswith(".json"))


def save_and_validate(config: Dict[str, Any]) -> str:
    """Write the preset to disk and re-validate it through the same loader
    run_pipeline.py itself uses, so the UI can never save/launch something
    the CLI would reject."""
    if not config.get("run_name"):
        raise ConfigError("run_name is required")
    path = _preset_path(config["run_name"])
    with open(path, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)
    load_config(path)
    return path


@router.get("")
def get_presets():
    return list_presets()


@router.get("/{name}")
def get_preset(name: str):
    path = _preset_path(name)
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="not found")
    with open(path, encoding="utf-8") as f:
        return json.load(f)


@router.post("")
def create_preset(payload: Dict[str, Any]):
    try:
        save_and_validate(payload)
    except ConfigError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"ok": True, "run_name": payload["run_name"]}
