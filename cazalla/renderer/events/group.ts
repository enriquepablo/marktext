import type { TaskRecord, TaskStatus } from '../tasks/types'

export type EventSection = 'today' | 'tomorrow' | 'week' | 'later'
export const EVENT_SECTIONS: EventSection[] = ['today', 'tomorrow', 'week', 'later']

// Only open work is an event; done and archived tasks have no date to meet.
const OPEN: readonly TaskStatus[] = ['continuous', 'new', 'pending', 'wip']

export interface EventItem {
  task: TaskRecord
  due: Date
  overdue: boolean
}

const startOfDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

/** First day after the current week; `weekStart` is 0 = Sunday … 6 = Saturday. */
export const endOfWeek = (now: Date, weekStart: number): Date => {
  const today = startOfDay(now)
  const offset = (today.getDay() - weekStart + 7) % 7
  return addDays(today, 7 - offset)
}

/**
 * Groups open tasks with a due date. Tasks due before today are left out;
 * today's tasks whose time has passed are marked overdue.
 * `week` runs from the day after tomorrow to the end of the current week; when
 * tomorrow already closes the week, it is empty.
 */
export const groupEvents = (tasks: TaskRecord[], now: Date, weekStart: number): Record<EventSection, EventItem[]> => {
  const today = startOfDay(now)
  const tomorrow = addDays(today, 1)
  const afterTomorrow = addDays(today, 2)
  const weekEnd = endOfWeek(now, weekStart)
  const out: Record<EventSection, EventItem[]> = { today: [], tomorrow: [], week: [], later: [] }
  for (const task of tasks) {
    if (task.archived || !OPEN.includes(task.status) || !task.due) continue
    const due = new Date(task.due)
    if (Number.isNaN(due.getTime()) || due < today) continue
    const item: EventItem = { task, due, overdue: due.getTime() < now.getTime() }
    if (due < tomorrow) out.today.push(item)
    else if (due < afterTomorrow) out.tomorrow.push(item)
    else if (due < weekEnd) out.week.push(item)
    else out.later.push(item)
  }
  for (const section of EVENT_SECTIONS) out[section].sort((a, b) => a.due.getTime() - b.due.getTime())
  return out
}
