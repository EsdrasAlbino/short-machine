import json
import os

REQUIRED_FIELDS = {
    "run_name": str,
    "download": dict,
    "edit": dict,
    "schedule": dict,
}

REQUIRED_DOWNLOAD_FIELDS = {"profile_url": str, "video_count": int}
REQUIRED_EDIT_FIELDS = {"captions_enabled": bool}
REQUIRED_SCHEDULE_FIELDS = {"integration_id": str, "posts_per_day": int, "times_utc": list}


class ConfigError(ValueError):
    pass


def _check_fields(section_name, section, required):
    for field, expected_type in required.items():
        if field not in section:
            raise ConfigError(f"Config error: '{section_name}.{field}' is required")
        if not isinstance(section[field], expected_type):
            raise ConfigError(
                f"Config error: '{section_name}.{field}' must be of type {expected_type.__name__}"
            )


def load_config(config_path):
    """
    Load and validate a run_pipeline.py config JSON file.
    Raises ConfigError with a clear message on any missing/invalid field.
    """
    if not os.path.exists(config_path):
        raise ConfigError(f"Config file not found: {config_path}")

    with open(config_path, encoding="utf-8") as f:
        try:
            config = json.load(f)
        except json.JSONDecodeError as e:
            raise ConfigError(f"Config file is not valid JSON: {e}")

    _check_fields("<root>", config, REQUIRED_FIELDS)
    _check_fields("download", config["download"], REQUIRED_DOWNLOAD_FIELDS)
    _check_fields("edit", config["edit"], REQUIRED_EDIT_FIELDS)
    _check_fields("schedule", config["schedule"], REQUIRED_SCHEDULE_FIELDS)

    if config["download"]["video_count"] <= 0:
        raise ConfigError("Config error: 'download.video_count' must be a positive integer")

    if not config["schedule"]["times_utc"]:
        raise ConfigError("Config error: 'schedule.times_utc' must have at least one entry")

    return config
