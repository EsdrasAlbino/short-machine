import os

import pytest
from fastapi.testclient import TestClient

from pipeline_ui.backend.main import app
from pipeline_ui.backend.routes import presets, runs
from pipeline_ui.backend.state import ACTIVE_RUN

VALID_CONFIG = {
    "run_name": "test-run",
    "download": {"profile_url": "https://www.tiktok.com/@x", "video_count": 1},
    "edit": {"captions_enabled": False},
    "schedule": {"integration_id": "abc", "posts_per_day": 1, "times_utc": ["15:00"]},
}


class FakeProcess:
    def __init__(self, returncode=None):
        self.returncode = returncode

    def poll(self):
        return self.returncode


@pytest.fixture(autouse=True)
def _reset_active_run():
    ACTIVE_RUN.clear()
    yield
    ACTIVE_RUN.clear()


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(presets, "CONFIGS_DIR", str(tmp_path / "configs"))
    os.makedirs(str(tmp_path / "configs"), exist_ok=True)
    monkeypatch.setattr(runs, "RUNS_DIR", str(tmp_path / "runs"))
    os.makedirs(str(tmp_path / "runs"), exist_ok=True)
    return TestClient(app)


def test_start_run_launches_and_returns_run_id(client, monkeypatch):
    monkeypatch.setattr(runs, "_launch_process", lambda cmd, log_path: FakeProcess(returncode=None))

    res = client.post("/api/runs", json={"config": VALID_CONFIG, "start_date": "2026-08-01"})
    assert res.status_code == 200
    assert "run_id" in res.json()


def test_start_run_without_start_date_returns_400(client):
    res = client.post("/api/runs", json={"config": VALID_CONFIG, "start_date": ""})
    assert res.status_code == 400


def test_second_run_while_active_returns_409(client, monkeypatch):
    monkeypatch.setattr(runs, "_launch_process", lambda cmd, log_path: FakeProcess(returncode=None))

    res1 = client.post("/api/runs", json={"config": VALID_CONFIG, "start_date": "2026-08-01"})
    assert res1.status_code == 200

    res2 = client.post("/api/runs", json={"config": VALID_CONFIG, "start_date": "2026-08-01"})
    assert res2.status_code == 409


def test_stream_replays_log_and_sends_done(client, monkeypatch, tmp_path):
    run_id = "20260101_000000_abcdef"
    log_path = tmp_path / "runs" / f"{run_id}.log"
    log_path.write_text("line one\nline two\n", encoding="utf-8")

    ACTIVE_RUN["run_id"] = run_id
    ACTIVE_RUN["process"] = FakeProcess(returncode=0)  # already finished

    res = client.get(f"/api/runs/{run_id}/stream")
    assert res.status_code == 200
    body = res.text
    assert "data: line one" in body
    assert "data: line two" in body
    assert "event: done" in body
    assert "data: 0" in body


def test_stream_missing_run_returns_404(client):
    res = client.get("/api/runs/does-not-exist/stream")
    assert res.status_code == 404
