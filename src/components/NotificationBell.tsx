import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../context/AuthProvider.tsx'
import { useFinance } from '../context/FinanceProvider.tsx'
import { useMonth } from '../context/MonthProvider.tsx'
import { loadDailyStatuses, loadFinance, loadReminderPreferences, type FinanceData } from '../lib/api.ts'
import { monthKey, todayISO } from '../lib/month.ts'
import { pendingCount, type ReminderPrefs } from '../lib/reminders.ts'
import { AppIcon } from './AppIcon.tsx'

function usePendingCount(): number | null {
  const { profile } = useAuth()
  const { data } = useFinance()
  const { month } = useMonth()
  const current = monthKey()
  const [now, setNow] = useState(() => new Date())
  const [prefs, setPrefs] = useState<ReminderPrefs | null>(null)
  const [statuses, setStatuses] = useState<{ day: string; kind: 'logged' | 'clear' }[]>([])
  const [otherMonth, setOtherMonth] = useState<FinanceData | null>(null)

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!profile) return
    let active = true
    Promise.all([loadReminderPreferences(profile.id), loadDailyStatuses(profile.id, todayISO())])
      .then(([nextPrefs, rows]) => {
        if (!active) return
        setPrefs(nextPrefs)
        setStatuses(rows)
      })
      .catch(() => {
        if (active) setPrefs(null)
      })
    return () => {
      active = false
    }
  }, [profile])

  useEffect(() => {
    if (!profile?.householdId || month === current) {
      setOtherMonth(null)
      return
    }
    let active = true
    loadFinance(profile.householdId, profile.id, current)
      .then((next) => {
        if (active) setOtherMonth(next)
      })
      .catch(() => {
        if (active) setOtherMonth(null)
      })
    return () => {
      active = false
    }
  }, [profile, month, current])

  const source = month === current ? data : otherMonth
  if (!profile || !prefs || !source) return null
  const today = todayISO(now)
  const logged =
    source.lastLoggedOn === today ||
    source.monthExpenses.some((expense) => expense.ownerId === profile.id && expense.spentOn === today) ||
    statuses.some((row) => row.day === today && row.kind === 'logged')
  const clear = !logged && (statuses.some((row) => row.day === today && row.kind === 'clear') || prefs.reviewedOn === today)
  return pendingCount(now, prefs, { logged, clear }, source.fixed)
}

export function NotificationBell() {
  const count = usePendingCount()
  const label = count == null ? 'Avisos' : count === 0 ? 'Avisos, sin pendientes' : `Avisos, ${count} pendientes`
  const badge = count != null && count > 0 ? (count > 9 ? '9+' : String(count)) : null
  return (
    <Link to="/recordatorios" aria-label={label} className="relative grid h-11 w-11 place-items-center text-tinta">
      <AppIcon name="bell" className="text-lg" />
      {badge ? (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 top-0 inline-flex h-6 min-w-6 items-center justify-center rounded-full border-2 border-crema bg-mostaza px-1 text-sm font-bold text-tinta"
        >
          {badge}
        </span>
      ) : null}
    </Link>
  )
}
