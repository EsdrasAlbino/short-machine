import type { EditConfig } from '../lib/types'
import VisualEditor from './VisualEditor'

export interface EditStepProps {
  editConfig: EditConfig
  sampleVideoUrl: string
  onEditConfigChange: (edit: EditConfig) => void
  onBack: () => void
  onNext: (edit: EditConfig) => void
}

export default function EditStep({
  editConfig,
  sampleVideoUrl,
  onEditConfigChange,
  onBack,
  onNext,
}: EditStepProps) {
  function update(partial: Partial<EditConfig>) {
    onEditConfigChange({ ...editConfig, ...partial })
  }

  return (
    <section aria-label="Etapa 2: Edição">
      <h2>2. Edição</h2>

      <label htmlFor="logo_path">
        Logo (caminho do arquivo)
        <input
          id="logo_path"
          type="text"
          value={editConfig.logo_path}
          onChange={(e) => update({ logo_path: e.target.value })}
        />
      </label>

      <label htmlFor="icon_path">
        Ícone (caminho do arquivo)
        <input
          id="icon_path"
          type="text"
          value={editConfig.icon_path}
          onChange={(e) => update({ icon_path: e.target.value })}
        />
      </label>

      <label className="checkbox" htmlFor="captions_enabled">
        <input
          id="captions_enabled"
          type="checkbox"
          checked={editConfig.captions_enabled}
          onChange={(e) => update({ captions_enabled: e.target.checked })}
        />
        Legendas automáticas
      </label>

      <label className="checkbox" htmlFor="background_blur">
        <input
          id="background_blur"
          type="checkbox"
          checked={editConfig.background_blur}
          onChange={(e) => update({ background_blur: e.target.checked })}
        />
        Fundo desfocado
      </label>

      <VisualEditor sampleVideoUrl={sampleVideoUrl} initialConfig={editConfig} onConfirm={onNext} />

      <button type="button" onClick={onBack}>
        Voltar
      </button>
    </section>
  )
}
