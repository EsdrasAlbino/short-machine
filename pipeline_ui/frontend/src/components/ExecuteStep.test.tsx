import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import * as api from '../lib/api'
import type { PipelineConfig } from '../lib/types'
import ExecuteStep from './ExecuteStep'

const CONFIG: PipelineConfig = {
  run_name: 'natal',
  download: { profile_url: 'https://www.tiktok.com/@hoyechi_us', video_count: 51 },
  edit: {
    logo_path: 'assets/logo_natal.jpg',
    icon_path: 'assets/icon_natal.png',
    icon_position: 'top-left',
    watermark_region: '0.3,0.9,0.6,0.99',
    captions_enabled: false,
    background_blur: true,
  },
  schedule: { integration_id: 'cms1yozrw00cxlm84wj2b46e6', posts_per_day: 1, times_utc: ['13:00'] },
}

function renderStep(config: PipelineConfig = CONFIG) {
  const onConfigChange = vi.fn()
  const onBack = vi.fn()
  const onRunStarted = vi.fn()
  render(
    <ExecuteStep
      config={config}
      startDate="2026-08-01"
      onStartDateChange={vi.fn()}
      dryRun={false}
      onDryRunChange={vi.fn()}
      onConfigChange={onConfigChange}
      onBack={onBack}
      onRunStarted={onRunStarted}
    />,
  )
  return { onConfigChange, onBack, onRunStarted }
}

describe('ExecuteStep', () => {
  it('renders scheduling fields with current values', () => {
    renderStep()
    expect(screen.getByLabelText('ID da integração (canal Postiz)')).toHaveValue(
      'cms1yozrw00cxlm84wj2b46e6',
    )
    expect(screen.getByLabelText('Horários UTC (separados por vírgula)')).toHaveValue('13:00')
  })

  it('saving posts the current config', async () => {
    vi.spyOn(api, 'savePreset').mockResolvedValue({ ok: true, run_name: 'natal' })
    renderStep()

    await userEvent.click(screen.getByText('Salvar preset'))

    await waitFor(() => expect(api.savePreset).toHaveBeenCalledWith(CONFIG))
  })

  it('running starts the pipeline and reports the run id', async () => {
    vi.spyOn(api, 'startRun').mockResolvedValue({ ok: true, run_id: 'run-123' })
    const { onRunStarted } = renderStep()

    await userEvent.click(screen.getByText('Rodar'))

    await waitFor(() => expect(api.startRun).toHaveBeenCalledWith(CONFIG, '2026-08-01', false))
    expect(onRunStarted).toHaveBeenCalledWith('run-123')
  })

  it('shows an inline error and does not report a run id when starting fails', async () => {
    vi.spyOn(api, 'startRun').mockRejectedValue(new Error('Falha ao agendar'))
    const { onRunStarted } = renderStep()

    await userEvent.click(screen.getByText('Rodar'))

    await waitFor(() => expect(screen.getByText('Falha ao agendar')).toBeInTheDocument())
    expect(onRunStarted).not.toHaveBeenCalled()
  })

  it('clicking Voltar calls onBack', () => {
    const { onBack } = renderStep()
    fireEvent.click(screen.getByText('Voltar'))
    expect(onBack).toHaveBeenCalled()
  })
})
