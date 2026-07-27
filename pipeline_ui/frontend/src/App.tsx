import { useState } from 'react'
import PresetForm from './components/PresetForm'
import RunLog from './components/RunLog'
import VisualEditor from './components/VisualEditor'
import { getSampleVideo, startRun } from './lib/api'
import type { PipelineConfig } from './lib/types'

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

function App() {
  const [config, setConfig] = useState<PipelineConfig>(emptyConfig())
  const [startDate, setStartDate] = useState('')
  const [dryRun, setDryRun] = useState(false)

  const [sampleVideoUrl, setSampleVideoUrl] = useState<string | null>(null)
  const [editorError, setEditorError] = useState('')

  const [runId, setRunId] = useState<string | null>(null)
  const [runError, setRunError] = useState('')

  async function handleOpenEditor() {
    setEditorError('')
    try {
      const { video_url } = await getSampleVideo(config.download.profile_url)
      setSampleVideoUrl(video_url)
    } catch (err) {
      setEditorError(err instanceof Error ? err.message : 'Falha ao carregar vídeo de exemplo')
    }
  }

  function handleEditorConfirm(edit: PipelineConfig['edit']) {
    setConfig((current) => ({ ...current, edit }))
    setSampleVideoUrl(null)
  }

  async function handleRun() {
    setRunError('')
    try {
      const { run_id } = await startRun(config, startDate, dryRun)
      setRunId(run_id)
    } catch (err) {
      setRunError(err instanceof Error ? err.message : 'Erro ao iniciar a execução')
    }
  }

  if (runId) {
    return (
      <main>
        <h1>
          Execução <code>{runId}</code>
        </h1>
        <RunLog runId={runId} />
      </main>
    )
  }

  return (
    <main>
      <h1>Pipeline TikTok → Postiz</h1>

      <PresetForm
        config={config}
        onConfigChange={setConfig}
        startDate={startDate}
        onStartDateChange={setStartDate}
        dryRun={dryRun}
        onDryRunChange={setDryRun}
      />

      <button type="button" onClick={handleOpenEditor}>
        Posicionar visualmente
      </button>
      {editorError && <div className="error">{editorError}</div>}

      {sampleVideoUrl && (
        <VisualEditor
          sampleVideoUrl={sampleVideoUrl}
          initialConfig={config.edit}
          onConfirm={handleEditorConfirm}
        />
      )}

      {runError && <div className="error">{runError}</div>}
      <button type="button" onClick={handleRun}>
        Rodar
      </button>
    </main>
  )
}

export default App
