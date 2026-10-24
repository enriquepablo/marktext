/** UTC ISO string, the format of `date` and `modified` in notes, tasks and metadata. */
export const isoNow = (now: Date = new Date()): string => now.toISOString()

/** Same wall-clock time `n` months later; overflow clamps to the last day of the month. */
export const addMonths = (date: Date, n: number): Date => {
  const d = new Date(date.getTime())
  const day = d.getDate()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
  d.setDate(Math.min(day, last))
  return d
}

/** `YYYY-MM-DD` in local time, the key format of `effort` entries. */
export const dateKey = (date: Date): string => {
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
