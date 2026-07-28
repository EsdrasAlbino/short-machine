import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import * as api from './lib/api'
import * as ffmpegLoader from './lib/ffmpegLoader'

// Minimal stub -- reaching the run step mounts RunLog, which opens a real
// EventSource; jsdom doesn't implement it. See components/RunLog.test.tsx
// for the fuller fake used to drive its message/reconnect behavior.
class StubEventSource {
  static CONNECTING = 0
  readyState = StubEventSource.CONNECTING
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  url: string
  constructor(url: string) {
    this.url = url
  }
  addEventListener() {}
  close() {}
}

beforeEach(() => {
  // @ts-expect-error -- test double for the browser EventSource API
  globalThis.EventSource = StubEventSource
  vi.spyOn(api, 'listPresets').mockResolvedValue([])
  vi.spyOn(api, 'getSampleVideo').mockResolvedValue({ video_url: '/media/raw/x/sample.mp4' })
  vi.spyOn(api, 'savePreset').mockResolvedValue({ ok: true, run_name: 'test' })
  vi.spyOn(ffmpegLoader, 'loadFFmpeg').mockRejectedValue(new ffmpegLoader.FFmpegLoadError('no wasm in jsdom'))
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('App', () => {
  it('starts on the download step', () => {
    render(<App />)
    expect(screen.getByText('Pipeline TikTok → Postiz')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '1. Download' })).toBeInTheDocument()
    expect(screen.getByLabelText('Perfil TikTok (URL)')).toBeInTheDocument()
  })

  it('does not advance past download when the sample fetch fails', async () => {
    vi.spyOn(api, 'getSampleVideo').mockRejectedValue(new Error('Download falhou: conta privada'))
    render(<App />)

    fireEvent.change(screen.getByLabelText('Perfil TikTok (URL)'), {
      target: { value: 'https://www.tiktok.com/@privada' },
    })
    fireEvent.click(screen.getByText('Buscar vídeo e continuar'))

    await waitFor(() => expect(screen.getByText('Download falhou: conta privada')).toBeInTheDocument())
    expect(screen.queryByRole('heading', { name: '2. Edição' })).not.toBeInTheDocument()
  })

  it('walks through download -> edit -> execute -> run, ending up in the run log', async () => {
    vi.spyOn(api, 'startRun').mockResolvedValue({ ok: true, run_id: 'run-123' })
    render(<App />)

    fireEvent.change(screen.getByLabelText('Perfil TikTok (URL)'), {
      target: { value: 'https://www.tiktok.com/@x' },
    })
    fireEvent.click(screen.getByText('Buscar vídeo e continuar'))
    await waitFor(() => expect(screen.getByRole('heading', { name: '2. Edição' })).toBeInTheDocument())
    expect(screen.getByTestId('editor-frame')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Confirmar posição'))
    await waitFor(() => expect(screen.getByRole('heading', { name: '3. Execução' })).toBeInTheDocument())

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

    fireEvent.click(screen.getByText('Rodar'))
    await waitFor(() => expect(screen.getByText('run-123')).toBeInTheDocument())
  })

  it('going back from edit to download preserves the already-fetched sample video', async () => {
    render(<App />)

    fireEvent.change(screen.getByLabelText('Perfil TikTok (URL)'), {
      target: { value: 'https://www.tiktok.com/@x' },
    })
    fireEvent.click(screen.getByText('Buscar vídeo e continuar'))
    await waitFor(() => expect(screen.getByRole('heading', { name: '2. Edição' })).toBeInTheDocument())

    fireEvent.click(screen.getByText('Voltar'))
    await waitFor(() => expect(screen.getByRole('heading', { name: '1. Download' })).toBeInTheDocument())

    // Confirms getSampleVideo isn't re-fetched just by revisiting download.
    expect(api.getSampleVideo).toHaveBeenCalledTimes(1)
  })
})
