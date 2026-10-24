import { describe, it, expect, vi, beforeEach } from 'vitest'

const files = vi.hoisted(() => new Map<string, string>())
vi.hoisted(() => {
  const w = globalThis as unknown as Record<string, unknown>
  const win = (w.window ??= {}) as Record<string, unknown>
  win.path = { join: (...p: string[]) => p.join('/'), sep: '/' }
  win.fileUtils = {
    pathExists: async(p: string) => files.has(p),
    outputFile: async(p: string, d: string) => void files.set(p, d)
  }
})

import { createNote, createTask, dueFrom, ExistsError } from '@cazalla/renderer/tasks/create'
import type { Project } from '@cazalla/renderer/metadata/types'

const project: Project = { name: 'Site', slug: 'site', organization: 'acme', leader: null, path: 'projects/site', file: '' }
const now = new Date(Date.UTC(2026, 9, 22, 15, 6, 42, 215))

describe('note and task creation', () => {
  beforeEach(() => files.clear())

  it('writes a note with the sample frontmatter', async() => {
    const file = await createNote('/vault', project, 'Some Note', now)
    expect(file).toBe('/vault/projects/site/notes/some-note.md')
    expect(files.get(file)).toBe(
      '---\ntitle: Some Note\nslug: some-note\ntags:\ndate: 2026-10-22T15:06:42.215Z\nmodified: 2026-10-22T15:06:42.215Z\ncategory: note\nproject: site\n---\n'
    )
  })

  it('writes a task with status new and a due date one month ahead', async() => {
    const file = await createTask('/vault', project, { title: 'Some Task' }, now)
    expect(file).toBe('/vault/projects/site/tasks/some-task.md')
    expect(files.get(file)).toBe(
      '---\ntitle: Some Task\nslug: some-task\ntags: []\ndate: 2026-10-22T15:06:42.215Z\nmodified: 2026-10-22T15:06:42.215Z\ncategory: task\nproject: site\npath: /\nstatus: new\nkanban: true\ndue: 2026-11-22T15:06:42.215Z\neffort: []\nsubtasks: []\n---\n'
    )
  })

  it('keeps the time of day when an explicit due date is given', () => {
    expect(dueFrom('2026-12-01', new Date(2026, 9, 22, 9, 30, 0))).toBe(new Date(2026, 11, 1, 9, 30, 0).toISOString())
  })

  it('refuses to overwrite', async() => {
    await createNote('/vault', project, 'Twice', now)
    await expect(createNote('/vault', project, 'Twice', now)).rejects.toBeInstanceOf(ExistsError)
  })
})
