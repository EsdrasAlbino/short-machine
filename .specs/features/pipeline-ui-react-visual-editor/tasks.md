# Pipeline UI React + Visual Branding Editor Tasks

**Design**: `.specs/features/pipeline-ui-react-visual-editor/design.md`
**Status**: Done (17/17 tasks, 29 backend + 30 frontend tests passing, verified end-to-end)

---

## Execution Plan

### Phase 1: Foundations (Parallel)

```
T1 [P]  editVideos.py x,y overlay
T3 [P]  config.py validation
T4 [P]  FastAPI skeleton
T8 [P]  Vite React scaffold
T13 [P] ffmpegPreview.ts buildFilterComplex
```

### Phase 2: Backend routes + frontend utilities (Parallel, after Phase 1)

```
T1,T3 ──→ T2
T4 ──┬──→ T5 [P]
     ├──→ T6 [P]
     └──→ T7 [P]
T8 ──┬──→ T9 [P]
     └──→ T12 [P]
```

### Phase 3: Frontend components (Parallel, after Phase 2)

```
T9 ──┬──→ T10 [P]
     └──→ T11 [P]
T12, T13 ──→ T14
```

### Phase 4: Wiring (Sequential)

```
T10, T14 ──→ T15
```

### Phase 5: Integration + cleanup (Sequential)

```
T2, T5, T6, T7, T11, T15 ──→ T16 ──→ T17
```

---

## Task Breakdown

### T1: Extend editVideos.py overlay to accept explicit x,y [P]

**What**: Add explicit pixel-coordinate overlay support to `build_filter_complex`/`POSITIONS`, alongside the 5 existing named positions.
**Where**: `editVideos.py`
**Depends on**: None
**Reuses**: Existing `POSITIONS` dict and `build_filter_complex` overlay-stage logic
**Requirement**: PUI-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `--watermark-position`/`--icon-position` accept `"x,y"` pixel strings in addition to the 5 named values
- [ ] Named positions still resolve identically (no regression)
- [ ] Gate check passes: `cd pipeline_ui/backend && pytest -x -q`
- [ ] Test count: new tests for both named and explicit-coordinate cases pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(editVideos): support explicit x,y overlay coordinates`

---

### T3: Update pipeline/config.py validation for new position shape [P]

**What**: Accept `logo_position`/`icon_position` as either `{x,y}` dict or legacy string in preset validation.
**Where**: `pipeline/config.py`
**Depends on**: None
**Reuses**: Existing `_check_fields`/`REQUIRED_EDIT_FIELDS` pattern
**Requirement**: PUI-10

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `load_config` accepts both shapes without raising `ConfigError`
- [ ] Invalid shapes (e.g. missing `x` or `y`) still raise a clear `ConfigError`
- [ ] Gate check passes: `cd pipeline_ui/backend && pytest -x -q`
- [ ] Test count: new tests for valid dict, valid legacy string, and invalid shape pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(config): accept explicit or legacy overlay position shapes`

---

### T4: FastAPI app skeleton [P]

**What**: `main.py` with CORS config, static-file serving for the React build, and a health-check route.
**Where**: `pipeline_ui/backend/main.py`
**Depends on**: None
**Reuses**: None (new)
**Requirement**: PUI-07, PUI-08, PUI-09 (foundation)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] App starts via `uvicorn`
- [ ] `GET /api/health` returns 200
- [ ] CORS allows the Vite dev origin in development
- [ ] Gate check passes: `cd pipeline_ui/backend && pytest -x -q`
- [ ] Test count: 1 health-check test passes

**Tests**: integration
**Gate**: quick

**Commit**: `feat(backend): FastAPI app skeleton with health check`

---

### T8: Scaffold Vite React app [P]

**What**: Initialize the Vite + React + TypeScript project structure.
**Where**: `pipeline_ui/frontend/`
**Depends on**: None
**Reuses**: None (new)
**Requirement**: PUI-07 (foundation)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `npm run build` succeeds
- [ ] `npm test -- --run` runs (0 tests, exits 0)

**Tests**: none
**Gate**: build

**Commit**: `chore(frontend): scaffold Vite React app`

---

### T13: ffmpegPreview.ts — buildFilterComplex [P]

**What**: Pure function that builds the ffmpeg `filter_complex` string from an `EditConfig`, mirroring `editVideos.py::build_filter_complex`.
**Where**: `pipeline_ui/frontend/src/lib/ffmpegPreview.ts`
**Depends on**: None (implements the format already fixed in design.md)
**Reuses**: Mirrors `editVideos.py::build_filter_complex` string construction
**Requirement**: PUI-02, PUI-03

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] `buildFilterComplex` produces the expected filter string for: delogo region only, overlay at explicit x/y, overlay at legacy named position, blur background on/off
- [ ] Gate check passes: `cd pipeline_ui/frontend && npm test -- --run`
- [ ] Test count: 4+ cases pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(frontend): filter_complex builder for live preview`

---

### T2: Update pipeline/edit_stage.py for new position shape

**What**: Resolve `logo_position`/`icon_position` (dict or legacy string) into the args `editVideos.py`'s `process_video` expects.
**Where**: `pipeline/edit_stage.py`
**Depends on**: T1, T3
**Reuses**: Existing `argparse.Namespace` construction in `edit_stage.run`
**Requirement**: PUI-10

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] A preset with `{x,y}` position produces the correct `--icon-position`/`--watermark-position`-equivalent call into `editVideos.py`
- [ ] A preset with a legacy string position still works unchanged
- [ ] Gate check passes: `cd pipeline_ui/backend && pytest -x -q`
- [ ] Test count: 2+ new tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(edit_stage): resolve explicit or legacy overlay positions`

---

### T5: presets.py routes [P]

**What**: `GET /api/presets`, `GET /api/presets/{name}`, `POST /api/presets`.
**Where**: `pipeline_ui/backend/routes/presets.py`
**Depends on**: T4
**Reuses**: Today's `list_presets`/`load_preset`/`save_and_validate` logic in `app.py`
**Requirement**: PUI-07

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] All 3 endpoints work against `TestClient`
- [ ] Invalid config on save returns 400 with the `ConfigError` message
- [ ] Gate check passes: `cd pipeline_ui/backend && pytest -x -q`
- [ ] Test count: 4+ tests pass

**Tests**: integration
**Gate**: quick

**Commit**: `feat(backend): preset CRUD routes`

---

### T6: sample_video.py route [P]

**What**: `POST /api/sample-video` — fetch/reuse one sample video for a profile.
**Where**: `pipeline_ui/backend/routes/sample_video.py`
**Depends on**: T4
**Reuses**: Today's `/preview` sample-fetching logic (`download_stage.run` with `video_count: 1`)
**Requirement**: PUI-01

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Route returns a servable video URL, mocking `pipeline.download_stage.run` in the test
- [ ] `DownloadError` from the pipeline surfaces as a 400 with a clear message
- [ ] Gate check passes: `cd pipeline_ui/backend && pytest -x -q`
- [ ] Test count: 2+ tests pass

**Tests**: integration
**Gate**: quick

**Commit**: `feat(backend): sample video route`

---

### T7: runs.py routes [P]

**What**: `POST /api/runs` (start, 409 if active) and `GET /api/runs/{run_id}/stream` (SSE).
**Where**: `pipeline_ui/backend/routes/runs.py`
**Depends on**: T4
**Reuses**: Today's subprocess-launch + tail-the-log-file SSE pattern in `app.py`
**Requirement**: PUI-08, PUI-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Starting a run while none is active returns a `run_id`, mocking the subprocess launch in the test
- [ ] Starting a second run while one is active returns 409
- [ ] Reconnecting to the stream replays the log from the start (no duplication in the client, verified in T11)
- [ ] Gate check passes: `cd pipeline_ui/backend && pytest -x -q`
- [ ] Test count: 3+ tests pass

**Tests**: integration
**Gate**: quick

**Commit**: `feat(backend): run launch + SSE log streaming routes`

---

### T9: api.ts — backend fetch wrappers [P]

**What**: Typed fetch wrapper functions for presets/sample-video/runs endpoints.
**Where**: `pipeline_ui/frontend/src/lib/api.ts`
**Depends on**: T8
**Reuses**: None (new)
**Requirement**: PUI-07, PUI-08

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] One function per backend endpoint, correctly typed
- [ ] Gate check passes: `cd pipeline_ui/frontend && npm test -- --run`
- [ ] Test count: mocked-fetch tests for each function pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(frontend): API client functions`

---

### T12: FFmpeg.wasm loader utility [P]

**What**: Utility that loads `@ffmpeg/ffmpeg`, exposing a load-success/load-failure signal for the fallback path.
**Where**: `pipeline_ui/frontend/src/lib/ffmpegLoader.ts`
**Depends on**: T8
**Reuses**: None (new)
**Requirement**: PUI-05

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Successful load resolves with a usable ffmpeg instance
- [ ] Failed load (mocked) resolves/rejects in a way `VisualEditor.tsx` can detect and fall back on
- [ ] Gate check passes: `cd pipeline_ui/frontend && npm test -- --run`
- [ ] Test count: 2+ tests (success + failure path) pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(frontend): FFmpeg.wasm loader with failure detection`

---

### T10: PresetForm.tsx [P]

**What**: Config form component (profile, video count, schedule fields, preset load/save) — replaces `form.html`.
**Where**: `pipeline_ui/frontend/src/components/PresetForm.tsx`
**Depends on**: T9
**Reuses**: Field set from today's `form.html`
**Requirement**: PUI-07

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] All fields from today's form present and controlled
- [ ] Loading a preset populates every field, including legacy position strings
- [ ] Gate check passes: `cd pipeline_ui/frontend && npm test -- --run`
- [ ] Test count: 3+ RTL tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(frontend): preset config form`

---

### T11: RunLog.tsx [P]

**What**: Live log viewer consuming the SSE stream — replaces `run.html`/`run.js`.
**Where**: `pipeline_ui/frontend/src/components/RunLog.tsx`
**Depends on**: T9
**Reuses**: Reconnect-resets-buffer logic from today's `run.js`
**Requirement**: PUI-09

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Renders incoming log lines live (mocked `EventSource` in test)
- [ ] Reconnect (simulated `onopen` firing again) resets the displayed buffer instead of duplicating
- [ ] `done` event updates status text and closes the connection
- [ ] Gate check passes: `cd pipeline_ui/frontend && npm test -- --run`
- [ ] Test count: 3+ tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(frontend): live run log viewer`

---

### T14: VisualEditor.tsx

**What**: Draggable/resizable overlay boxes over the sample video, live-rendering via `ffmpegPreview`/`ffmpegLoader`, with static-frame fallback.
**Where**: `pipeline_ui/frontend/src/components/VisualEditor.tsx`
**Depends on**: T12, T13
**Reuses**: `ffmpegPreview.ts`, `ffmpegLoader.ts`
**Requirement**: PUI-01, PUI-02, PUI-03, PUI-04, PUI-05, PUI-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Dragging either box (simulated pointer events) updates coordinates and triggers a debounced preview render
- [ ] Coordinates clamp to the video frame's bounds
- [ ] Watermark-region resize below the minimum size is rejected
- [ ] FFmpeg.wasm load failure switches the component into static-frame mode
- [ ] Gate check passes: `cd pipeline_ui/frontend && npm test -- --run`
- [ ] Test count: 5+ RTL tests pass

**Tests**: unit
**Gate**: quick

**Commit**: `feat(frontend): visual branding editor with live preview`

---

### T15: Wire VisualEditor into PresetForm

**What**: "Confirm position" in `VisualEditor` writes coordinates into `PresetForm`'s config state.
**Where**: `pipeline_ui/frontend/src/App.tsx` (or `PresetForm.tsx`, wiring only)
**Depends on**: T10, T14
**Reuses**: Both components' existing props/callbacks
**Requirement**: PUI-06

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Confirming a position in the editor updates the form's `logo_position`/`icon_position`/`watermark_region` fields
- [ ] Gate check passes: `cd pipeline_ui/frontend && npm test -- --run`
- [ ] Test count: 1+ integration-style RTL test passes

**Tests**: unit
**Gate**: quick

**Commit**: `feat(frontend): wire visual editor confirm into preset form`

---

### T16: End-to-end wiring + manual verification

**What**: Point the frontend at the real (unmocked) backend, run a full cycle by hand: pick a profile, position branding visually, confirm, launch a `--dry-run` batch, watch the log to completion.
**Where**: N/A (integration/verification pass, may touch small glue code in `App.tsx`)
**Depends on**: T2, T5, T6, T7, T11, T15
**Reuses**: Everything above
**Requirement**: All (PUI-01 through PUI-10)

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] A real profile's sample video loads in the editor
- [ ] Live preview during drag visibly matches a real backend batch render of the same video with the same coordinates
- [ ] A `--dry-run` batch launched from the new UI completes with a live-updating log
- [ ] A preset saved before this feature (legacy named position) still loads and runs correctly

**Tests**: none
**Gate**: full

**Commit**: `test: end-to-end verification of React pipeline_ui`

---

### T17: Retire the Flask app

**What**: Remove `pipeline_ui/app.py`, `templates/`, `static/` (old Flask+Jinja) once the React app is verified.
**Where**: `pipeline_ui/`
**Depends on**: T16
**Reuses**: N/A

**Tools**:
- MCP: NONE
- Skill: NONE

**Done when**:
- [ ] Old Flask files removed
- [ ] `requirements.txt` no longer lists Flask if nothing else needs it
- [ ] README/instructions (if any) updated to the new run command

**Tests**: none
**Gate**: none

**Commit**: `chore: remove legacy Flask pipeline_ui`

---

## Parallel Execution Map

```
Phase 1 (Parallel):
  ├── T1  [P]
  ├── T3  [P]
  ├── T4  [P]
  ├── T8  [P]
  └── T13 [P]

Phase 2 (Parallel, after Phase 1):
  T1, T3 done → T2
  T4 done → T5 [P], T6 [P], T7 [P]
  T8 done → T9 [P], T12 [P]

Phase 3 (Parallel, after Phase 2):
  T9 done → T10 [P], T11 [P]
  T12, T13 done → T14

Phase 4 (Sequential):
  T10, T14 done → T15

Phase 5 (Sequential):
  T2, T5, T6, T7, T11, T15 done → T16 → T17
```

---

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1: editVideos.py x,y overlay | 1 file, 1 concern (overlay positioning) | ✅ Granular |
| T2: edit_stage.py position resolution | 1 file, 1 function | ✅ Granular |
| T3: config.py validation update | 1 file, 1 concern | ✅ Granular |
| T4: FastAPI skeleton | 1 file | ✅ Granular |
| T5: presets.py routes | 1 file, 3 related endpoints (cohesive CRUD) | ✅ Granular |
| T6: sample_video.py route | 1 file, 1 endpoint | ✅ Granular |
| T7: runs.py routes | 1 file, 2 related endpoints (cohesive: start+stream) | ✅ Granular |
| T8: Vite scaffold | 1 project init | ✅ Granular |
| T9: api.ts | 1 file, related fetch wrappers | ✅ Granular |
| T10: PresetForm.tsx | 1 component | ✅ Granular |
| T11: RunLog.tsx | 1 component | ✅ Granular |
| T12: ffmpegLoader.ts | 1 utility | ✅ Granular |
| T13: ffmpegPreview.ts | 1 pure function module | ✅ Granular |
| T14: VisualEditor.tsx | 1 component | ✅ Granular |
| T15: Wiring | 1 integration point | ✅ Granular |
| T16: E2E verification | Verification pass, no new code surface | ✅ Granular |
| T17: Cleanup | 1 removal pass | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (task body) | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Phase 1, no incoming arrow | ✅ Match |
| T3 | None | Phase 1, no incoming arrow | ✅ Match |
| T4 | None | Phase 1, no incoming arrow | ✅ Match |
| T8 | None | Phase 1, no incoming arrow | ✅ Match |
| T13 | None | Phase 1, no incoming arrow | ✅ Match |
| T2 | T1, T3 | Arrows from T1, T3 -> T2 | ✅ Match |
| T5 | T4 | Arrow from T4 -> T5 | ✅ Match |
| T6 | T4 | Arrow from T4 -> T6 | ✅ Match |
| T7 | T4 | Arrow from T4 -> T7 | ✅ Match |
| T9 | T8 | Arrow from T8 -> T9 | ✅ Match |
| T12 | T8 | Arrow from T8 -> T12 | ✅ Match |
| T10 | T9 | Arrow from T9 -> T10 | ✅ Match |
| T11 | T9 | Arrow from T9 -> T11 | ✅ Match |
| T14 | T12, T13 | Arrows from T12, T13 -> T14 | ✅ Match |
| T15 | T10, T14 | Arrows from T10, T14 -> T15 | ✅ Match |
| T16 | T2, T5, T6, T7, T11, T15 | Arrows from all six -> T16 | ✅ Match |
| T17 | T16 | Arrow from T16 -> T17 | ✅ Match |

---

## Test Co-location Validation

| Task | Code Layer Created/Modified | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | `editVideos.py` filter_complex extension | unit | unit | ✅ OK |
| T2 | `pipeline/edit_stage.py` position logic | unit | unit | ✅ OK |
| T3 | `pipeline/config.py` validation | unit | unit | ✅ OK |
| T4 | FastAPI route handler (health check) | integration | integration | ✅ OK |
| T5 | FastAPI route handlers (presets) | integration | integration | ✅ OK |
| T6 | FastAPI route handlers (sample video) | integration | integration | ✅ OK |
| T7 | FastAPI route handlers (runs) | integration | integration | ✅ OK |
| T8 | Project scaffold (no code layer in matrix) | — | none | ✅ OK |
| T9 | (not in matrix directly; treated as thin wrapper) | — | unit | ✅ OK (stricter than required) |
| T10 | React component (PresetForm) | unit | unit | ✅ OK |
| T11 | React component (RunLog) | unit | unit | ✅ OK |
| T12 | (not in matrix directly; treated as utility) | — | unit | ✅ OK (stricter than required) |
| T13 | `ffmpegPreview.ts` filter_complex builder | unit | unit | ✅ OK |
| T14 | React component (VisualEditor drag/resize) | unit | unit | ✅ OK |
| T15 | Wiring (no dedicated layer in matrix) | — | unit | ✅ OK (stricter than required) |
| T16 | End-to-end batch run | none | none | ✅ OK |
| T17 | Cleanup (no code layer) | — | none | ✅ OK |
