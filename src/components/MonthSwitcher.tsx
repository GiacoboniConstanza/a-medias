import { AppIcon } from './AppIcon.tsx'
import { useMonth } from '../context/MonthProvider.tsx'

const ARROW =
  'grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 border-edge bg-white text-lg text-ink'

export function MonthSwitcher({ heading = false }: { heading?: boolean }) {
  const { title, isCurrent, previous, next, goToday } = useMonth()
  const Title = heading ? 'h1' : 'p'
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={previous} className={ARROW} aria-label="Mes anterior">
          <AppIcon name="chevron-left" />
        </button>
        <Title className="text-center text-[1.75rem] font-black leading-tight">{title}</Title>
        <button type="button" onClick={next} className={ARROW} aria-label="Mes siguiente">
          <AppIcon name="chevron-right" />
        </button>
      </div>
      {isCurrent ? null : (
        <div className="mt-2 flex justify-center">
          <button type="button" onClick={goToday} className="min-h-11 rounded-full border-2 border-edge bg-white px-4 text-sm font-semibold text-ink">
            Hoy
          </button>
        </div>
      )}
    </div>
  )
}
