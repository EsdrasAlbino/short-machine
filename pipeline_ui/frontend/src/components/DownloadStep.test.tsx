import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as api from '../lib/api'
import type { PipelineConfig } from '../lib/types'
import DownloadStep from './DownloadStep'

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
  const onNext = vi.fn()
  render(<DownloadStep config={config} onConfigChange={onConfigChange} onNext={onNext} />)
  return { onConfigChange, onNext }
}

beforeEach(() => {
  vi.spyOn(api, 'listPresets').mockResolvedValue(['natal'])
})

describe('DownloadStep', () => {
  it('renders download fields with current values', () => {
    renderStep()
    expect(screen.getByLabelText('Perfil TikTok (URL)')).toHaveValue(CONFIG.download.profile_url)
    expect(screen.getByLabelText('Quantidade de vídeos')).toHaveValue(51)
  })

  it('loading a preset calls onConfigChange with the full config', async () => {
    vi.spyOn(api, 'getPreset').mockResolvedValue(CONFIG)
    const { onConfigChange } = renderStep()

    await waitFor(() => expect(screen.getByRole('option', { name: 'natal' })).toBeInTheDocument())
    await userEvent.selectOptions(screen.getByLabelText('Preset'), 'natal')

    await waitFor(() => expect(onConfigChange).toHaveBeenCalledWith(CONFIG))
  })

  it('fetching a sample video successfully advances to the next step', async () => {
    vi.spyOn(api, 'getSampleVideo').mockResolvedValue({ video_url: '/media/raw/x/sample.mp4' })
    const { onNext } = renderStep()

    await userEvent.click(screen.getByText('Buscar vídeo e continuar'))

    await waitFor(() => expect(onNext).toHaveBeenCalledWith('/media/raw/x/sample.mp4'))
  })

  it('shows the backend error inline and does not advance when the download fails', async () => {
    vi.spyOn(api, 'getSampleVideo').mockRejectedValue(
      new Error('Download falhou: This user\'s account is either private or has embedding disabled'),
    )
    const { onNext } = renderStep()

    await userEvent.click(screen.getByText('Buscar vídeo e continuar'))

    await waitFor(() =>
      expect(
        screen.getByText("Download falhou: This user's account is either private or has embedding disabled"),
      ).toBeInTheDocument(),
    )
    expect(onNext).not.toHaveBeenCalled()
  })
})
