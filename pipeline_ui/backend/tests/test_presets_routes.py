import pytest
from fastapi.testclient import TestClient

from pipeline_ui.backend.main import app
from pipeline_ui.backend.routes import presets

VALID_CONFIG = {
    "run_name": "test-preset",
    "download": {"profile_url": "https://www.tiktok.com/@x", "video_count": 1},
    "edit": {"captions_enabled": False},
    "schedule": {"integration_id": "abc", "posts_per_day": 1, "times_utc": ["15:00"]},
}


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(presets, "CONFIGS_DIR", str(tmp_path))
    return TestClient(app)


def test_save_then_list_and_load_round_trips(client):
    res = client.post("/api/presets", json=VALID_CONFIG)
    assert res.status_code == 200
    assert res.json() == {"ok": True, "run_name": "test-preset"}

    res = client.get("/api/presets")
    assert res.json() == ["test-preset"]

    res = client.get("/api/presets/test-preset")
    assert res.json() == VALID_CONFIG


def test_get_missing_preset_returns_404(client):
    res = client.get("/api/presets/does-not-exist")
    assert res.status_code == 404


def test_save_without_run_name_returns_400(client):
    bad_config = dict(VALID_CONFIG)
    bad_config["run_name"] = ""
    res = client.post("/api/presets", json=bad_config)
    assert res.status_code == 400


def test_save_with_invalid_config_returns_400(client):
    bad_config = dict(VALID_CONFIG)
    bad_config["download"] = {"profile_url": "x"}  # missing video_count
    res = client.post("/api/presets", json=bad_config)
    assert res.status_code == 400
