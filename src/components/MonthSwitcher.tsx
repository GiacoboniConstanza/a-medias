import { AppIcon } from './AppIcon.tsx'
import { useMonth } from '../context/MonthProvider.tsx'

const ARROW = 'grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card text-lg shadow-soft'

export function MonthSwitcher({
  heading = false,
  className = 'mb-3',
  tone = 'default',
}: {
  heading?: boolean
  className?: string
  tone?: 'default' | 'home'
}) {
  const { title, isCurrent, previous, next, goToday } = useMonth()
  const Title = heading ? 'h1' : 'p'
  const home = tone === 'home'
  return (
    <div className={className}>
      <div className="flex items-center justify-between gap-3">
        <button type="button" onClick={previous} className={`${ARROW} ${home ? 'text-alert' : 'text-primary'}`} aria-label="Mes anterior">
          <AppIcon name="chevron-left" />
        </button>
        <Title className={`text-center font-display text-[1.75rem] leading-tight ${home ? 'font-semibold text-primary' : 'font-bold'}`}>{title}</Title>
        <button type="button" onClick={next} className={`${ARROW} ${home ? 'text-alert' : 'text-primary'}`} aria-label="Mes siguiente">
          <AppIcon name="chevron-right" />
        </button>
      </div>
      {isCurrent ? null : (
        <div className="mt-2 flex justify-center">
          <button
            type="button"
            onClick={goToday}
            className={`min-h-11 rounded-full bg-card px-4 text-sm font-semibold shadow-soft ${home ? 'text-primary' : 'text-text'}`}
          >
            Hoy
          </button>
        </div>
      )}
    </div>
  )
}
