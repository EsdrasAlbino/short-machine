import { afterEach, describe, expect, it, vi } from 'vitest'
import { getPreset, getSampleVideo, listPresets, runStreamUrl, savePreset, startRun } from './api'
import type { PipelineConfig } from './types'

const CONFIG: PipelineConfig = {
  run_name: 'test',
  download: { profile_url: 'https://www.tiktok.com/@x', video_count: 1 },
  edit: { logo_path: '', icon_path: '', watermark_region: '', captions_enabled: false, background_blur: true },
  schedule: { integration_id: 'abc', posts_per_day: 1, times_utc: ['15:00'] },
}

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok,
    status,
    statusText: 'error',
    json: async () => body,
  }) as unknown as typeof fetch
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('api client', () => {
  it('listPresets fetches /api/presets', async () => {
    mockFetchOnce(['a', 'b'])
    const result = await listPresets()
    expect(result).toEqual(['a', 'b'])
    expect(fetch).toHaveBeenCalledWith('/api/presets', undefined)
  })

  it('getPreset fetches /api/presets/{name}', async () => {
    mockFetchOnce(CONFIG)
    const result = await getPreset('test')
    expect(result).toEqual(CONFIG)
  })

  it('savePreset posts JSON and returns the response', async () => {
    mockFetchOnce({ ok: true, run_name: 'test' })
    const result = await savePreset(CONFIG)
    expect(result).toEqual({ ok: true, run_name: 'test' })
    const [, init] = (fetch as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(JSON.parse(init.body)).toEqual(CONFIG)
  })

  it('getSampleVideo posts profile_url and returns video_url', async () => {
    mockFetchOnce({ video_url: '/media/raw/x/sample.mp4' })
    const result = await getSampleVideo('https://www.tiktok.com/@x')
    expect(result.video_url).toBe('/media/raw/x/sample.mp4')
  })

  it('startRun posts config/start_date/dry_run', async () => {
    mockFetchOnce({ ok: true, run_id: 'abc123' })
    const result = await startRun(CONFIG, '2026-08-01', true)
    expect(result.run_id).toBe('abc123')
  })

  it('runStreamUrl builds the SSE endpoint URL', () => {
    expect(runStreamUrl('abc123')).toBe('/api/runs/abc123/stream')
  })

  it('throws the backend error detail on failure', async () => {
    mockFetchOnce({ detail: 'run_name is required' }, false, 400)
    await expect(listPresets()).rejects.toThrow('run_name is required')
  })
})
