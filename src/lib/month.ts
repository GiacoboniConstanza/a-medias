/** Día civil en Catamarca, aunque el reloj del dispositivo esté en UTC. */
export function catamarcaToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Catamarca',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function isAfterDay(iso: string, today: string): boolean {
  return iso > today
}

export function todayISO(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function monthKey(date = new Date()): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}-01`
}

export function shiftMonth(monthStart: string, delta: number): string {
  const [yearText, monthText] = monthStart.split('-')
  const date = new Date(Number(yearText), Number(monthText) - 1 + delta, 1)
  return monthKey(date)
}

export function monthEnd(monthStart: string): string {
  const [yearText, monthText] = monthStart.split('-')
  const date = new Date(Number(yearText), Number(monthText), 0)
  return todayISO(date)
}

export function monthLabel(monthStart: string): string {
  const [yearText, monthText] = monthStart.split('-')
  const date = new Date(Number(yearText), Number(monthText) - 1, 1)
  const label = new Intl.DateTimeFormat('es-AR', { month: 'long', year: 'numeric' }).format(date)
  return label.charAt(0).toUpperCase() + label.slice(1)
}

export function monthTitle(monthStart: string): string {
  const [yearText, monthText] = monthStart.split('-')
  const date = new Date(Number(yearText), Number(monthText) - 1, 1)
  const name = new Intl.DateTimeFormat('es-AR', { month: 'long' }).format(date)
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} ${yearText}`
}

export function monthName(monthStart: string): string {
  return monthLabel(monthStart).split(' de ')[0]?.toLowerCase() ?? ''
}

export function shortDate(iso: string): string {
  const [, month, day] = iso.split('-')
  return `${day}/${month}`
}

export function daysInMonth(monthStart: string): number {
  const [yearText, monthText] = monthStart.split('-')
  return new Date(Number(yearText), Number(monthText), 0).getDate()
}

export function isCurrentMonth(monthStart: string, today = new Date()): boolean {
  return monthStart === monthKey(today)
}
