import os
import subprocess
import sys
import time
import uuid
from datetime import datetime
from typing import Any, Dict

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO_ROOT = os.path.dirname(os.path.dirname(BACKEND_DIR))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from pipeline.config import ConfigError  # noqa: E402
from pipeline_ui.backend.routes.presets import save_and_validate  # noqa: E402
from pipeline_ui.backend.state import ACTIVE_RUN, RUNS_DIR, RUN_PIPELINE_SCRIPT, is_run_active  # noqa: E402

router = APIRouter(prefix="/api/runs", tags=["runs"])


def _launch_process(cmd, log_path):
    # -u: run_pipeline.py's stdout is redirected to a file here, not a
    # terminal, so Python would otherwise fully buffer it in large blocks --
    # the live log would sit empty for a long time even while the process is
    # working normally.
    log_file = open(log_path, "w", encoding="utf-8")
    return subprocess.Popen(cmd, cwd=REPO_ROOT, stdout=log_file, stderr=subprocess.STDOUT, text=True)


@router.post("")
def start_run(payload: Dict[str, Any]):
    if is_run_active():
        raise HTTPException(status_code=409, detail="Já existe uma execução em andamento")

    config = payload.get("config") or {}
    start_date = (payload.get("start_date") or "").strip()
    dry_run = bool(payload.get("dry_run"))

    if not start_date:
        raise HTTPException(status_code=400, detail="start_date is required")

    try:
        path = save_and_validate(config)
    except ConfigError as e:
        raise HTTPException(status_code=400, detail=str(e))

    run_id = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
    log_path = os.path.join(RUNS_DIR, f"{run_id}.log")

    cmd = [sys.executable, "-u", RUN_PIPELINE_SCRIPT, "--config", path, "--start-date", start_date]
    if dry_run:
        cmd.append("--dry-run")

    process = _launch_process(cmd, log_path)

    ACTIVE_RUN["run_id"] = run_id
    ACTIVE_RUN["process"] = process
    ACTIVE_RUN["log_path"] = log_path

    return {"ok": True, "run_id": run_id}


def _is_this_run_active(run_id):
    return (
        ACTIVE_RUN.get("run_id") == run_id
        and ACTIVE_RUN.get("process") is not None
        and ACTIVE_RUN["process"].poll() is None
    )


def _generate_log_stream(run_id, log_path):
    with open(log_path, encoding="utf-8") as f:
        while True:
            line = f.readline()
            if line:
                yield f"data: {line.rstrip(chr(10))}\n\n"
                continue
            if _is_this_run_active(run_id):
                time.sleep(0.5)
                continue
            exit_code = (
                ACTIVE_RUN["process"].returncode
                if ACTIVE_RUN.get("run_id") == run_id and ACTIVE_RUN.get("process")
                else 0
            )
            yield f"event: done\ndata: {exit_code}\n\n"
            break


@router.get("/{run_id}/stream")
def stream_run(run_id: str):
    log_path = os.path.join(RUNS_DIR, f"{run_id}.log")
    if not os.path.exists(log_path):
        raise HTTPException(status_code=404, detail="Execução não encontrada")
    return StreamingResponse(_generate_log_stream(run_id, log_path), media_type="text/event-stream")
