import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as ffmpegLoader from '../lib/ffmpegLoader'
import * as ffmpegPreview from '../lib/ffmpegPreview'
import type { EditConfig } from '../lib/types'
import VisualEditor from './VisualEditor'

vi.mock('@ffmpeg/util', () => ({
  fetchFile: vi.fn().mockResolvedValue(new Uint8Array()),
}))

const FAKE_FFMPEG = {
  writeFile: vi.fn().mockResolvedValue(undefined),
  exec: vi.fn().mockResolvedValue(0),
  readFile: vi.fn().mockResolvedValue(new Uint8Array()),
} as unknown as Awaited<ReturnType<typeof ffmpegLoader.loadFFmpeg>>

const BASE_CONFIG: EditConfig = {
  logo_path: 'assets/logo.png',
  icon_path: 'assets/icon.png',
  watermark_region: '0.3,0.9,0.6,0.99',
  captions_enabled: false,
  background_blur: true,
}

function drag(testId: string, dx: number, dy: number) {
  const el = screen.getByTestId(testId)
  fireEvent.pointerDown(el, { clientX: 0, clientY: 0, pointerId: 1 })
  fireEvent.pointerMove(window, { clientX: dx, clientY: dy })
  fireEvent.pointerUp(window)
}

beforeEach(() => {
  vi.spyOn(ffmpegLoader, 'loadFFmpeg').mockResolvedValue(FAKE_FFMPEG)
  vi.spyOn(ffmpegPreview, 'buildFilterComplexFromConfig')
  vi.stubGlobal('URL', { ...URL, createObjectURL: vi.fn().mockReturnValue('blob:preview'), revokeObjectURL: vi.fn() })
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('VisualEditor', () => {
  it('dragging the watermark box updates its position and schedules a debounced render', async () => {
    render(
      <VisualEditor sampleVideoUrl="/media/raw/x/sample.mp4" initialConfig={BASE_CONFIG} onConfirm={vi.fn()} />,
    )
    // Let the mount-time loadFFmpeg().then(...) microtask resolve before dragging.
    await waitFor(() => expect(ffmpegLoader.loadFFmpeg).toHaveBeenCalled())

    drag('watermark-box', 36, 0) // 36px / 360px display width = +0.1 fraction

    await waitFor(() => expect(ffmpegPreview.buildFilterComplexFromConfig).toHaveBeenCalled(), {
      timeout: 1000,
    })

    const call = vi.mocked(ffmpegPreview.buildFilterComplexFromConfig).mock.calls.at(-1)
    const configArg = call?.[0] as EditConfig
    expect(configArg.watermark_region).toBe('0.4,0.9,0.7,0.99')
  })

  it('dragging a point box beyond the frame clamps it to the bounds', () => {
    render(
      <VisualEditor sampleVideoUrl="/media/raw/x/sample.mp4" initialConfig={BASE_CONFIG} onConfirm={vi.fn()} />,
    )

    drag('logo-box', -100000, -100000) // huge negative drag, way past the top-left corner

    const box = screen.getByTestId('logo-box')
    expect(box.style.left).toBe('0%')
    expect(box.style.top).toBe('0%')
  })

  it('resizing the watermark region below the minimum size is rejected', () => {
    render(
      <VisualEditor sampleVideoUrl="/media/raw/x/sample.mp4" initialConfig={BASE_CONFIG} onConfirm={vi.fn()} />,
    )

    drag('watermark-resize-handle', -100000, -100000) // try to shrink to nothing

    const box = screen.getByTestId('watermark-box')
    // width/height must not collapse below the enforced minimum (2%)
    expect(parseFloat(box.style.width)).toBeGreaterThanOrEqual(2)
    expect(parseFloat(box.style.height)).toBeGreaterThanOrEqual(2)
  })

  it('falls back to static mode when FFmpeg.wasm fails to load', async () => {
    vi.mocked(ffmpegLoader.loadFFmpeg).mockRejectedValue(new ffmpegLoader.FFmpegLoadError('no wasm'))

    render(
      <VisualEditor sampleVideoUrl="/media/raw/x/sample.mp4" initialConfig={BASE_CONFIG} onConfirm={vi.fn()} />,
    )

    await waitFor(() => expect(screen.getByTestId('static-fallback-notice')).toBeInTheDocument())
  })

  it('confirming calls onConfirm with resolved {x,y} coordinates', () => {
    const onConfirm = vi.fn()
    render(
      <VisualEditor sampleVideoUrl="/media/raw/x/sample.mp4" initialConfig={BASE_CONFIG} onConfirm={onConfirm} />,
    )

    fireEvent.click(screen.getByText('Confirmar posição'))

    expect(onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        logo_position: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
        icon_position: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
      }),
    )
  })
})
