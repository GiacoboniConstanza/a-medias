import { useMonth } from '../context/MonthProvider.tsx'

export function MonthSwitcher() {
  const { label, previous, next } = useMonth()
  return (
    <div className="mb-3 flex items-center justify-between">
      <button type="button" onClick={previous} className="rounded-full px-3 py-1 text-xl font-black text-brand" aria-label="Mes anterior">
        ‹
      </button>
      <span className="font-extrabold">{label}</span>
      <button type="button" onClick={next} className="rounded-full px-3 py-1 text-xl font-black text-brand" aria-label="Mes siguiente">
        ›
      </button>
    </div>
  )
}
