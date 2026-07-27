import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../lib/api'
import type { PipelineConfig } from '../lib/types'
import PresetForm from './PresetForm'

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

function renderForm(config: PipelineConfig = CONFIG) {
  const onConfigChange = vi.fn()
  render(
    <PresetForm
      config={config}
      onConfigChange={onConfigChange}
      startDate="2026-08-01"
      onStartDateChange={vi.fn()}
      dryRun={false}
      onDryRunChange={vi.fn()}
    />,
  )
  return { onConfigChange }
}

beforeEach(() => {
  vi.spyOn(api, 'listPresets').mockResolvedValue(['natal'])
})

describe('PresetForm', () => {
  it('renders all config fields with current values', () => {
    renderForm()
    expect(screen.getByLabelText('Perfil TikTok (URL)')).toHaveValue(CONFIG.download.profile_url)
    expect(screen.getByLabelText('Quantidade de vídeos')).toHaveValue(51)
    expect(screen.getByLabelText('Logo (caminho do arquivo)')).toHaveValue('assets/logo_natal.jpg')
    expect(screen.getByLabelText('ID da integração (canal Postiz)')).toHaveValue(
      'cms1yozrw00cxlm84wj2b46e6',
    )
    expect(screen.getByLabelText('Horários UTC (separados por vírgula)')).toHaveValue('13:00')
  })

  it('loading a preset (including a legacy position string) calls onConfigChange with it', async () => {
    vi.spyOn(api, 'getPreset').mockResolvedValue(CONFIG)
    const { onConfigChange } = renderForm()

    await waitFor(() => expect(screen.getByRole('option', { name: 'natal' })).toBeInTheDocument())
    await userEvent.selectOptions(screen.getByLabelText('Preset'), 'natal')

    await waitFor(() => expect(onConfigChange).toHaveBeenCalledWith(CONFIG))
  })

  it('saving posts the current config and shows the preset in the dropdown', async () => {
    vi.spyOn(api, 'savePreset').mockResolvedValue({ ok: true, run_name: 'natal' })
    renderForm()

    await userEvent.click(screen.getByText('Salvar preset'))

    await waitFor(() => expect(api.savePreset).toHaveBeenCalledWith(CONFIG))
  })
})
