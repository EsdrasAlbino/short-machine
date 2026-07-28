# --- Stage 1: build the React frontend ---
FROM node:20-slim AS frontend-build
WORKDIR /app/pipeline_ui/frontend
COPY pipeline_ui/frontend/package.json pipeline_ui/frontend/package-lock.json ./
RUN npm ci
COPY pipeline_ui/frontend/ ./
RUN npm run build

# --- Stage 2: Python backend + pipeline, serving the built frontend ---
FROM python:3.13-slim AS final
WORKDIR /app

# ffmpeg is a hard runtime dependency of editVideos.py (and yt-dlp uses it
# for format merging); git is occasionally needed by yt-dlp's own updater.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Application code (raw/, edited/, pipeline_ui/backend/{configs,runs,previews}
# are intentionally NOT copied here -- they're mounted as volumes, see
# docker-compose.yml, so a rebuild/redeploy never wipes real data).
COPY editVideos.py run_pipeline.py tiktokBulkDownloader.py ./
COPY pipeline/ ./pipeline/
COPY pipeline_ui/backend/ ./pipeline_ui/backend/
COPY pipeline_ui/__init__.py ./pipeline_ui/__init__.py
COPY assets/ ./assets/

COPY --from=frontend-build /app/pipeline_ui/frontend/dist ./pipeline_ui/frontend/dist

RUN mkdir -p raw edited pipeline_ui/backend/configs pipeline_ui/backend/runs pipeline_ui/backend/previews

EXPOSE 8000

# Shell form (not exec form) so ${PORT:-8000} actually expands -- Coolify
# auto-injects a PORT env var for every app, and hardcoding 8000 caused a
# real EADDRINUSE conflict for Postiz earlier in this project.
CMD uvicorn pipeline_ui.backend.main:app --host 0.0.0.0 --port ${PORT:-8000}
