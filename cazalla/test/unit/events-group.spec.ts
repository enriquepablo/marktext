import { describe, it, expect } from 'vitest'
import { endOfWeek, groupEvents } from '@cazalla/renderer/events/group'
import type { TaskRecord, TaskStatus } from '@cazalla/renderer/tasks/types'

const task = (slug: string, due: string | null, status: TaskStatus = 'new', archived = false): TaskRecord => ({
  file: `/v/${slug}.md`, title: slug, slug, project: 'site', path: '/', status, kanban: true, due, effort: [], subtasks: [], tags: [], date: null, modified: null, archived
})
// Saturday 2026-10-24, 10:00 local.
const now = new Date(2026, 9, 24, 10, 0)

describe('events grouping', () => {
  it('computes the end of the week for Monday and Sunday starts', () => {
    expect(endOfWeek(now, 1)).toEqual(new Date(2026, 9, 26))
    expect(endOfWeek(now, 0)).toEqual(new Date(2026, 9, 25))
  })

  it('places open tasks by due date and marks overdue ones', () => {
    const groups = groupEvents(
      [
        task('late', new Date(2026, 9, 20, 9).toISOString()),
        task('today-pm', new Date(2026, 9, 24, 18).toISOString(), 'wip'),
        task('today-am', new Date(2026, 9, 24, 8).toISOString()),
        task('tomorrow', new Date(2026, 9, 25, 12).toISOString(), 'pending'),
        task('monday', new Date(2026, 9, 26, 9).toISOString()),
        task('next-month', new Date(2026, 10, 3).toISOString(), 'continuous'),
        task('done', new Date(2026, 9, 24, 12).toISOString(), 'done'),
        task('archived', new Date(2026, 9, 24, 12).toISOString(), 'new', true),
        task('no-due', null)
      ],
      now,
      1
    )
    expect(groups.today.map((i) => [i.task.slug, i.overdue])).toEqual([['late', true], ['today-am', false], ['today-pm', false]])
    expect(groups.tomorrow.map((i) => i.task.slug)).toEqual(['tomorrow'])
    // Monday starts the next week, so this week (Sunday only) is covered by tomorrow.
    expect(groups.week).toEqual([])
    expect(groups.later.map((i) => i.task.slug)).toEqual(['monday', 'next-month'])
  })

  it('fills the week section mid-week', () => {
    const wednesday = new Date(2026, 9, 21, 9)
    const groups = groupEvents([task('fri', new Date(2026, 9, 23, 9).toISOString()), task('sun', new Date(2026, 9, 25, 9).toISOString())], wednesday, 1)
    expect(groups.week.map((i) => i.task.slug)).toEqual(['fri', 'sun'])
  })
})
