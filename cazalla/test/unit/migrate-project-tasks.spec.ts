import { describe, it, expect } from 'vitest'
import { checklistLinks, normalisePath, taskFields, withoutLines } from '@cazalla/scripts/migrate-project/tasks'

const NOW = '2026-10-25T10:00:00.000Z'
const base = { title: 'T', slug: 't', project: 'p', path: '/', archived: false, subtasks: [], now: NOW }

describe('taskFields', () => {
  it('parent task with neither due nor status stays off the board', () => {
    const f = taskFields({ ...base, origin: { title: 'T', tags: null, effort: null, path: '/' } })
    expect(f).toMatchObject({ status: 'new', kanban: false, due: NOW, tags: [], effort: [], subtasks: [] })
    expect(Object.keys(f)).toEqual(['title', 'slug', 'tags', 'date', 'modified', 'category', 'project', 'path', 'status', 'kanban', 'due', 'effort', 'subtasks'])
  })

  it('board column beats the file status, which beats new; unknown values fall back', () => {
    expect(taskFields({ ...base, origin: { status: 'new' }, boardStatus: 'wip' }).status).toBe('wip')
    expect(taskFields({ ...base, origin: { status: 'pending' } })).toMatchObject({ status: 'pending', kanban: true })
    expect(taskFields({ ...base, origin: { status: 'todo' } }).status).toBe('new')
    expect(taskFields({ ...base, origin: {}, boardStatus: 'continuous' }).kanban).toBe(true)
  })

  it('archived tasks are archived and off the board, archived-path dropped, other keys kept', () => {
    const origin = { status: 'new', due: '2026-05-16T14:33:19.190Z', 'archived-path': '/x/', effort: [{ '2026-04-16': 2 }], extra: 1 }
    const f = taskFields({ ...base, origin, path: '/x/', archived: true, boardStatus: 'wip' })
    expect(f).toMatchObject({ status: 'archived', kanban: false, path: '/x', due: origin.due, effort: origin.effort, extra: 1 })
    expect(f).not.toHaveProperty('archived-path')
  })

  it('normalisePath strips and deduplicates slashes', () => {
    expect(normalisePath('/a/b/')).toBe('/a/b')
    expect(normalisePath('')).toBe('/')
    expect(normalisePath('a//b')).toBe('/a/b')
  })
})

describe('checklistLinks', () => {
  const body = 'intro\n- [ ] [[Allow SPs]]\n- [x] [[Projects/X/Tasks/Docs |Docs]]\n- [ ] [[Other#h]]\n- [ ] plain text [[Not alone]]\n'
  it('finds lines made of one wiki link and keeps the target base name', () => {
    expect(checklistLinks(body)).toEqual([
      { line: 1, target: 'Allow SPs' },
      { line: 2, target: 'Docs' },
      { line: 3, target: 'Other' }
    ])
  })
  it('withoutLines removes the given lines only', () => {
    expect(withoutLines(body, new Set([1, 3]))).toBe('intro\n- [x] [[Projects/X/Tasks/Docs |Docs]]\n- [ ] plain text [[Not alone]]\n')
  })
})
