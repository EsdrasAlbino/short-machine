import os
import re
import time

import requests

ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"
ANTHROPIC_MODEL = "claude-haiku-4-5-20251001"
MAX_RETRIES = 3

SYSTEM_PROMPT = (
    "Você traduz descrições de vídeos de futebol do inglês para um título "
    "envolvente em português do Brasil, no estilo de conteúdo viral de redes "
    "sociais. Mantenha as hashtags do final (em inglês, como estão). Responda "
    "APENAS com o título final, sem aspas, sem explicação, sem markdown."
)


class TitleGenError(RuntimeError):
    pass


def extract_handle(profile_url):
    m = re.search(r"@([\w.]+)", profile_url)
    return m.group(1) if m else None


def extract_source_text(video_path, profile_handle):
    """
    Recover the original (English) title text from a filename produced by
    tiktokBulkDownloader.py's default preset (YYYYMMDD_uploader_title.mp4),
    stripping the date + uploader prefix so only the title/hashtags remain.
    """
    name = os.path.splitext(os.path.basename(video_path))[0]
    if profile_handle:
        m = re.match(r"^\d{8}_" + re.escape(profile_handle) + r"_", name)
        if m:
            return name[m.end():]
    return name


def _call_anthropic(source_text, api_key):
    response = requests.post(
        ANTHROPIC_API_URL,
        headers={
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "content-type": "application/json",
        },
        json={
            "model": ANTHROPIC_MODEL,
            "max_tokens": 200,
            "system": SYSTEM_PROMPT,
            "messages": [{"role": "user", "content": source_text}],
        },
        timeout=30,
    )
    response.raise_for_status()
    data = response.json()
    return data["content"][0]["text"].strip()


def generate_title(video_path, profile_handle, api_key):
    """
    Generate a Portuguese title for one video via the Anthropic API, retrying
    with backoff. Falls back to the cleaned source filename text if the API
    keeps failing -- title generation never blocks the batch, since the
    title can always be edited later in Postiz before it publishes.
    """
    source_text = extract_source_text(video_path, profile_handle)

    for attempt in range(1, MAX_RETRIES + 1):
        try:
            return _call_anthropic(source_text, api_key)
        except Exception as e:
            print(f"[title] Attempt {attempt}/{MAX_RETRIES} failed for {os.path.basename(video_path)}: {e}")
            if attempt < MAX_RETRIES:
                time.sleep(2 ** attempt)

    print(f"[title] All attempts failed, using filename text for {os.path.basename(video_path)}")
    return source_text


def run(config, video_paths):
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise TitleGenError("ANTHROPIC_API_KEY environment variable is not set")

    profile_handle = extract_handle(config["download"]["profile_url"])

    titles = []
    print(f"[title] Generating titles for {len(video_paths)} video(s)...")
    for i, video_path in enumerate(video_paths, start=1):
        title = generate_title(video_path, profile_handle, api_key)
        print(f"[title] [{i}/{len(video_paths)}] {title}")
        titles.append(title)

    return titles
