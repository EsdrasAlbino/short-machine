import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RunLog from './RunLog'

class FakeEventSource {
  static CONNECTING = 0
  static OPEN = 1
  static CLOSED = 2
  static instances: FakeEventSource[] = []

  readyState = FakeEventSource.CONNECTING
  onopen: (() => void) | null = null
  onmessage: ((event: MessageEvent) => void) | null = null
  onerror: (() => void) | null = null
  private listeners: Record<string, ((event: MessageEvent) => void)[]> = {}

  constructor(public url: string) {
    FakeEventSource.instances.push(this)
  }

  addEventListener(type: string, handler: (event: MessageEvent) => void) {
    this.listeners[type] = [...(this.listeners[type] ?? []), handler]
  }

  close() {
    this.readyState = FakeEventSource.CLOSED
  }

  // test helpers
  open() {
    this.readyState = FakeEventSource.OPEN
    this.onopen?.()
  }

  emitMessage(data: string) {
    this.onmessage?.({ data } as MessageEvent)
  }

  emitDone(exitCode: string) {
    this.listeners['done']?.forEach((handler) => handler({ data: exitCode } as MessageEvent))
  }

  emitDrop() {
    this.readyState = FakeEventSource.CONNECTING
    this.onerror?.()
  }
}

beforeEach(() => {
  FakeEventSource.instances = []
  // @ts-expect-error -- test double for the browser EventSource API
  global.EventSource = FakeEventSource
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('RunLog', () => {
  it('renders incoming log lines live', () => {
    render(<RunLog runId="abc123" />)
    const source = FakeEventSource.instances[0]

    act(() => {
      source.open()
      source.emitMessage('linha 1')
      source.emitMessage('linha 2')
    })

    expect(screen.getByTestId('run-log')).toHaveTextContent('linha 1 linha 2')
  })

  it('reconnecting resets the buffer instead of duplicating', () => {
    render(<RunLog runId="abc123" />)
    const source = FakeEventSource.instances[0]

    act(() => {
      source.open()
      source.emitMessage('linha 1')
      source.emitDrop() // connection drop, EventSource retries on its own
      source.open() // simulated successful reconnect
      source.emitMessage('linha 1') // server replays the log from the start
    })

    expect(screen.getByTestId('run-log')).toHaveTextContent('linha 1')
    expect(screen.getByTestId('run-log').textContent?.match(/linha 1/g)).toHaveLength(1)
  })

  it('done event updates status and closes the connection', () => {
    render(<RunLog runId="abc123" />)
    const source = FakeEventSource.instances[0]

    act(() => {
      source.open()
      source.emitDone('0')
    })

    expect(screen.getByTestId('run-status')).toHaveTextContent('concluída com sucesso')
    expect(source.readyState).toBe(FakeEventSource.CLOSED)
  })
})
