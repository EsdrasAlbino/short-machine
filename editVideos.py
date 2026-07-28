import os
import sys
import glob
import argparse
import subprocess
import signal
import csv
from datetime import datetime

# Global variable to track results during script execution, mirroring tiktokBulkDownloader.py's pattern
edited_metadata = []

POSITIONS = {
    "top-left": ("20", "20"),
    "top-right": ("W-w-20", "20"),
    "bottom-left": ("20", "H-h-20"),
    "bottom-right": ("W-w-20", "H-h-20"),
    "center": ("(W-w)/2", "(H-h)/2"),
}


def signal_handler(signal_received, frame):
    """
    Handle interruption signals (e.g., Ctrl-C).
    Save the processed metadata to the CSV file before exiting.
    """
    if edited_metadata:
        print("\nScript interrupted! Saving log for processed videos...")
        save_metadata_to_csv()
    print("Exiting gracefully.")
    sys.exit(0)


def save_metadata_to_csv():
    """
    Save the edit results to a timestamped CSV file.
    """
    if not edited_metadata:
        return

    current_time = datetime.now().strftime("%Y-%m-%d_%H-%M")
    csv_file = f"{current_time}_edit_log.csv"

    with open(csv_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(["Input File", "Output File", "Elements Applied", "Status", "Error"])
        writer.writerows(edited_metadata)


def get_video_files(input_dir):
    """
    Return a sorted list of .mp4 files in the input directory.
    """
    return sorted(glob.glob(os.path.join(input_dir, "*.mp4")))


def format_timestamp(seconds):
    """
    Convert seconds (float) to an SRT timestamp string: HH:MM:SS,mmm
    """
    if seconds < 0:
        seconds = 0
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    millis = int(round((seconds - int(seconds)) * 1000))
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def transcribe_to_srt(video_path, srt_path, model_size, whisper_model):
    """
    Transcribe a video's audio with faster-whisper and write an .srt file.

    :param whisper_model: a pre-loaded faster_whisper.WhisperModel instance, reused across videos
    """
    segments, _ = whisper_model.transcribe(video_path, beam_size=5)

    with open(srt_path, "w", encoding="utf-8") as f:
        for index, segment in enumerate(segments, start=1):
            start = format_timestamp(segment.start)
            end = format_timestamp(segment.end)
            text = segment.text.strip()
            f.write(f"{index}\n{start} --> {end}\n{text}\n\n")


def escape_ffmpeg_path(path):
    """
    Escape a filesystem path for safe use inside an ffmpeg filter argument
    (e.g. the `subtitles=` filter), which treats ':' and '\\' as special characters.
    """
    return path.replace("\\", "\\\\").replace(":", "\\:").replace("'", "\\'")


def get_video_resolution(video_path):
    """
    Return (width, height) of a video's first video stream via ffprobe.
    """
    result = subprocess.run(
        ["ffprobe", "-v", "error", "-select_streams", "v:0",
         "-show_entries", "stream=width,height", "-of", "csv=p=0", video_path],
        capture_output=True, text=True,
    )
    width, height = result.stdout.strip().split(",")
    return int(width), int(height)


def compute_delogo_region(width, height, region_fracs):
    """
    Convert a fractional bounding box (x0, y0, x1, y1), each 0-1, into
    absolute pixel x/y/w/h for ffmpeg's delogo filter.
    """
    x0_f, y0_f, x1_f, y1_f = region_fracs
    x = int(x0_f * width)
    y = int(y0_f * height)
    w = int((x1_f - x0_f) * width)
    h = int((y1_f - y0_f) * height)
    return x, y, w, h


def resolve_position(position):
    """
    Resolve an overlay position into an (x, y) ffmpeg overlay expression pair.
    Accepts either a named key into POSITIONS, or an explicit "x,y" pixel
    coordinate string (e.g. "40,1600") for free placement.
    """
    if "," in position:
        x, y = position.split(",", 1)
        return x.strip(), y.strip()
    return POSITIONS[position]


def build_filter_complex(args, input_map, srt_path, delogo_region=None):
    """
    Build the ffmpeg filter_complex graph for one video: (optional source watermark
    removal) -> background -> video -> watermark -> icons -> captions, composited
    in a single pass.

    :param input_map: dict with keys 'video', 'background' (optional), 'watermark' (optional),
                       'icons' (list, optional) mapping to their -i input index
    :param delogo_region: optional (x, y, w, h) pixel box to scrub from the source video
                           before any other compositing, via ffmpeg's delogo filter
    :return: filter_complex string, final output label (e.g. "[outv]")
    """
    filters = []
    video_idx = input_map["video"]
    canvas_w, canvas_h = args.canvas_size.split("x")

    source_label = f"{video_idx}:v"
    if delogo_region:
        x, y, w, h = delogo_region
        filters.append(f"[{video_idx}:v]delogo=x={x}:y={y}:w={w}:h={h}[clean]")
        source_label = "clean"

    if args.background:
        if args.background == "blur":
            # source_label is consumed twice below (blurred backdrop + sharp foreground);
            # ffmpeg requires an explicit split for a label reused across two filter chains,
            # otherwise one branch silently loses upstream filtering (e.g. the delogo pass).
            filters.append(f"[{source_label}]split=2[bgsrc][fgsrc]")
            filters.append(
                f"[bgsrc]scale={canvas_w}:{canvas_h}:force_original_aspect_ratio=increase,"
                f"crop={canvas_w}:{canvas_h},gblur=sigma=20[bg]"
            )
            filters.append(
                f"[fgsrc]scale={canvas_w}:{canvas_h}:force_original_aspect_ratio=decrease[fg]"
            )
        else:
            bg_idx = input_map["background"]
            filters.append(
                f"[{bg_idx}:v]scale={canvas_w}:{canvas_h}:force_original_aspect_ratio=increase,"
                f"crop={canvas_w}:{canvas_h}[bg]"
            )
            filters.append(
                f"[{source_label}]scale={canvas_w}:{canvas_h}:force_original_aspect_ratio=decrease[fg]"
            )
        filters.append("[bg][fg]overlay=(W-w)/2:(H-h)/2[base0]")
        current_label = "base0"
    else:
        filters.append(f"[{source_label}]null[base0]")
        current_label = "base0"

    stage = 1

    if args.watermark:
        wm_idx = input_map["watermark"]
        x, y = resolve_position(args.watermark_position)
        if args.watermark_opacity < 1.0:
            filters.append(f"[{wm_idx}:v]format=rgba,colorchannelmixer=aa={args.watermark_opacity}[wm]")
            wm_label = "wm"
        else:
            filters.append(f"[{wm_idx}:v]format=rgba[wm]")
            wm_label = "wm"
        next_label = f"base{stage}"
        filters.append(f"[{current_label}][{wm_label}]overlay={x}:{y}[{next_label}]")
        current_label = next_label
        stage += 1

    for icon_idx, position in zip(input_map.get("icons", []), args.icon_position):
        x, y = resolve_position(position)
        next_label = f"base{stage}"
        filters.append(f"[{current_label}][{icon_idx}:v]overlay={x}:{y}[{next_label}]")
        current_label = next_label
        stage += 1

    if srt_path:
        escaped = escape_ffmpeg_path(os.path.abspath(srt_path))
        next_label = "outv"
        filters.append(f"[{current_label}]subtitles='{escaped}'[{next_label}]")
        current_label = next_label
    else:
        # Relabel the last stage as the output so callers can always map "[outv]"
        filters[-1] = filters[-1].replace(f"[{current_label}]", "[outv]")
        current_label = "outv"

    return ";".join(filters), f"[{current_label}]"


def process_video(video_path, args, whisper_model, output_dir):
    """
    Transcribe (optional) and composite one video, writing the result to output_dir.
    Appends a row to the global edited_metadata log.
    """
    basename = os.path.splitext(os.path.basename(video_path))[0]
    elements = []
    srt_path = None

    try:
        if args.caption or args.srt_only:
            srt_path = os.path.join(output_dir, f"{basename}.srt")
            transcribe_to_srt(video_path, srt_path, args.model, whisper_model)
            elements.append("captions")

        if args.srt_only:
            edited_metadata.append([video_path, srt_path, "captions (srt only)", "success", ""])
            print(f"Generated subtitles: {srt_path}")
            return

        cmd = ["ffmpeg", "-y", "-i", video_path]
        input_map = {"video": 0}
        next_idx = 1

        if args.background and args.background != "blur":
            cmd += ["-i", args.background]
            input_map["background"] = next_idx
            next_idx += 1

        if args.watermark:
            cmd += ["-i", args.watermark]
            input_map["watermark"] = next_idx
            next_idx += 1
            elements.append("watermark")

        if args.icons:
            input_map["icons"] = []
            for icon in args.icons:
                cmd += ["-i", icon]
                input_map["icons"].append(next_idx)
                next_idx += 1
            elements.append(f"icons({len(args.icons)})")

        if args.background:
            elements.append(f"background({args.background})")

        delogo_region = None
        if args.remove_source_watermark:
            width, height = get_video_resolution(video_path)
            region_fracs = tuple(float(v) for v in args.source_watermark_region.split(","))
            delogo_region = compute_delogo_region(width, height, region_fracs)
            elements.append("source-watermark-removed")

        filter_complex, out_label = build_filter_complex(
            args, input_map, srt_path if args.caption else None, delogo_region
        )

        output_path = os.path.join(output_dir, f"{basename}.mp4")
        cmd += [
            "-filter_complex", filter_complex,
            "-map", out_label,
            "-map", "0:a?",
            # veryfast trades some compression efficiency for a large drop in
            # encode CPU time -- default "medium" was saturating every core
            # on the shared server during large batches, starving Coolify's
            # other apps (Postiz, n8n, Metabase) running on the same host.
            "-c:v", "libx264", "-preset", "veryfast", "-c:a", "aac",
            output_path,
        ]

        result = subprocess.run(cmd, capture_output=True, text=True)
        if result.returncode != 0:
            raise RuntimeError(result.stderr[-2000:])

        edited_metadata.append([video_path, output_path, ", ".join(elements) or "none", "success", ""])
        print(f"Edited: {output_path}")

    except Exception as e:
        edited_metadata.append([video_path, "", ", ".join(elements) or "none", "failed", str(e)])
        print(f"Failed to process {video_path}: {e}")


def parse_args():
    parser = argparse.ArgumentParser(
        description="Batch-add captions, watermark, icons, and a background frame to downloaded TikTok videos."
    )
    parser.add_argument("--input-dir", default=".", help="Directory containing the downloaded .mp4 files")
    parser.add_argument("--output-dir", default="edited", help="Directory to save the edited videos")
    parser.add_argument("--caption", action="store_true", help="Transcribe and burn in captions")
    parser.add_argument("--srt-only", action="store_true", help="Only generate .srt files, skip video composition")
    parser.add_argument("--model", default="small", help="faster-whisper model size (tiny/base/small/medium/large-v3)")
    parser.add_argument("--background", default=None,
                         help="Path to a background image, or 'blur' to auto-generate a blurred backdrop from the video itself")
    parser.add_argument("--canvas-size", default="1080x1920", help="Output canvas size, e.g. 1080x1920")
    parser.add_argument("--watermark", default=None, help="Path to a watermark PNG (with transparency)")
    parser.add_argument("--watermark-position", default="bottom-right",
                         help="Named position (%s) or an explicit 'x,y' pixel coordinate" % ", ".join(POSITIONS.keys()))
    parser.add_argument("--watermark-opacity", type=float, default=1.0, help="Watermark opacity, 0.0-1.0")
    parser.add_argument("--icons", nargs="*", default=[], help="Paths to icon PNGs (fixed across the whole batch)")
    parser.add_argument("--icon-position", nargs="*", default=[],
                         help="One position per icon, same order as --icons")
    parser.add_argument("--remove-source-watermark", action="store_true",
                         help="Scrub a burned-in watermark from the source video (e.g. a creator's own "
                              "username overlay) using ffmpeg's delogo filter before any other compositing")
    parser.add_argument("--source-watermark-region", default="0.35,0.935,0.68,0.99",
                         help="Fractional bounding box 'x0,y0,x1,y1' (0-1 of width/height) of the region "
                              "to scrub, scaled per-video via ffprobe. Default matches this creator's "
                              "fixed bottom-center @handle watermark position.")
    return parser.parse_args()


def main():
    signal.signal(signal.SIGINT, signal_handler)
    args = parse_args()

    if args.icons and len(args.icons) != len(args.icon_position):
        print("Error: --icon-position must list exactly one position per --icons entry.")
        sys.exit(1)

    videos = get_video_files(args.input_dir)
    if not videos:
        print(f"No .mp4 files found in {args.input_dir}")
        sys.exit(1)

    os.makedirs(args.output_dir, exist_ok=True)

    whisper_model = None
    if args.caption or args.srt_only:
        from faster_whisper import WhisperModel
        print(f"Loading faster-whisper model '{args.model}'...")
        whisper_model = WhisperModel(args.model, device="cpu", compute_type="int8")

    print(f"Processing {len(videos)} video(s)...")
    for video_path in videos:
        process_video(video_path, args, whisper_model, args.output_dir)

    save_metadata_to_csv()
    print("Done.")


if __name__ == "__main__":
    main()
