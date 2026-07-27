import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as api from './lib/api'
import * as ffmpegLoader from './lib/ffmpegLoader'

beforeEach(() => {
  vi.spyOn(api, 'listPresets').mockResolvedValue([])
  vi.spyOn(api, 'getSampleVideo').mockResolvedValue({ video_url: '/media/raw/x/sample.mp4' })
  vi.spyOn(api, 'savePreset').mockResolvedValue({ ok: true, run_name: 'test' })
  vi.spyOn(ffmpegLoader, 'loadFFmpeg').mockRejectedValue(new ffmpegLoader.FFmpegLoadError('no wasm in jsdom'))
})

describe('App', () => {
  it('renders the page title and the config form', () => {
    render(<App />)
    expect(screen.getByText('Pipeline TikTok → Postiz')).toBeInTheDocument()
    expect(screen.getByLabelText('Perfil TikTok (URL)')).toBeInTheDocument()
  })

  it('confirming a position in the visual editor updates the config saved by the form', async () => {
    render(<App />)

    fireEvent.change(screen.getByLabelText('Perfil TikTok (URL)'), {
      target: { value: 'https://www.tiktok.com/@x' },
    })

    fireEvent.click(screen.getByText('Posicionar visualmente'))
    await waitFor(() => expect(screen.getByTestId('editor-frame')).toBeInTheDocument())

    fireEvent.click(screen.getByText('Confirmar posição'))

    // The editor unmounts once confirmed, and its resolved {x,y} coordinates
    // are now part of the form's config.
    await waitFor(() => expect(screen.queryByTestId('editor-frame')).not.toBeInTheDocument())

    fireEvent.click(screen.getByText('Salvar preset'))

    await waitFor(() =>
      expect(api.savePreset).toHaveBeenCalledWith(
        expect.objectContaining({
          edit: expect.objectContaining({
            logo_position: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
            icon_position: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
          }),
        }),
      ),
    )
  })
})
