import os

import pytest
from fastapi.testclient import TestClient

from pipeline.download_stage import DownloadError
from pipeline_ui.backend.main import app
from pipeline_ui.backend.routes import sample_video


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(sample_video, "RAW_DIR", str(tmp_path))
    return TestClient(app)


def test_missing_profile_url_returns_400(client):
    res = client.post("/api/sample-video", json={})
    assert res.status_code == 400


def test_reuses_existing_sample_video(client, tmp_path, monkeypatch):
    handle_dir = tmp_path / "someuser"
    handle_dir.mkdir()
    (handle_dir / "20260101_someuser_title.mp4").write_bytes(b"fake video")

    def _fail_if_called(*args, **kwargs):
        raise AssertionError("download_run should not be called when a sample already exists")

    monkeypatch.setattr(sample_video, "download_run", _fail_if_called)

    res = client.post("/api/sample-video", json={"profile_url": "https://www.tiktok.com/@someuser"})
    assert res.status_code == 200
    assert res.json() == {"video_url": "/media/raw/someuser/20260101_someuser_title.mp4"}


def test_downloads_when_no_sample_exists(client, monkeypatch):
    def _fake_download_run(config, raw_dir):
        os.makedirs(raw_dir, exist_ok=True)
        path = os.path.join(raw_dir, "20260101_newuser_title.mp4")
        with open(path, "wb") as f:
            f.write(b"fake video")
        return [path]

    monkeypatch.setattr(sample_video, "download_run", _fake_download_run)

    res = client.post("/api/sample-video", json={"profile_url": "https://www.tiktok.com/@newuser"})
    assert res.status_code == 200
    assert res.json() == {"video_url": "/media/raw/newuser/20260101_newuser_title.mp4"}


def test_download_error_returns_400(client, monkeypatch):
    def _fake_download_run(config, raw_dir):
        raise DownloadError("profile not found")

    monkeypatch.setattr(sample_video, "download_run", _fake_download_run)

    res = client.post("/api/sample-video", json={"profile_url": "https://www.tiktok.com/@ghost"})
    assert res.status_code == 400
    assert "profile not found" in res.json()["detail"]
