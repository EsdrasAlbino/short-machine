import type { EditConfig, PositionValue } from './types'

// Mirrors editVideos.py's POSITIONS dict exactly.
const POSITIONS: Record<string, [string, string]> = {
  'top-left': ['20', '20'],
  'top-right': ['W-w-20', '20'],
  'bottom-left': ['20', 'H-h-20'],
  'bottom-right': ['W-w-20', 'H-h-20'],
  center: ['(W-w)/2', '(H-h)/2'],
}

export interface InputMap {
  video: number
  background?: number
  watermark?: number
  icons?: number[]
}

export interface FilterArgs {
  canvasSize: string // e.g. "1080x1920"
  background: 'blur' | null
  watermark: boolean
  watermarkPosition: string // named key (e.g. "bottom-right") or explicit "x,y"
  watermarkOpacity: number
  iconPositions: string[] // one per icon input, named key or explicit "x,y"
}

export interface DelogoRegion {
  x: number
  y: number
  w: number
  h: number
}

export interface VideoDimensions {
  width: number
  height: number
}

export interface FilterComplexResult {
  filterComplex: string
  outputLabel: string
}

/**
 * Mirrors editVideos.py::resolve_position -- a named POSITIONS key, or an
 * explicit "x,y" pixel coordinate string for free placement.
 */
export function resolvePosition(position: string): [string, string] {
  if (position.includes(',')) {
    const [x, y] = position.split(',')
    return [x.trim(), y.trim()]
  }
  const resolved = POSITIONS[position]
  if (!resolved) {
    throw new Error(`Unknown position: ${position}`)
  }
  return resolved
}

/**
 * Mirrors editVideos.py::compute_delogo_region -- converts a fractional
 * bounding box (x0,y0,x1,y1), each 0-1, into absolute pixel x/y/w/h.
 */
export function computeDelogoRegion(regionFracs: string, video: VideoDimensions): DelogoRegion {
  const [x0, y0, x1, y1] = regionFracs.split(',').map(Number)
  // Python's compute_delogo_region uses int(), which truncates toward zero
  // -- Math.trunc matches that exactly (Math.round would silently produce
  // off-by-one pixel mismatches against the real backend render).
  return {
    x: Math.trunc(x0 * video.width),
    y: Math.trunc(y0 * video.height),
    w: Math.trunc((x1 - x0) * video.width),
    h: Math.trunc((y1 - y0) * video.height),
  }
}

/**
 * Structural port of editVideos.py::build_filter_complex. Captions are
 * intentionally not modeled here -- the live preview never burns in
 * subtitles, so the last filter stage is always relabeled to [outv]
 * directly (the "no srt_path" branch of the Python version).
 */
export function buildFilterComplex(
  args: FilterArgs,
  inputMap: InputMap,
  delogoRegion?: DelogoRegion,
): FilterComplexResult {
  const filters: string[] = []
  const videoIdx = inputMap.video
  const [canvasW, canvasH] = args.canvasSize.split('x')

  let sourceLabel = `${videoIdx}:v`
  if (delogoRegion) {
    const { x, y, w, h } = delogoRegion
    filters.push(`[${videoIdx}:v]delogo=x=${x}:y=${y}:w=${w}:h=${h}[clean]`)
    sourceLabel = 'clean'
  }

  let currentLabel: string
  if (args.background) {
    if (args.background === 'blur') {
      // sourceLabel is consumed twice below (blurred backdrop + sharp
      // foreground); ffmpeg requires an explicit split for a label reused
      // across two filter chains.
      filters.push(`[${sourceLabel}]split=2[bgsrc][fgsrc]`)
      filters.push(
        `[bgsrc]scale=${canvasW}:${canvasH}:force_original_aspect_ratio=increase,` +
          `crop=${canvasW}:${canvasH},gblur=sigma=20[bg]`,
      )
      filters.push(`[fgsrc]scale=${canvasW}:${canvasH}:force_original_aspect_ratio=decrease[fg]`)
    } else if (inputMap.background !== undefined) {
      const bgIdx = inputMap.background
      filters.push(
        `[${bgIdx}:v]scale=${canvasW}:${canvasH}:force_original_aspect_ratio=increase,` +
          `crop=${canvasW}:${canvasH}[bg]`,
      )
      filters.push(`[${sourceLabel}]scale=${canvasW}:${canvasH}:force_original_aspect_ratio=decrease[fg]`)
    }
    filters.push('[bg][fg]overlay=(W-w)/2:(H-h)/2[base0]')
    currentLabel = 'base0'
  } else {
    filters.push(`[${sourceLabel}]null[base0]`)
    currentLabel = 'base0'
  }

  let stage = 1

  if (args.watermark && inputMap.watermark !== undefined) {
    const wmIdx = inputMap.watermark
    const [x, y] = resolvePosition(args.watermarkPosition)
    if (args.watermarkOpacity < 1.0) {
      filters.push(`[${wmIdx}:v]format=rgba,colorchannelmixer=aa=${args.watermarkOpacity}[wm]`)
    } else {
      filters.push(`[${wmIdx}:v]format=rgba[wm]`)
    }
    const nextLabel = `base${stage}`
    filters.push(`[${currentLabel}][wm]overlay=${x}:${y}[${nextLabel}]`)
    currentLabel = nextLabel
    stage += 1
  }

  const icons = inputMap.icons ?? []
  icons.forEach((iconIdx, i) => {
    const position = args.iconPositions[i]
    const [x, y] = resolvePosition(position)
    const nextLabel = `base${stage}`
    filters.push(`[${currentLabel}][${iconIdx}:v]overlay=${x}:${y}[${nextLabel}]`)
    currentLabel = nextLabel
    stage += 1
  })

  filters[filters.length - 1] = filters[filters.length - 1].replace(`[${currentLabel}]`, '[outv]')

  return { filterComplex: filters.join(';'), outputLabel: '[outv]' }
}

function positionValueToString(position: PositionValue | undefined, fallback: string): string {
  if (position === undefined) return fallback
  if (typeof position === 'string') return position
  return `${position.x},${position.y}`
}

export interface FilterComplexFromConfigResult extends FilterComplexResult {
  inputMap: InputMap
}

/**
 * Convenience entry point used by VisualEditor: builds the filter_complex
 * directly from an EditConfig + the sample video's real pixel dimensions,
 * assigning ffmpeg input indices the same way pipeline/edit_stage.py does
 * (video=0, then watermark if present, then icon if present).
 */
export function buildFilterComplexFromConfig(
  edit: EditConfig,
  canvasSize: string,
  video: VideoDimensions,
): FilterComplexFromConfigResult {
  const delogoRegion = edit.watermark_region
    ? computeDelogoRegion(edit.watermark_region, video)
    : undefined

  let nextInput = 1
  const inputMap: InputMap = { video: 0 }

  const hasWatermark = Boolean(edit.logo_path)
  if (hasWatermark) {
    inputMap.watermark = nextInput
    nextInput += 1
  }

  const hasIcon = Boolean(edit.icon_path)
  if (hasIcon) {
    inputMap.icons = [nextInput]
    nextInput += 1
  }

  const result = buildFilterComplex(
    {
      canvasSize,
      background: edit.background_blur ? 'blur' : null,
      watermark: hasWatermark,
      watermarkPosition: positionValueToString(edit.logo_position, 'bottom-right'),
      watermarkOpacity: 1.0,
      iconPositions: hasIcon ? [positionValueToString(edit.icon_position, 'top-left')] : [],
    },
    inputMap,
    delogoRegion,
  )

  return { ...result, inputMap }
}
