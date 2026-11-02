import { AppIcon } from './AppIcon.tsx'
import { useMonth } from '../context/MonthProvider.tsx'

export function MonthSwitcher({
  heading = false,
  className = 'mb-3',
  tone: _tone = 'default',
}: {
  heading?: boolean
  className?: string
  tone?: 'default' | 'home'
}) {
  const { title, isCurrent, previous, next, goToday } = useMonth()
  const Title = heading ? 'h1' : 'p'
  return (
    <div className={className}>
      <div className="flex items-center justify-center">
        <button type="button" onClick={previous} aria-label="Mes anterior" className="grid h-11 w-11 shrink-0 place-items-center text-alert-ink">
          <AppIcon name="chevron-left" className="text-base" />
        </button>
        <Title className="px-0.5 text-center font-display text-[22px] font-semibold text-title">{title}</Title>
        <button type="button" onClick={next} aria-label="Mes siguiente" className="grid h-11 w-11 shrink-0 place-items-center text-alert-ink">
          <AppIcon name="chevron-right" className="text-base" />
        </button>
      </div>
      {isCurrent ? null : (
        <div className="mt-2 flex justify-center">
          <button type="button" onClick={goToday} className="min-h-11 rounded-full bg-card px-4 text-sm font-semibold text-title shadow-soft">
            Hoy
          </button>
        </div>
      )}
    </div>
  )
}
