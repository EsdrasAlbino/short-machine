import type { PipelineConfig } from './types'

async function parseErrorDetail(response: Response): Promise<string> {
  try {
    const data = await response.json()
    return data.detail || data.error || response.statusText
  } catch {
    return response.statusText
  }
}

async function requestJson<T>(input: string, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init)
  if (!response.ok) {
    throw new Error(await parseErrorDetail(response))
  }
  return response.json() as Promise<T>
}

export function listPresets(): Promise<string[]> {
  return requestJson('/api/presets')
}

export function getPreset(name: string): Promise<PipelineConfig> {
  return requestJson(`/api/presets/${encodeURIComponent(name)}`)
}

export function savePreset(config: PipelineConfig): Promise<{ ok: boolean; run_name: string }> {
  return requestJson('/api/presets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  })
}

export function getSampleVideo(profileUrl: string): Promise<{ video_url: string }> {
  return requestJson('/api/sample-video', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ profile_url: profileUrl }),
  })
}

export function startRun(
  config: PipelineConfig,
  startDate: string,
  dryRun: boolean,
): Promise<{ ok: boolean; run_id: string }> {
  return requestJson('/api/runs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ config, start_date: startDate, dry_run: dryRun }),
  })
}

export function runStreamUrl(runId: string): string {
  return `/api/runs/${encodeURIComponent(runId)}/stream`
}
