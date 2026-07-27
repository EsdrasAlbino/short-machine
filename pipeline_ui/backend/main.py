import os
import sys

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
PIPELINE_UI_DIR = os.path.dirname(BACKEND_DIR)
REPO_ROOT = os.path.dirname(PIPELINE_UI_DIR)
FRONTEND_DIST = os.path.join(PIPELINE_UI_DIR, "frontend", "dist")

if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

load_dotenv(os.path.join(REPO_ROOT, ".env"))

from pipeline_ui.backend.routes import presets, runs, sample_video  # noqa: E402

app = FastAPI(title="pipeline_ui")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health():
    return {"status": "ok"}


app.include_router(presets.router)
app.include_router(sample_video.router)
app.include_router(runs.router)

# In production, the built React app is served from the same process/port
# as the API -- keeps deployment to one process, matching the Flask app's
# "simple local tool" footprint.
if os.path.isdir(FRONTEND_DIST):
    app.mount("/", StaticFiles(directory=FRONTEND_DIST, html=True), name="frontend")
