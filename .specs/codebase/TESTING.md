# Testing Strategy

## Context

Project has no automated test suite today (`pipeline/`, `pipeline_ui/` were
verified manually via curl/browser). This feature introduces the first
automated tests: pytest for the FastAPI backend, Vitest + React Testing
Library for the frontend.

## Test Coverage Matrix

| Code layer | Test type | Notes |
| --- | --- | --- |
| FastAPI route handlers (presets, sample_video, runs) | integration | Use `fastapi.testclient.TestClient`; mock `pipeline.*` calls that hit network/ffmpeg |
| `pipeline/config.py` validation changes | unit | Pure function, no I/O |
| `pipeline/edit_stage.py` position-resolution logic | unit | Pure function: `{x,y}` dict or named string -> resolved coordinate |
| `editVideos.py` filter_complex extension (x,y overlay) | unit | Assert the generated filter string, no real ffmpeg execution |
| React components (`PresetForm`, `RunLog`) | unit | Vitest + React Testing Library, mock `fetch`/`EventSource` |
| `ffmpegPreview.ts` (filter_complex string builder) | unit | Pure function: drag coordinates -> filter_complex string. Does NOT invoke real `@ffmpeg/ffmpeg` in tests |
| `VisualEditor.tsx` drag/resize interaction | unit | Vitest + RTL, simulate pointer events, assert resulting coordinates |
| Actual FFmpeg.wasm video rendering | none | Impractical to run WASM video processing in CI; verified manually in-browser |
| End-to-end batch run (download→edit→title→schedule) | none | Already covered by existing manual verification process; no new automated e2e for this feature |

## Gate Check Commands

| Gate | Command | When |
| --- | --- | --- |
| quick (backend) | `cd pipeline_ui/backend && pytest -x -q` | After any backend task |
| quick (frontend) | `cd pipeline_ui/frontend && npm test -- --run` | After any frontend task |
| full | quick (backend) + quick (frontend), no additional suite for this feature | Before marking a phase done |

## Parallelism Assessment

- Backend unit/integration tests (pytest, TestClient with mocks): **Parallel-Safe: Yes** — no shared mutable state, each test module isolated.
- Frontend unit tests (Vitest): **Parallel-Safe: Yes** — component tests are isolated by default.
