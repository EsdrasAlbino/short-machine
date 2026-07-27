import { useEffect, useRef, useState } from 'react'
import { runStreamUrl } from '../lib/api'

export interface RunLogProps {
  runId: string
}

export default function RunLog({ runId }: RunLogProps) {
  const [log, setLog] = useState('')
  const [status, setStatus] = useState('Conectando...')
  const bufferRef = useRef('')

  useEffect(() => {
    const source = new EventSource(runStreamUrl(runId))

    // The server always replays the log file from the start on every new
    // connection, so each (re)open must reset the local buffer -- otherwise
    // a reconnect (which EventSource does automatically after a drop) would
    // duplicate everything already shown.
    source.onopen = () => {
      bufferRef.current = ''
      setLog('')
      setStatus('Rodando...')
    }

    source.onmessage = (event) => {
      bufferRef.current += event.data + '\n'
      setLog(bufferRef.current)
    }

    source.addEventListener('done', (event) => {
      const exitCode = (event as MessageEvent).data
      setStatus(
        exitCode === '0' ? 'Execução concluída com sucesso.' : `Execução encerrada (código ${exitCode}).`,
      )
      source.close()
    })

    // Do NOT close the source here -- EventSource retries automatically on
    // its own after a dropped connection, and the onopen handler above makes
    // that reconnect safe (no duplicated log lines).
    source.onerror = () => {
      if (source.readyState === EventSource.CONNECTING) {
        setStatus('Conexão perdida, tentando reconectar...')
      }
    }

    return () => source.close()
  }, [runId])

  return (
    <div>
      <pre data-testid="run-log">{log}</pre>
      <p data-testid="run-status">{status}</p>
    </div>
  )
}
