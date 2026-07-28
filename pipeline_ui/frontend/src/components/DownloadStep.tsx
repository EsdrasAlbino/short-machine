import { useEffect, useState } from 'react'
import { getPreset, getSampleVideo, listPresets } from '../lib/api'
import type { PipelineConfig } from '../lib/types'

export interface DownloadStepProps {
  config: PipelineConfig
  onConfigChange: (config: PipelineConfig) => void
  onNext: (sampleVideoUrl: string) => void
}

export default function DownloadStep({ config, onConfigChange, onNext }: DownloadStepProps) {
  const [presetNames, setPresetNames] = useState<string[]>([])
  const [selectedPreset, setSelectedPreset] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    listPresets().then(setPresetNames).catch(() => setPresetNames([]))
  }, [])

  async function handlePresetSelect(name: string) {
    setSelectedPreset(name)
    setError('')
    if (!name) return
    try {
      const loaded = await getPreset(name)
      onConfigChange(loaded)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar preset')
    }
  }

  function update(partial: Partial<PipelineConfig>) {
    onConfigChange({ ...config, ...partial })
  }

  function updateDownload(partial: Partial<PipelineConfig['download']>) {
    update({ download: { ...config.download, ...partial } })
  }

  async function handleFetchAndContinue() {
    setError('')
    setLoading(true)
    try {
      const { video_url } = await getSampleVideo(config.download.profile_url)
      onNext(video_url)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao buscar vídeo de exemplo')
    } finally {
      setLoading(false)
    }
  }

  return (
    <section aria-label="Etapa 1: Download">
      <h2>1. Download</h2>

      <label htmlFor="preset-select">
        Preset
        <select
          id="preset-select"
          value={selectedPreset}
          onChange={(e) => handlePresetSelect(e.target.value)}
        >
          <option value="">-- Novo preset --</option>
          {presetNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <label htmlFor="run_name">
        Nome do preset
        <input
          id="run_name"
          type="text"
          value={config.run_name}
          onChange={(e) => update({ run_name: e.target.value })}
        />
      </label>

      <label htmlFor="profile_url">
        Perfil TikTok (URL)
        <input
          id="profile_url"
          type="text"
          placeholder="https://www.tiktok.com/@conta"
          value={config.download.profile_url}
          onChange={(e) => updateDownload({ profile_url: e.target.value })}
        />
      </label>

      <label htmlFor="video_count">
        Quantidade de vídeos
        <input
          id="video_count"
          type="number"
          min={1}
          value={config.download.video_count}
          onChange={(e) => updateDownload({ video_count: Number(e.target.value) || 0 })}
        />
      </label>

      {error && <div className="error">{error}</div>}

      <div className="step-actions">
        <button
          type="button"
          className="btn btn-primary"
          onClick={handleFetchAndContinue}
          disabled={loading || !config.download.profile_url}
        >
          {loading ? 'Buscando vídeo...' : 'Buscar vídeo e continuar'}
        </button>
      </div>
    </section>
  )
}
