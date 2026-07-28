import type { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile } from '@ffmpeg/util'
import { useEffect, useRef, useState } from 'react'
import { loadFFmpeg } from '../lib/ffmpegLoader'
import { buildFilterComplexFromConfig } from '../lib/ffmpegPreview'
import type { EditConfig } from '../lib/types'

const PREVIEW_TRIM_SECONDS = '3'

const DISPLAY_WIDTH = 360
const CANVAS_SIZE = '1080x1920'
const CANVAS_WIDTH = 1080
const CANVAS_HEIGHT = 1920
const MIN_REGION_FRAC = 0.02
const DEBOUNCE_MS = 300

export interface VisualEditorProps {
  sampleVideoUrl: string
  initialConfig: EditConfig
  onConfirm: (config: EditConfig) => void
}

interface WatermarkBox {
  x0: number
  y0: number
  x1: number
  y1: number
}

interface PointBox {
  x: number
  y: number
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function parseWatermarkRegion(region: string | undefined): WatermarkBox {
  if (!region) return { x0: 0.35, y0: 0.9, x1: 0.65, y1: 0.99 }
  const [x0, y0, x1, y1] = region.split(',').map(Number)
  return { x0, y0, x1, y1 }
}

function parsePointPosition(position: EditConfig['logo_position'], fallback: PointBox): PointBox {
  if (!position) return fallback
  if (typeof position === 'string') return fallback // legacy named position, no pixel coords to show
  return { x: position.x, y: position.y }
}

export default function VisualEditor({ sampleVideoUrl, initialConfig, onConfirm }: VisualEditorProps) {
  const [ffmpegFailed, setFfmpegFailed] = useState(false)
  const ffmpegRef = useRef<FFmpeg | null>(null)

  const [watermarkBox, setWatermarkBox] = useState<WatermarkBox>(() =>
    parseWatermarkRegion(initialConfig.watermark_region),
  )
  const [logoBox, setLogoBox] = useState<PointBox>(() =>
    parsePointPosition(initialConfig.logo_position, { x: 20, y: CANVAS_HEIGHT - 200 }),
  )
  const [iconBox, setIconBox] = useState<PointBox>(() =>
    parsePointPosition(initialConfig.icon_position, { x: 20, y: 20 }),
  )

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let cancelled = false
    loadFFmpeg()
      .then((ffmpeg) => {
        if (!cancelled) ffmpegRef.current = ffmpeg
      })
      .catch(() => {
        if (!cancelled) setFfmpegFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  function scheduleRender(config: EditConfig) {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      renderPreview(config)
    }, DEBOUNCE_MS)
  }

  async function renderPreview(config: EditConfig) {
    const ffmpeg = ffmpegRef.current
    if (!ffmpeg) return // static-frame fallback: no live render, box positions still update

    const { filterComplex } = buildFilterComplexFromConfig(config, CANVAS_SIZE, {
      width: CANVAS_WIDTH,
      height: CANVAS_HEIGHT,
    })

    const inputName = 'input.mp4'
    const outputName = 'preview.mp4'
    // Not exercised by unit tests (real WASM execution) -- see TESTING.md:
    // "Actual FFmpeg.wasm video rendering" is verified manually in-browser.
    await ffmpeg.writeFile(inputName, await fetchFile(sampleVideoUrl))
    await ffmpeg.exec([
      '-i', inputName,
      '-t', PREVIEW_TRIM_SECONDS,
      '-filter_complex', filterComplex,
      '-map', '[outv]',
      outputName,
    ])
    const data = await ffmpeg.readFile(outputName)
    const blob = new Blob([data as unknown as BlobPart], { type: 'video/mp4' })
    setPreviewUrl((previous) => {
      if (previous) URL.revokeObjectURL(previous)
      return URL.createObjectURL(blob)
    })
  }

  function currentConfig(): EditConfig {
    return buildConfigWith({})
  }

  function buildConfigWith(overrides: {
    watermarkBox?: WatermarkBox
    logoBox?: PointBox
    iconBox?: PointBox
  }): EditConfig {
    const wb = overrides.watermarkBox ?? watermarkBox
    const lb = overrides.logoBox ?? logoBox
    const ib = overrides.iconBox ?? iconBox
    return {
      ...initialConfig,
      watermark_region: `${wb.x0},${wb.y0},${wb.x1},${wb.y1}`,
      logo_position: { x: lb.x, y: lb.y },
      icon_position: { x: ib.x, y: ib.y },
    }
  }

  function startDrag(
    event: React.PointerEvent<HTMLDivElement>,
    // Returns the resulting EditConfig for this move so handleUp can hand
    // it straight to scheduleRender -- reading component state here instead
    // would be stale, since this closure was created once at drag-start and
    // never sees the setState calls onMove makes (classic stale-closure
    // trap: state updates don't retroactively update an already-captured
    // closure within the same synchronous event chain).
    onMove: (deltaXFrac: number, deltaYFrac: number) => EditConfig,
  ) {
    event.currentTarget.setPointerCapture?.(event.pointerId)
    const startX = event.clientX
    const startY = event.clientY
    let latestConfig: EditConfig | null = null

    function handleMove(moveEvent: PointerEvent) {
      const deltaXFrac = (moveEvent.clientX - startX) / DISPLAY_WIDTH
      const deltaYFrac = (moveEvent.clientY - startY) / (DISPLAY_WIDTH * (CANVAS_HEIGHT / CANVAS_WIDTH))
      latestConfig = onMove(deltaXFrac, deltaYFrac)
    }

    function handleUp() {
      window.removeEventListener('pointermove', handleMove)
      window.removeEventListener('pointerup', handleUp)
      if (latestConfig) scheduleRender(latestConfig)
    }

    window.addEventListener('pointermove', handleMove)
    window.addEventListener('pointerup', handleUp)
  }

  function handleWatermarkMove(event: React.PointerEvent<HTMLDivElement>) {
    const start = watermarkBox
    startDrag(event, (dxFrac, dyFrac) => {
      const width = start.x1 - start.x0
      const height = start.y1 - start.y0
      const x0 = clamp(start.x0 + dxFrac, 0, 1 - width)
      const y0 = clamp(start.y0 + dyFrac, 0, 1 - height)
      const newBox = { x0, y0, x1: x0 + width, y1: y0 + height }
      setWatermarkBox(newBox)
      return buildConfigWith({ watermarkBox: newBox })
    })
  }

  function handleWatermarkResize(event: React.PointerEvent<HTMLDivElement>) {
    const start = watermarkBox
    startDrag(event, (dxFrac, dyFrac) => {
      const x1 = clamp(start.x1 + dxFrac, start.x0 + MIN_REGION_FRAC, 1)
      const y1 = clamp(start.y1 + dyFrac, start.y0 + MIN_REGION_FRAC, 1)
      const newBox = { ...start, x1, y1 }
      setWatermarkBox(newBox)
      return buildConfigWith({ watermarkBox: newBox })
    })
  }

  function handlePointMove(
    box: PointBox,
    setBox: (b: PointBox) => void,
    key: 'logoBox' | 'iconBox',
  ) {
    return (event: React.PointerEvent<HTMLDivElement>) => {
      const start = box
      startDrag(event, (dxFrac, dyFrac) => {
        const x = clamp(start.x + dxFrac * CANVAS_WIDTH, 0, CANVAS_WIDTH)
        const y = clamp(start.y + dyFrac * CANVAS_HEIGHT, 0, CANVAS_HEIGHT)
        const newBox = { x, y }
        setBox(newBox)
        return buildConfigWith({ [key]: newBox })
      })
    }
  }

  return (
    <div className="visual-editor">
      {ffmpegFailed && (
        <p data-testid="static-fallback-notice">
          Prévia ao vivo indisponível neste navegador -- posicione usando o quadro estático abaixo.
        </p>
      )}

      <div
        className="editor-frame"
        style={{ position: 'relative', width: DISPLAY_WIDTH }}
        data-testid="editor-frame"
      >
        <video src={previewUrl ?? sampleVideoUrl} muted loop autoPlay style={{ width: '100%' }} />

        <div
          data-testid="watermark-box"
          onPointerDown={handleWatermarkMove}
          style={{
            position: 'absolute',
            left: `${watermarkBox.x0 * 100}%`,
            top: `${watermarkBox.y0 * 100}%`,
            width: `${(watermarkBox.x1 - watermarkBox.x0) * 100}%`,
            height: `${(watermarkBox.y1 - watermarkBox.y0) * 100}%`,
            border: '2px solid red',
            cursor: 'move',
          }}
        >
          <div
            data-testid="watermark-resize-handle"
            onPointerDown={(e) => {
              e.stopPropagation()
              handleWatermarkResize(e)
            }}
            style={{
              position: 'absolute',
              right: -6,
              bottom: -6,
              width: 12,
              height: 12,
              background: 'red',
              cursor: 'nwse-resize',
            }}
          />
        </div>

        <div
          data-testid="logo-box"
          onPointerDown={handlePointMove(logoBox, setLogoBox, 'logoBox')}
          style={{
            position: 'absolute',
            left: `${(logoBox.x / CANVAS_WIDTH) * 100}%`,
            top: `${(logoBox.y / CANVAS_HEIGHT) * 100}%`,
            width: 24,
            height: 24,
            background: 'rgba(0,128,255,0.6)',
            cursor: 'move',
          }}
        />

        <div
          data-testid="icon-box"
          onPointerDown={handlePointMove(iconBox, setIconBox, 'iconBox')}
          style={{
            position: 'absolute',
            left: `${(iconBox.x / CANVAS_WIDTH) * 100}%`,
            top: `${(iconBox.y / CANVAS_HEIGHT) * 100}%`,
            width: 24,
            height: 24,
            background: 'rgba(0,200,100,0.6)',
            cursor: 'move',
          }}
        />
      </div>

      <div className="step-actions">
        <button type="button" className="btn btn-primary" onClick={() => onConfirm(currentConfig())}>
          Confirmar posição
        </button>
      </div>
    </div>
  )
}
