import { useState } from 'react'
import { savePreset, startRun } from '../lib/api'
import type { PipelineConfig } from '../lib/types'

export interface ExecuteStepProps {
  config: PipelineConfig
  startDate: string
  onStartDateChange: (value: string) => void
  dryRun: boolean
  onDryRunChange: (value: boolean) => void
  onConfigChange: (config: PipelineConfig) => void
  onBack: () => void
  onRunStarted: (runId: string) => void
}

export default function ExecuteStep({
  config,
  startDate,
  onStartDateChange,
  dryRun,
  onDryRunChange,
  onConfigChange,
  onBack,
  onRunStarted,
}: ExecuteStepProps) {
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [runError, setRunError] = useState('')

  function updateSchedule(partial: Partial<PipelineConfig['schedule']>) {
    onConfigChange({ ...config, schedule: { ...config.schedule, ...partial } })
  }

  async function handleSave() {
    setSaveError('')
    setSaving(true)
    try {
      await savePreset(config)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Erro ao salvar preset')
    } finally {
      setSaving(false)
    }
  }

  async function handleRun() {
    setRunError('')
    try {
      const { run_id } = await startRun(config, startDate, dryRun)
      onRunStarted(run_id)
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Erro ao iniciar a execução')
    }
  }

  return (
    <section aria-label="Etapa 3: Execução">
      <h2>3. Execução</h2>

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

      <label htmlFor="start_date">
        Data de início
        <input id="start_date" type="date" value={startDate} onChange={(e) => onStartDateChange(e.target.value)} />
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

      {saveError && <div className="error">{saveError}</div>}
      {runError && <div className="error">{runError}</div>}

      <div className="step-actions">
        <button type="button" className="btn btn-secondary" onClick={onBack}>
          Voltar
        </button>
        <button type="button" className="btn btn-secondary" onClick={handleSave} disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar preset'}
        </button>
        <button type="button" className="btn btn-primary" onClick={handleRun}>
          Rodar
        </button>
      </div>
    </section>
  )
}
