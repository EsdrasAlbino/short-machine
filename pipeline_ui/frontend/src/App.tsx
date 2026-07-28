import { useState } from 'react'
import DownloadStep from './components/DownloadStep'
import EditStep from './components/EditStep'
import ExecuteStep from './components/ExecuteStep'
import RunLog from './components/RunLog'
import type { EditConfig, PipelineConfig } from './lib/types'

type Step = 'download' | 'edit' | 'execute'

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
  const [step, setStep] = useState<Step>('download')
  const [sampleVideoUrl, setSampleVideoUrl] = useState<string | null>(null)

  const [startDate, setStartDate] = useState('')
  const [dryRun, setDryRun] = useState(false)
  const [runId, setRunId] = useState<string | null>(null)

  function handleDownloadNext(videoUrl: string) {
    setSampleVideoUrl(videoUrl)
    setStep('edit')
  }

  function handleEditConfigChange(edit: EditConfig) {
    setConfig((current) => ({ ...current, edit }))
  }

  function handleEditNext(edit: EditConfig) {
    setConfig((current) => ({ ...current, edit }))
    setStep('execute')
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

      {step === 'download' && (
        <DownloadStep config={config} onConfigChange={setConfig} onNext={handleDownloadNext} />
      )}

      {step === 'edit' && sampleVideoUrl && (
        <EditStep
          editConfig={config.edit}
          sampleVideoUrl={sampleVideoUrl}
          onEditConfigChange={handleEditConfigChange}
          onBack={() => setStep('download')}
          onNext={handleEditNext}
        />
      )}

      {step === 'execute' && (
        <ExecuteStep
          config={config}
          startDate={startDate}
          onStartDateChange={setStartDate}
          dryRun={dryRun}
          onDryRunChange={setDryRun}
          onConfigChange={setConfig}
          onBack={() => setStep('edit')}
          onRunStarted={setRunId}
        />
      )}
    </main>
  )
}

export default App
