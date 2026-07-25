import argparse
import os
import sys

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

import editVideos as editor  # noqa: E402

DEFAULT_WATERMARK_POSITION = "bottom-right"
DEFAULT_ICON_POSITION = "top-left"
DEFAULT_CANVAS_SIZE = "1080x1920"
DEFAULT_WHISPER_MODEL = "small"


def run(config, video_paths, output_dir):
    """
    Edit each downloaded video: remove the source creator's burned-in
    watermark, add a blurred background frame, overlay the client's
    logo/icon, and optionally burn in auto-generated captions.

    Reuses editVideos.process_video unchanged -- only the branding paths
    come from config instead of CLI flags. A video that fails (corrupt
    file, ffmpeg error) is skipped and logged; process_video already
    catches and logs per-video exceptions itself, so the rest of the
    batch continues.
    """
    edit_cfg = config["edit"]
    os.makedirs(output_dir, exist_ok=True)

    whisper_model = None
    if edit_cfg["captions_enabled"]:
        from faster_whisper import WhisperModel
        print(f"[edit] Loading faster-whisper model '{DEFAULT_WHISPER_MODEL}'...")
        whisper_model = WhisperModel(DEFAULT_WHISPER_MODEL, device="cpu", compute_type="int8")

    icon_path = edit_cfg.get("icon_path")
    # Defaults to on (matches the football videos) for presets saved before
    # this option existed; explicit false turns it off.
    background_blur = edit_cfg.get("background_blur", True)
    args = argparse.Namespace(
        caption=edit_cfg["captions_enabled"],
        srt_only=False,
        model=DEFAULT_WHISPER_MODEL,
        background="blur" if background_blur else None,
        canvas_size=DEFAULT_CANVAS_SIZE,
        watermark=edit_cfg.get("logo_path"),
        watermark_position=DEFAULT_WATERMARK_POSITION,
        watermark_opacity=1.0,
        icons=[icon_path] if icon_path else [],
        icon_position=[DEFAULT_ICON_POSITION] if icon_path else [],
        remove_source_watermark=bool(edit_cfg.get("watermark_region")),
        source_watermark_region=edit_cfg.get("watermark_region"),
    )

    edited_paths = []
    print(f"[edit] Processing {len(video_paths)} video(s)...")
    for i, video_path in enumerate(video_paths, start=1):
        basename = os.path.splitext(os.path.basename(video_path))[0]
        output_path = os.path.join(output_dir, f"{basename}.mp4")

        if os.path.exists(output_path):
            print(f"[edit] [{i}/{len(video_paths)}] Already edited, skipping: {basename}")
            edited_paths.append(output_path)
            continue

        print(f"[edit] [{i}/{len(video_paths)}] {basename}")
        editor.process_video(video_path, args, whisper_model, output_dir)

        if os.path.exists(output_path):
            edited_paths.append(output_path)
        else:
            print(f"[edit] [{i}/{len(video_paths)}] FAILED, skipping from batch: {basename}")

    print(f"[edit] {len(edited_paths)}/{len(video_paths)} video(s) edited successfully")
    return edited_paths
