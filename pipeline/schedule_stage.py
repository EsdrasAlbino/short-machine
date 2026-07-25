import os
import time
from datetime import datetime, timedelta, timezone

import requests

MAX_RETRIES = 3


class ScheduleError(RuntimeError):
    pass


class PostizClient:
    """Thin wrapper around the Postiz public upload API and MCP schedule tool."""

    def __init__(self):
        self.upload_url = os.environ.get("POSTIZ_UPLOAD_URL")
        self.mcp_url = os.environ.get("POSTIZ_MCP_URL")
        self.token = os.environ.get("POSTIZ_TOKEN")
        if not (self.upload_url and self.mcp_url and self.token):
            raise ScheduleError(
                "POSTIZ_UPLOAD_URL, POSTIZ_MCP_URL and POSTIZ_TOKEN environment "
                "variables are required"
            )
        self.session_id = None
        self._init_session()

    def _init_session(self):
        response = requests.post(
            self.mcp_url,
            headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream"},
            json={
                "jsonrpc": "2.0", "id": 1, "method": "initialize",
                "params": {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "run_pipeline", "version": "1.0.0"},
                },
            },
            timeout=15,
        )
        response.raise_for_status()
        session_id = response.headers.get("Mcp-Session-Id") or response.headers.get("mcp-session-id")
        if not session_id:
            raise ScheduleError("Postiz MCP did not return a session id on initialize")
        self.session_id = session_id
        requests.post(
            self.mcp_url,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
                "Mcp-Session-Id": session_id,
            },
            json={"jsonrpc": "2.0", "method": "notifications/initialized"},
            timeout=15,
        )

    def upload_video(self, filepath):
        with open(filepath, "rb") as f:
            response = requests.post(
                self.upload_url,
                headers={"Authorization": self.token},
                files={"file": (os.path.basename(filepath), f, "video/mp4")},
                timeout=180,
            )
        response.raise_for_status()
        return response.json().get("path")

    def schedule_post(self, integration_id, video_url, title, date_iso, _retried=False):
        payload = {
            "jsonrpc": "2.0",
            "id": 100,
            "method": "tools/call",
            "params": {
                "name": "integrationSchedulePostTool",
                "arguments": {
                    "socialPost": [
                        {
                            "integrationId": integration_id,
                            "isPremium": False,
                            "date": date_iso,
                            "shortLink": False,
                            "type": "schedule",
                            "postsAndComments": [
                                {"content": f"<p>{title}</p>", "attachments": [video_url]}
                            ],
                            "settings": [
                                {"key": "title", "value": title[:100]},
                                {"key": "type", "value": "public"},
                            ],
                        }
                    ]
                },
            },
        }
        response = requests.post(
            self.mcp_url,
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json, text/event-stream",
                "Mcp-Session-Id": self.session_id,
            },
            json=payload,
            timeout=30,
        )
        text = response.text
        if not _retried and "session id" in text.lower():
            self._init_session()
            return self.schedule_post(integration_id, video_url, title, date_iso, _retried=True)
        return text


def compute_schedule_datetimes(start_date, posts_per_day, times_utc, count):
    times = sorted(times_utc)
    datetimes = []
    for i in range(count):
        day_offset = i // posts_per_day
        slot = i % posts_per_day
        hour, minute = (int(x) for x in times[slot % len(times)].split(":"))
        day = start_date + timedelta(days=day_offset)
        datetimes.append(datetime(day.year, day.month, day.day, hour, minute, tzinfo=timezone.utc))
    return datetimes


def _with_retries(func, description):
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return func()
        except Exception as e:
            print(f"[schedule] Attempt {attempt}/{MAX_RETRIES} failed ({description}): {e}")
            if attempt < MAX_RETRIES:
                time.sleep(2 ** attempt)
    return None


def run(config, video_paths, titles, start_date, dry_run=False):
    """
    Upload and schedule each edited video to the configured Postiz
    integration, distributed across posts_per_day / times_utc slots
    starting at start_date. An upload or schedule failure for one video
    is retried with backoff, then logged as needing manual attention --
    it never blocks the rest of the batch.
    """
    schedule_cfg = config["schedule"]
    integration_id = schedule_cfg["integration_id"]
    posts_per_day = schedule_cfg["posts_per_day"]
    times_utc = schedule_cfg["times_utc"]

    datetimes = compute_schedule_datetimes(start_date, posts_per_day, times_utc, len(video_paths))

    if dry_run:
        print(f"[schedule] --dry-run: would schedule {len(video_paths)} video(s) "
              f"starting {start_date.date()}, skipping Postiz calls")
        for path, title, dt in zip(video_paths, titles, datetimes):
            print(f"[schedule]   {os.path.basename(path)} -> {dt.isoformat()} :: {title}")
        return 0, []

    client = PostizClient()
    succeeded = 0
    failed = []

    print(f"[schedule] Uploading and scheduling {len(video_paths)} video(s)...")
    for i, (video_path, title, dt) in enumerate(zip(video_paths, titles, datetimes), start=1):
        date_iso = dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")

        print(f"[schedule] [{i}/{len(video_paths)}] Uploading {os.path.basename(video_path)}...")
        video_url = _with_retries(lambda p=video_path: client.upload_video(p), "upload")
        if not video_url:
            print(f"[schedule] [{i}/{len(video_paths)}] UPLOAD FAILED")
            failed.append((video_path, "upload failed"))
            continue

        resp = _with_retries(
            lambda: client.schedule_post(integration_id, video_url, title, date_iso),
            "schedule",
        )
        if resp and '"postId"' in resp:
            print(f"[schedule] [{i}/{len(video_paths)}] Scheduled for {date_iso}")
            succeeded += 1
        else:
            print(f"[schedule] [{i}/{len(video_paths)}] SCHEDULE FAILED: {(resp or '')[:300]}")
            failed.append((video_path, "schedule failed"))

    print(f"[schedule] {succeeded}/{len(video_paths)} scheduled successfully")
    if failed:
        print("[schedule] Items needing manual attention:")
        for path, reason in failed:
            print(f"[schedule]   {os.path.basename(path)}: {reason}")

    return succeeded, failed
