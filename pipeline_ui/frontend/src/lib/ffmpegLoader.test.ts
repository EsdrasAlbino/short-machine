import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@ffmpeg/util', () => ({
  toBlobURL: vi.fn().mockResolvedValue('blob:mock-url'),
}))

afterEach(() => {
  vi.restoreAllMocks()
  vi.resetModules()
})

describe('loadFFmpeg', () => {
  it('resolves with a usable ffmpeg instance on success', async () => {
    const loadMock = vi.fn().mockResolvedValue(undefined)
    class FakeFFmpeg {
      load = loadMock
    }
    vi.doMock('@ffmpeg/ffmpeg', () => ({ FFmpeg: FakeFFmpeg }))

    const { loadFFmpeg } = await import('./ffmpegLoader')
    const ffmpeg = await loadFFmpeg()

    expect(loadMock).toHaveBeenCalled()
    expect(ffmpeg).toBeTruthy()
  })

  it('rejects with FFmpegLoadError when loading fails', async () => {
    const loadMock = vi.fn().mockRejectedValue(new Error('network error'))
    class FakeFFmpeg {
      load = loadMock
    }
    vi.doMock('@ffmpeg/ffmpeg', () => ({ FFmpeg: FakeFFmpeg }))

    const { loadFFmpeg, FFmpegLoadError } = await import('./ffmpegLoader')
    await expect(loadFFmpeg()).rejects.toBeInstanceOf(FFmpegLoadError)
  })
})
