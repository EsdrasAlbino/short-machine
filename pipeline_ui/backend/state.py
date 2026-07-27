import os

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PIPELINE_UI_DIR = os.path.dirname(BACKEND_DIR)
REPO_ROOT = os.path.dirname(PIPELINE_UI_DIR)

CONFIGS_DIR = os.path.join(BACKEND_DIR, "configs")
RUNS_DIR = os.path.join(BACKEND_DIR, "runs")
PREVIEWS_DIR = os.path.join(BACKEND_DIR, "previews")
RUN_PIPELINE_SCRIPT = os.path.join(REPO_ROOT, "run_pipeline.py")

os.makedirs(CONFIGS_DIR, exist_ok=True)
os.makedirs(RUNS_DIR, exist_ok=True)
os.makedirs(PREVIEWS_DIR, exist_ok=True)

# Single active run tracked in memory: {"run_id": str, "process": Popen, "log_path": str}
ACTIVE_RUN = {}


def is_run_active():
    process = ACTIVE_RUN.get("process")
    return process is not None and process.poll() is None
