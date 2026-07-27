import { useEffect, useState } from 'react'
import { getPreset, listPresets, savePreset } from '../lib/api'
import type { PipelineConfig } from '../lib/types'

function emptyConfig(): PipelineConfig {
  return {
    run_name: '',
    download: { profile_url: '', video_count: 1 },
    edit: {
      logo_path: '',
      icon_path: '',
      watermark_region: '',
      captions_enabled: false,
      background_blur: true,
    },
    schedule: { integration_id: '', posts_per_day: 1, times_utc: [] },
  }
}

export interface PresetFormProps {
  config: PipelineConfig
  onConfigChange: (config: PipelineConfig) => void
  startDate: string
  onStartDateChange: (value: string) => void
  dryRun: boolean
  onDryRunChange: (value: boolean) => void
}

export default function PresetForm({
  config,
  onConfigChange,
  startDate,
  onStartDateChange,
  dryRun,
  onDryRunChange,
}: PresetFormProps) {
  const [presetNames, setPresetNames] = useState<string[]>([])
  const [selectedPreset, setSelectedPreset] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    listPresets().then(setPresetNames).catch(() => setPresetNames([]))
  }, [])

  async function handlePresetSelect(name: string) {
    setSelectedPreset(name)
    setError('')
    if (!name) {
      onConfigChange(emptyConfig())
      return
    }
    try {
      const loaded = await getPreset(name)
      onConfigChange(loaded)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar preset')
    }
  }

  async function handleSave() {
    setError('')
    setSaving(true)
    try {
      const result = await savePreset(config)
      if (!presetNames.includes(result.run_name)) {
        setPresetNames([...presetNames, result.run_name])
      }
      setSelectedPreset(result.run_name)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar preset')
    } finally {
      setSaving(false)
    }
  }

  function update(partial: Partial<PipelineConfig>) {
    onConfigChange({ ...config, ...partial })
  }

  function updateDownload(partial: Partial<PipelineConfig['download']>) {
    update({ download: { ...config.download, ...partial } })
  }

  function updateEdit(partial: Partial<PipelineConfig['edit']>) {
    update({ edit: { ...config.edit, ...partial } })
  }

  function updateSchedule(partial: Partial<PipelineConfig['schedule']>) {
    update({ schedule: { ...config.schedule, ...partial } })
  }

  return (
    <form aria-label="Config do pipeline">
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

      <fieldset>
        <legend>Config</legend>

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

        <label htmlFor="logo_path">
          Logo (caminho do arquivo)
          <input
            id="logo_path"
            type="text"
            value={config.edit.logo_path}
            onChange={(e) => updateEdit({ logo_path: e.target.value })}
          />
        </label>

        <label htmlFor="icon_path">
          Ícone (caminho do arquivo)
          <input
            id="icon_path"
            type="text"
            value={config.edit.icon_path}
            onChange={(e) => updateEdit({ icon_path: e.target.value })}
          />
        </label>

        <label className="checkbox" htmlFor="captions_enabled">
          <input
            id="captions_enabled"
            type="checkbox"
            checked={config.edit.captions_enabled}
            onChange={(e) => updateEdit({ captions_enabled: e.target.checked })}
          />
          Legendas automáticas
        </label>

        <label className="checkbox" htmlFor="background_blur">
          <input
            id="background_blur"
            type="checkbox"
            checked={config.edit.background_blur}
            onChange={(e) => updateEdit({ background_blur: e.target.checked })}
          />
          Fundo desfocado
        </label>

        <h3>Agendamento</h3>
        <label htmlFor="integration_id">
          ID da integração (canal Postiz)
          <input
            id="integration_id"
            type="text"
            value={config.schedule.integration_id}
            onChange={(e) => updateSchedule({ integration_id: e.target.value })}
          />
        </label>

        <label htmlFor="posts_per_day">
          Posts por dia
          <input
            id="posts_per_day"
            type="number"
            min={1}
            value={config.schedule.posts_per_day}
            onChange={(e) => updateSchedule({ posts_per_day: Number(e.target.value) || 0 })}
          />
        </label>

        <label htmlFor="times_utc">
          Horários UTC (separados por vírgula)
          <input
            id="times_utc"
            type="text"
            placeholder="15:00,20:00"
            value={config.schedule.times_utc.join(',')}
            onChange={(e) =>
              updateSchedule({
                times_utc: e.target.value
                  .split(',')
                  .map((t) => t.trim())
                  .filter(Boolean),
              })
            }
          />
        </label>

        <h3>Execução</h3>
        <label htmlFor="start_date">
          Data de início
          <input
            id="start_date"
            type="date"
            value={startDate}
            onChange={(e) => onStartDateChange(e.target.value)}
          />
        </label>

        <label className="checkbox" htmlFor="dry_run">
          <input
            id="dry_run"
            type="checkbox"
            checked={dryRun}
            onChange={(e) => onDryRunChange(e.target.checked)}
          />
          Dry-run (não publica de verdade)
        </label>
      </fieldset>

      {error && <div className="error">{error}</div>}

      <button type="button" onClick={handleSave} disabled={saving}>
        {saving ? 'Salvando...' : 'Salvar preset'}
      </button>
    </form>
  )
}
