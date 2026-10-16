import type { ViewMode } from '../types/database.ts'

export function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (mode: ViewMode) => void }) {
  return (
    <div className="flex rounded-full bg-chip p-0.5 text-xs font-extrabold">
      {(['friendly', 'accounting'] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-full px-2.5 py-1 ${mode === option ? 'bg-white text-brand shadow-sm' : 'text-muted'}`}
        >
          {option === 'friendly' ? 'Amigable' : 'Contable'}
        </button>
      ))}
    </div>
  )
}
