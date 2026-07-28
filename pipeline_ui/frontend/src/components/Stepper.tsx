export type WizardStep = 'download' | 'edit' | 'execute'

const STEPS: { id: WizardStep; label: string }[] = [
  { id: 'download', label: '1. Download' },
  { id: 'edit', label: '2. Edição' },
  { id: 'execute', label: '3. Execução' },
]

export interface StepperProps {
  current: WizardStep
}

export default function Stepper({ current }: StepperProps) {
  const currentIndex = STEPS.findIndex((s) => s.id === current)

  return (
    <ol className="stepper">
      {STEPS.map((s, i) => (
        <li key={s.id} className={i === currentIndex ? 'active' : i < currentIndex ? 'done' : ''}>
          {s.label}
        </li>
      ))}
    </ol>
  )
}
