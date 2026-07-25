import json
import os
import subprocess
import sys
import time
import uuid
from datetime import datetime

from dotenv import load_dotenv
from flask import Flask, Response, jsonify, render_template, request

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from pipeline.config import ConfigError, load_config  # noqa: E402

load_dotenv(os.path.join(REPO_ROOT, ".env"))

APP_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIGS_DIR = os.path.join(APP_DIR, "configs")
RUNS_DIR = os.path.join(APP_DIR, "runs")
RUN_PIPELINE_SCRIPT = os.path.join(REPO_ROOT, "run_pipeline.py")

os.makedirs(CONFIGS_DIR, exist_ok=True)
os.makedirs(RUNS_DIR, exist_ok=True)

app = Flask(__name__)

# Single active run tracked in memory: {"run_id": str, "process": Popen, "log_path": str}
ACTIVE_RUN = {}


def list_presets():
    return sorted(f[:-5] for f in os.listdir(CONFIGS_DIR) if f.endswith(".json"))


def preset_path(name):
    return os.path.join(CONFIGS_DIR, f"{name}.json")


def load_preset(name):
    with open(preset_path(name), encoding="utf-8") as f:
        return json.load(f)


def config_from_form(form):
    times_utc = [t.strip() for t in form.get("times_utc", "").split(",") if t.strip()]
    return {
        "run_name": form.get("run_name", "").strip(),
        "download": {
            "profile_url": form.get("profile_url", "").strip(),
            "video_count": int(form.get("video_count") or 0),
        },
        "edit": {
            "logo_path": form.get("logo_path", "").strip(),
            "icon_path": form.get("icon_path", "").strip(),
            "watermark_region": form.get("watermark_region", "").strip(),
            "captions_enabled": form.get("captions_enabled") == "on",
            "background_blur": form.get("background_blur") == "on",
        },
        "schedule": {
            "integration_id": form.get("integration_id", "").strip(),
            "posts_per_day": int(form.get("posts_per_day") or 0),
            "times_utc": times_utc,
        },
    }


def is_run_active():
    process = ACTIVE_RUN.get("process")
    return process is not None and process.poll() is None


def save_and_validate(config):
    """Write the preset to disk and re-validate it through the same loader
    run_pipeline.py itself uses, so the UI can never save/launch something
    the CLI would reject."""
    if not config["run_name"]:
        raise ConfigError("run_name is required")
    path = preset_path(config["run_name"])
    with open(path, "w", encoding="utf-8") as f:
        json.dump(config, f, ensure_ascii=False, indent=2)
    load_config(path)
    return path


@app.route("/")
def index():
    return render_template(
        "form.html",
        presets=list_presets(),
        active_run_id=ACTIVE_RUN.get("run_id") if is_run_active() else None,
    )


@app.route("/api/presets/<name>")
def api_get_preset(name):
    try:
        return jsonify(load_preset(name))
    except FileNotFoundError:
        return jsonify({"error": "not found"}), 404


@app.route("/save-preset", methods=["POST"])
def save_preset():
    config = config_from_form(request.form)
    try:
        save_and_validate(config)
    except ConfigError as e:
        return jsonify({"error": str(e)}), 400
    return jsonify({"ok": True, "run_name": config["run_name"]})


@app.route("/run", methods=["POST"])
def start_run():
    if is_run_active():
        return jsonify({"error": "Já existe uma execução em andamento"}), 409

    config = config_from_form(request.form)
    start_date = request.form.get("start_date", "").strip()
    dry_run = request.form.get("dry_run") == "on"

    if not start_date:
        return jsonify({"error": "start_date is required"}), 400

    try:
        path = save_and_validate(config)
    except ConfigError as e:
        return jsonify({"error": str(e)}), 400

    run_id = f"{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"
    log_path = os.path.join(RUNS_DIR, f"{run_id}.log")

    cmd = [sys.executable, RUN_PIPELINE_SCRIPT, "--config", path, "--start-date", start_date]
    if dry_run:
        cmd.append("--dry-run")

    log_file = open(log_path, "w", encoding="utf-8")
    process = subprocess.Popen(cmd, cwd=REPO_ROOT, stdout=log_file, stderr=subprocess.STDOUT, text=True)

    ACTIVE_RUN["run_id"] = run_id
    ACTIVE_RUN["process"] = process
    ACTIVE_RUN["log_path"] = log_path

    return jsonify({"ok": True, "run_id": run_id})


@app.route("/run/<run_id>")
def view_run(run_id):
    log_path = os.path.join(RUNS_DIR, f"{run_id}.log")
    if not os.path.exists(log_path):
        return "Execução não encontrada", 404
    return render_template("run.html", run_id=run_id)


@app.route("/run/<run_id>/stream")
def stream_run(run_id):
    log_path = os.path.join(RUNS_DIR, f"{run_id}.log")
    if not os.path.exists(log_path):
        return "Execução não encontrada", 404

    def is_this_run_active():
        return (
            ACTIVE_RUN.get("run_id") == run_id
            and ACTIVE_RUN.get("process") is not None
            and ACTIVE_RUN["process"].poll() is None
        )

    def generate():
        with open(log_path, encoding="utf-8") as f:
            while True:
                line = f.readline()
                if line:
                    yield f"data: {line.rstrip(chr(10))}\n\n"
                    continue
                if is_this_run_active():
                    time.sleep(0.5)
                    continue
                exit_code = (
                    ACTIVE_RUN["process"].returncode
                    if ACTIVE_RUN.get("run_id") == run_id and ACTIVE_RUN.get("process")
                    else 0
                )
                yield f"event: done\ndata: {exit_code}\n\n"
                break

    return Response(generate(), mimetype="text/event-stream")


if __name__ == "__main__":
    app.run(port=5050, debug=False, threaded=True)
