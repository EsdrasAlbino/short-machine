import glob
import os
import sys
from typing import Any, Dict
from urllib.parse import quote

from fastapi import APIRouter, HTTPException

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO_ROOT = os.path.dirname(os.path.dirname(BACKEND_DIR))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from pipeline.download_stage import DownloadError  # noqa: E402
from pipeline.download_stage import run as download_run  # noqa: E402
from pipeline.title_stage import extract_handle  # noqa: E402

router = APIRouter(prefix="/api/sample-video", tags=["sample-video"])

RAW_DIR = os.path.join(REPO_ROOT, "raw")


@router.post("")
def get_sample_video(payload: Dict[str, Any]):
    """
    Return a URL for one sample video from the given profile, reusing an
    already-downloaded one when present (same logic as the old Flask
    /preview route's sample-fetch step). The video itself is served from
    the narrow /media/raw static mount (main.py) -- never the whole repo.
    """
    profile_url = (payload.get("profile_url") or "").strip()
    if not profile_url:
        raise HTTPException(status_code=400, detail="profile_url is required")

    handle = extract_handle(profile_url) or "preview"
    raw_dir = os.path.join(RAW_DIR, handle)

    existing = sorted(glob.glob(os.path.join(raw_dir, "*.mp4")))
    if existing:
        sample_path = existing[0]
    else:
        config = {"download": {"profile_url": profile_url, "video_count": 1}}
        try:
            paths = download_run(config, raw_dir)
        except DownloadError as e:
            raise HTTPException(status_code=400, detail=f"Download falhou: {e}")
        if not paths:
            raise HTTPException(status_code=400, detail="Nenhum vídeo encontrado para pré-visualizar")
        sample_path = paths[0]

    relative_path = os.path.relpath(sample_path, RAW_DIR)
    # Filenames routinely contain characters (spaces, '#', unicode) that are
    # meaningful in a URL -- an unencoded '#' in particular gets parsed by
    # the browser as a fragment identifier, silently truncating the rest of
    # the path. Encode each path segment, keeping '/' as the separator.
    encoded_path = "/".join(quote(part) for part in relative_path.split(os.sep))
    return {"video_url": f"/media/raw/{encoded_path}"}
