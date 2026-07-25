import os
import subprocess
import sys

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)

import tiktokBulkDownloader as downloader  # noqa: E402

FILENAME_TEMPLATE = "%(upload_date).10s_%(uploader).50s_%(title).180B.%(ext)s"


class DownloadError(RuntimeError):
    pass


def enumerate_profile_videos(profile_url, count):
    """
    List the URLs of the `count` most recent videos on a TikTok profile via
    yt-dlp's own TikTok extractor (no browser, no scraping bypass involved --
    same class of request yt-dlp already makes for a single video).
    """
    result = subprocess.run(
        ["yt-dlp", "--flat-playlist", "--print", "%(webpage_url)s",
         "--playlist-end", str(count), profile_url],
        capture_output=True, text=True, timeout=120,
    )
    if result.returncode != 0:
        raise DownloadError(f"Failed to list videos for {profile_url}: {result.stderr.strip()[-500:]}")
    return [line.strip() for line in result.stdout.splitlines() if line.strip()]


def resolve_output_path(url, raw_dir):
    """
    Ask yt-dlp what filename a URL would resolve to under FILENAME_TEMPLATE,
    without downloading it. Returns None if metadata can't be fetched.
    """
    output_template = os.path.join(raw_dir, FILENAME_TEMPLATE)
    result = subprocess.run(
        ["yt-dlp", "--no-warnings", "--get-filename", "-o", output_template, url],
        capture_output=True, text=True, timeout=30,
    )
    if result.returncode != 0:
        return None
    return result.stdout.strip()


def run(config, raw_dir):
    """
    Enumerate and download the N most recent videos from a TikTok profile.

    Raises DownloadError if the profile yields zero videos -- there's nothing
    useful the later stages could do, so the whole pipeline run aborts here.
    Videos that already exist in raw_dir from a previous run are left alone
    (yt-dlp skips re-downloading them) but are still included in the returned
    list, since "the last N videos of this profile" is the batch this run is
    meant to process regardless of when each file first landed on disk.
    """
    profile_url = config["download"]["profile_url"]
    video_count = config["download"]["video_count"]

    print(f"[download] Listing last {video_count} video(s) from {profile_url}...")
    urls = enumerate_profile_videos(profile_url, video_count)
    if not urls:
        raise DownloadError(
            f"No videos found for {profile_url} (private account, wrong URL, or empty profile)"
        )
    print(f"[download] Found {len(urls)} video(s).")

    os.makedirs(raw_dir, exist_ok=True)

    expected_paths = []
    for url in urls:
        path = resolve_output_path(url, raw_dir)
        expected_paths.append(path)

    print("[download] Downloading (existing files are skipped automatically)...")
    downloader.download_with_ytdlp(
        urls, raw_dir, use_cookies=False, use_watermark=False, filename_template=FILENAME_TEMPLATE
    )

    video_paths = []
    for url, path in zip(urls, expected_paths):
        if path and os.path.exists(path):
            video_paths.append(path)
        else:
            print(f"[download] WARNING: could not confirm download for {url}, skipping from batch")

    print(f"[download] {len(video_paths)}/{len(urls)} video(s) ready in {raw_dir}")
    return video_paths
