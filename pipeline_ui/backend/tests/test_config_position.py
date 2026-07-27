import json

import pytest

from pipeline.config import ConfigError, load_config

BASE_CONFIG = {
    "run_name": "test",
    "download": {"profile_url": "https://www.tiktok.com/@x", "video_count": 1},
    "edit": {"captions_enabled": False},
    "schedule": {"integration_id": "abc", "posts_per_day": 1, "times_utc": ["15:00"]},
}


def _write_config(tmp_path, edit_overrides):
    config = json.loads(json.dumps(BASE_CONFIG))
    config["edit"].update(edit_overrides)
    path = tmp_path / "config.json"
    path.write_text(json.dumps(config), encoding="utf-8")
    return str(path)


def test_position_absent_is_valid(tmp_path):
    path = _write_config(tmp_path, {})
    load_config(path)  # no raise


def test_position_explicit_dict_is_valid(tmp_path):
    path = _write_config(tmp_path, {"icon_position": {"x": 900, "y": 60}})
    load_config(path)  # no raise


def test_position_legacy_string_is_valid(tmp_path):
    path = _write_config(tmp_path, {"logo_position": "bottom-right"})
    load_config(path)  # no raise


def test_position_dict_missing_y_raises(tmp_path):
    path = _write_config(tmp_path, {"icon_position": {"x": 900}})
    with pytest.raises(ConfigError):
        load_config(path)


def test_position_invalid_type_raises(tmp_path):
    path = _write_config(tmp_path, {"icon_position": 42})
    with pytest.raises(ConfigError):
        load_config(path)
