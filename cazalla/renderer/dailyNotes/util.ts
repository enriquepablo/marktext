// Pure helpers for the daily notes panel. Paths are returned as segments so
// callers join them with `window.path` and this module stays free of globals.

import { touchModified as touchModifiedLine } from '../core/frontmatter'

export const DAILY_NOTES_DIR = '_daily'

const pad = (n: number): string => String(n).padStart(2, '0')

/** `YYYY-MM-DD` in local time. Used as file stem, title and slug. */
export const formatDateKey = (date: Date): string =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** `YYYY-MM-DDTHH:mm:ss+HH:MM` in local time. */
export const formatTimestamp = (date: Date): string => {
  const offset = -date.getTimezoneOffset()
  const sign = offset >= 0 ? '+' : '-'
  const abs = Math.abs(offset)
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  return `${formatDateKey(date)}T${time}${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`
}

/** Segments of the month folder below the content folder: `_daily/YYYY/MM`. */
export const monthDirSegments = (year: number, month: number): string[] => [
  DAILY_NOTES_DIR,
  String(year),
  pad(month + 1)
]

/** Segments of the note file below the content folder. */
export const dailyNoteSegments = (date: Date): string[] => [
  ...monthDirSegments(date.getFullYear(), date.getMonth()),
  `${formatDateKey(date)}.md`
]

export const newNoteContent = (date: Date, now: Date): string => {
  const key = formatDateKey(date)
  const stamp = formatTimestamp(now)
  return `---\ntitle: "${key}"\nslug: ${key}\ncreated: ${stamp}\nmodified: ${stamp}\ncategory: daily\ntags: []\n---\n`
}

/** Rewrites the `modified:` line of a leading YAML block, in local time. Other input is returned as is. */
export const touchModified = (markdown: string, now: Date): string => touchModifiedLine(markdown, formatTimestamp(now))

/** 0 = Sunday … 6 = Saturday, from the locale's week info when the engine exposes it. */
export const weekStartFor = (locale: string): number => {
  try {
    const info = (new Intl.Locale(locale) as { getWeekInfo?: () => { firstDay: number } }).getWeekInfo?.()
    // Intl uses 1 = Monday … 7 = Sunday.
    if (info) return info.firstDay % 7
  } catch {
    /* unknown locale tag */
  }
  return 1
}

/** 42 cells (6 weeks) covering the month; cells outside the month are null. */
export const monthGrid = (year: number, month: number, weekStart: number): (Date | null)[] => {
  const first = new Date(year, month, 1)
  const lead = (first.getDay() - weekStart + 7) % 7
  const days = new Date(year, month + 1, 0).getDate()
  return Array.from({ length: 42 }, (_, i) => {
    const day = i - lead + 1
    return day >= 1 && day <= days ? new Date(year, month, day) : null
  })
}
