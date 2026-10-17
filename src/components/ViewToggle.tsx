import { Chip } from './ui.tsx'
import type { ViewMode } from '../types/database.ts'

export function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div className="flex gap-1" role="group" aria-label="Vista">
      <Chip active={mode === 'friendly'} onClick={() => onChange('friendly')}>
        Amigable
      </Chip>
      <Chip active={mode === 'accounting'} onClick={() => onChange('accounting')}>
        Contable
      </Chip>
    </div>
  )
}
