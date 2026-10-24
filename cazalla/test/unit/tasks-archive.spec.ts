import { describe, it, expect, vi, beforeEach } from 'vitest'

const files = vi.hoisted(() => new Map<string, string>())
const trashed = vi.hoisted(() => [] as string[])
vi.hoisted(() => {
  const w = globalThis as unknown as Record<string, unknown>
  const win = (w.window ??= {}) as Record<string, unknown>
  win.path = {
    sep: '/',
    join: (...p: string[]) => p.join('/'),
    dirname: (p: string) => p.split('/').slice(0, -1).join('/') || '/'
  }
  win.fileUtils = {
    pathExists: async(p: string) => files.has(p),
    ensureDir: async() => {},
    readFile: async(p: string) => files.get(p) ?? '',
    outputFile: async(p: string, d: string) => void files.set(p, d),
    move: async(from: string, to: string) => {
      files.set(to, files.get(from) ?? '')
      files.delete(from)
    },
    readdir: async(dir: string) => {
      const names = [...files.keys()].filter((p) => p.startsWith(dir + '/')).map((p) => p.slice(dir.length + 1).split('/')[0])
      if (!names.length) throw new Error('ENOENT')
      return [...new Set(names)]
    }
  }
  win.electron = { ipcRenderer: { invoke: async(_c: string, p: string) => void trashed.push(p) } }
})

import { archiveTask, archivedFile, HasSubtasksError } from '@cazalla/renderer/tasks/archive'
import type { Project } from '@cazalla/renderer/metadata/types'
import type { TaskRecord } from '@cazalla/renderer/tasks/types'

const project: Project = { name: 'Site', slug: 'site', organization: null, leader: null, service: null, path: 'projects/site', file: '' }
const T = '/vault/projects/site/tasks'
const record = (file: string, slug: string, path: string, subtasks: string[] = []): TaskRecord => ({
  file, title: slug, slug, project: 'site', path, status: 'done', kanban: true, due: null, effort: [], subtasks, tags: [], date: null, modified: null, archived: false
})

describe('archiveTask', () => {
  beforeEach(() => {
    files.clear()
    trashed.length = 0
    files.set(`${T}/parent.md`, '---\ntitle: parent\nslug: parent\nstatus: wip\nsubtasks:\n  - /parent/child\n  - /parent/other\n---\n')
    files.set(`${T}/parent/child.md`, '---\ntitle: child\nslug: child\npath: /parent\nstatus: done\nsubtasks: []\n---\nbody\n')
    files.set(`${T}/parent/other.md`, '---\ntitle: other\nslug: other\npath: /parent\nstatus: new\nsubtasks: []\n---\n')
    files.set(`${T}/solo.md`, '---\ntitle: solo\nslug: solo\npath: /\nstatus: done\nsubtasks: []\n---\n')
  })

  it('computes the archived location from the subpath', () => {
    expect(archivedFile('/vault', project, record(`${T}/parent/child.md`, 'child', '/parent'))).toBe('/vault/projects/site/archived/parent/child.md')
    expect(archivedFile('/vault', project, record(`${T}/solo.md`, 'solo', '/'))).toBe('/vault/projects/site/archived/solo.md')
  })

  it('moves a top-level task and marks it archived', async() => {
    const target = await archiveTask('/vault', project, record(`${T}/solo.md`, 'solo', '/'))
    expect(files.has(`${T}/solo.md`)).toBe(false)
    expect(files.get(target)).toMatch(/status: archived\nsubtasks: \[\]\nmodified: /)
    expect(trashed).toEqual([])
  })

  it('removes a subtask from its parent and trashes the folder when it empties', async() => {
    await archiveTask('/vault', project, record(`${T}/parent/child.md`, 'child', '/parent'))
    expect(files.get(`${T}/parent.md`)).toContain('subtasks:\n  - /parent/other\n')
    expect(files.get(`${T}/parent.md`)).toMatch(/modified: /)
    expect(trashed).toEqual([])

    await archiveTask('/vault', project, record(`${T}/parent/other.md`, 'other', '/parent'))
    expect(files.get(`${T}/parent.md`)).toContain('subtasks: []\n')
    expect(trashed).toEqual([`${T}/parent`])
    expect(files.get('/vault/projects/site/archived/parent/other.md')).toContain('status: archived')
  })

  it('refuses a task that still has subtasks', async() => {
    await expect(archiveTask('/vault', project, record(`${T}/parent.md`, 'parent', '/', ['/parent/child']))).rejects.toBeInstanceOf(HasSubtasksError)
    expect(files.has(`${T}/parent.md`)).toBe(true)
  })
})
