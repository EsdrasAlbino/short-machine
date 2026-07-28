import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as ffmpegLoader from '../lib/ffmpegLoader'
import type { EditConfig } from '../lib/types'
import EditStep from './EditStep'

const EDIT_CONFIG: EditConfig = {
  logo_path: 'assets/logo.png',
  icon_path: 'assets/icon.png',
  watermark_region: '0.3,0.9,0.6,0.99',
  captions_enabled: false,
  background_blur: true,
}

beforeEach(() => {
  vi.spyOn(ffmpegLoader, 'loadFFmpeg').mockRejectedValue(new ffmpegLoader.FFmpegLoadError('no wasm in jsdom'))
})

function renderStep(editConfig: EditConfig = EDIT_CONFIG) {
  const onEditConfigChange = vi.fn()
  const onBack = vi.fn()
  const onNext = vi.fn()
  render(
    <EditStep
      editConfig={editConfig}
      sampleVideoUrl="/media/raw/x/sample.mp4"
      onEditConfigChange={onEditConfigChange}
      onBack={onBack}
      onNext={onNext}
    />,
  )
  return { onEditConfigChange, onBack, onNext }
}

describe('EditStep', () => {
  it('renders branding fields with current values and the visual editor', () => {
    renderStep()
    expect(screen.getByLabelText('Logo (caminho do arquivo)')).toHaveValue('assets/logo.png')
    expect(screen.getByLabelText('Ícone (caminho do arquivo)')).toHaveValue('assets/icon.png')
    expect(screen.getByTestId('editor-frame')).toBeInTheDocument()
  })

  it('editing a branding field calls onEditConfigChange', () => {
    const { onEditConfigChange } = renderStep()
    fireEvent.change(screen.getByLabelText('Logo (caminho do arquivo)'), {
      target: { value: 'assets/new-logo.png' },
    })
    expect(onEditConfigChange).toHaveBeenCalledWith({ ...EDIT_CONFIG, logo_path: 'assets/new-logo.png' })
  })

  it('confirming the position in the visual editor calls onNext with the resolved config', async () => {
    const { onNext } = renderStep()

    fireEvent.click(screen.getByText('Confirmar posição'))

    await waitFor(() =>
      expect(onNext).toHaveBeenCalledWith(
        expect.objectContaining({
          logo_position: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
          icon_position: expect.objectContaining({ x: expect.any(Number), y: expect.any(Number) }),
        }),
      ),
    )
  })

  it('clicking Voltar calls onBack', () => {
    const { onBack } = renderStep()
    fireEvent.click(screen.getByText('Voltar'))
    expect(onBack).toHaveBeenCalled()
  })
})
