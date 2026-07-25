import argparse
import os
import sys
from datetime import datetime

from dotenv import load_dotenv

from pipeline.config import ConfigError, load_config
from pipeline.download_stage import DownloadError
from pipeline.download_stage import run as download_run
from pipeline.edit_stage import run as edit_run
from pipeline.schedule_stage import ScheduleError
from pipeline.schedule_stage import run as schedule_run
from pipeline.title_stage import TitleGenError, extract_handle
from pipeline.title_stage import run as title_run

REPO_ROOT = os.path.dirname(os.path.abspath(__file__))


def parse_args():
    parser = argparse.ArgumentParser(
        description="Run the full TikTok -> Postiz content pipeline: download, edit, "
                     "generate titles, and schedule in one command."
    )
    parser.add_argument("--config", required=True, help="Path to the run config JSON file")
    parser.add_argument(
        "--start-date", default=None,
        help="Schedule start date, YYYY-MM-DD. Prompted interactively if omitted.",
    )
    parser.add_argument(
        "--dry-run", action="store_true",
        help="Run download/edit/title stages normally, but skip the Postiz upload/schedule calls",
    )
    return parser.parse_args()


def resolve_start_date(args):
    if args.start_date:
        return datetime.strptime(args.start_date, "%Y-%m-%d")
    raw = input("Data de início do agendamento (YYYY-MM-DD): ").strip()
    return datetime.strptime(raw, "%Y-%m-%d")


def main():
    load_dotenv()
    args = parse_args()

    try:
        config = load_config(args.config)
    except ConfigError as e:
        print(f"Config error: {e}")
        sys.exit(1)

    try:
        start_date = resolve_start_date(args)
    except ValueError:
        print("Error: start date must be in YYYY-MM-DD format")
        sys.exit(1)

    run_name = config["run_name"]
    profile_handle = extract_handle(config["download"]["profile_url"]) or run_name
    raw_dir = os.path.join(REPO_ROOT, "raw", profile_handle)
    edited_dir = os.path.join(REPO_ROOT, "edited", run_name)

    print(f"=== Pipeline run '{run_name}' ===")

    try:
        video_paths = download_run(config, raw_dir)
    except DownloadError as e:
        print(f"[download] ABORTED: {e}")
        sys.exit(1)

    edited_paths = edit_run(config, video_paths, edited_dir)
    if not edited_paths:
        print("No videos survived editing, nothing to schedule. Exiting.")
        sys.exit(1)

    try:
        titles = title_run(config, edited_paths)
    except TitleGenError as e:
        print(f"[title] ABORTED: {e}")
        sys.exit(1)

    try:
        succeeded, failed = schedule_run(config, edited_paths, titles, start_date, dry_run=args.dry_run)
    except ScheduleError as e:
        print(f"[schedule] ABORTED: {e}")
        sys.exit(1)

    print("=== Pipeline run complete ===")
    if not args.dry_run:
        print(f"Scheduled: {succeeded}/{len(edited_paths)}")
        if failed:
            print(f"Needs manual attention: {len(failed)}")
            sys.exit(2)


if __name__ == "__main__":
    main()
