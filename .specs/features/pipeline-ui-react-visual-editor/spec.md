# Pipeline UI React + Visual Branding Editor Specification

## Problem Statement

`pipeline_ui` (Flask + Jinja) requires typing pixel/fraction coordinates to
position the logo, icon, and watermark-removal region. This already caused a
real production incident: an icon saved at native 600x600 resolution
rendered enormous across 80 already-scheduled videos, only discovered after
the fact. The interface needs to be rebuilt (React + a dedicated FastAPI
backend) with a visual editor that shows the actual positioning live before
a batch runs.

## Goals

- [ ] Free-drag positioning of logo/icon/watermark-removal region over a real
      sample video, with a live rendered preview (not typed coordinates)
- [ ] Feature parity with today's Flask app: presets, batch run launch, live
      log streaming
- [ ] Zero silent branding mistakes reaching a real batch run

## Out of Scope

| Feature | Reason |
| --- | --- |
| Scene cutting / multi-clip timeline / NLE-style editing | Editor only positions branding overlays, not video assembly |
| Per-video visual adjustment within a batch | Config is set once (on a sample video) and applied to the whole batch, matching today's preset model |
| Node.js backend | Batch processing stays in Python/FastAPI, reusing `pipeline/*` unchanged |

---

## User Stories

### P1: Visual branding editor with live preview ⭐ MVP

**User Story**: As the person running the pipeline, I want to drag the
logo/icon/watermark-removal region directly on a real sample video and see
the rendered result live, so that I never schedule a batch with broken
branding again.

**Why P1**: This is the entire reason for the rewrite — the incident that
triggered it happened because there was no visual feedback before committing
to a full batch.

**Acceptance Criteria**:

1. WHEN the user opens the editor for a profile with no local sample video THEN system SHALL fetch one sample video from the configured profile before rendering the editor
2. WHEN the user drags the watermark-removal region box THEN system SHALL render a live preview (first ~3s of the sample video) with the delogo filter applied at the new coordinates within [debounce interval]
3. WHEN the user drags the logo or icon overlay box THEN system SHALL render a live preview with the overlay at the new pixel position, freely (not snapped to the 5 legacy named positions)
4. WHEN the user drags a box beyond the video frame's bounds THEN system SHALL clamp it to stay fully inside the frame
5. WHEN FFmpeg.wasm fails to load or initialize THEN system SHALL fall back to the static single-frame preview mode without blocking the editor
6. WHEN the user confirms a position THEN system SHALL write the resulting coordinates into the active preset's config

**Independent Test**: Open the editor against a profile with a downloaded
sample video, drag both boxes to arbitrary positions, confirm the live
preview updates and matches a real backend batch render of 1 video with the
same coordinates.

---

### P1: React + FastAPI parity with existing Flask app ⭐ MVP

**User Story**: As the person running the pipeline, I want the same preset
management, batch launch, and live log experience I have today, just on the
new stack, so that the rewrite doesn't lose existing functionality.

**Why P1**: Without this, there is no working app to host the visual editor
in — it's the load-bearing foundation, not optional scaffolding.

**Acceptance Criteria**:

1. WHEN the user saves a preset THEN system SHALL persist it identically to today's JSON format in `pipeline_ui/backend/configs/`
2. WHEN the user starts a run THEN system SHALL launch `run_pipeline.py` as a subprocess exactly as today, enforcing the single-active-run lock
3. WHEN a run is active THEN system SHALL stream its log live to the frontend, and reconnecting SHALL replay the full log without duplication
4. WHEN the user loads a previously-saved preset THEN system SHALL populate all form fields, including legacy named-position values

**Independent Test**: Save a preset, start a `--dry-run` batch, watch the
live log to completion, reload the page mid-run and confirm the log resumes
correctly.

---

### P2: Backward compatibility with legacy named positions

**User Story**: As the person running the pipeline, I want presets saved
before this rewrite to keep working, so that I don't have to redo existing
configuration.

**Why P2**: Important for continuity, but no existing preset is blocked from
manual re-save if this slipped — it's not launch-blocking in the way P1 is.

**Acceptance Criteria**:

1. WHEN a preset's `logo_position`/`icon_position` is a legacy string (e.g. `"bottom-right"`) THEN system SHALL render it correctly in the editor and in a real batch run
2. WHEN the user drags a box on a preset that had a legacy string position THEN system SHALL convert it to explicit `{x, y}` on confirm

**Independent Test**: Load a preset with `icon_position: "top-left"`, confirm
it renders correctly in a batch run without opening the editor.

---

## Edge Cases

- WHEN the sample video fails to download THEN system SHALL show a clear error in the editor, matching today's `/preview` error handling
- WHEN the watermark-removal region is dragged to zero width/height THEN system SHALL reject the resize (minimum size enforced)
- WHEN two browser tabs try to start a run simultaneously THEN system SHALL reject the second with the existing 409 behavior

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| PUI-01 | P1: Visual editor - sample video fetch | Design | Pending |
| PUI-02 | P1: Visual editor - live preview on drag | Design | Pending |
| PUI-03 | P1: Visual editor - free-drag overlay position | Design | Pending |
| PUI-04 | P1: Visual editor - clamp to frame bounds | Design | Pending |
| PUI-05 | P1: Visual editor - FFmpeg.wasm fallback | Design | Pending |
| PUI-06 | P1: Visual editor - confirm writes config | Design | Pending |
| PUI-07 | P1: Parity - preset save/load | Design | Pending |
| PUI-08 | P1: Parity - run launch + single-run lock | Design | Pending |
| PUI-09 | P1: Parity - live log streaming + reconnect | Design | Pending |
| PUI-10 | P2: Legacy named-position compatibility | Design | Pending |

**Coverage:** 10 total, 0 mapped to tasks, 10 unmapped ⚠️ (mapped during Tasks phase)

---

## Success Criteria

- [ ] Can position logo/icon/watermark-region entirely by dragging, with zero typed coordinates
- [ ] A batch run using editor-confirmed coordinates visually matches the live preview shown before confirming
- [ ] All P1 acceptance criteria pass manual verification; all automated tests (pytest + Vitest) pass
