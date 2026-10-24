import { describe, it, expect, vi, beforeEach } from 'vitest'

const files = vi.hoisted(() => new Map<string, string>())
const dirs = vi.hoisted(() => new Set<string>())
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
    ensureDir: async(p: string) => void dirs.add(p),
    readFile: async(p: string) => files.get(p) ?? '',
    outputFile: async(p: string, d: string) => void files.set(p, d)
  }
})

import { createSubtask, parentFromMarkdown } from '@cazalla/renderer/tasks/subtasks'
import { ExistsError } from '@cazalla/renderer/tasks/create'

const T = '/vault/projects/site/tasks'
const now = new Date(Date.UTC(2026, 9, 22, 15, 6, 42, 215))
const parentMd = '---\ntitle: Parent\nslug: parent\ncategory: task\nproject: site\npath: /\nstatus: wip\nsubtasks: []\n---\n\nBody\n'

describe('subtasks', () => {
  beforeEach(() => {
    files.clear()
    dirs.clear()
    files.set(`${T}/parent.md`, parentMd)
  })

  it('reads the parent from frontmatter and rejects non-tasks', () => {
    expect(parentFromMarkdown(`${T}/parent.md`, parentMd)).toEqual({ file: `${T}/parent.md`, slug: 'parent', path: '/', project: 'site' })
    expect(parentFromMarkdown(`${T}/n.md`, '---\ncategory: note\n---\n')).toBeNull()
    expect(parentFromMarkdown(`${T}/x.md`, '---\ncategory: task\n---\n')?.slug).toBe('x')
  })

  it('creates the subtask in a folder named after the parent and links it', async() => {
    const parent = parentFromMarkdown(`${T}/parent.md`, parentMd)!
    const file = await createSubtask(parent, 'First Step', now)
    expect(file).toBe(`${T}/parent/first-step.md`)
    expect(dirs.has(`${T}/parent`)).toBe(true)
    expect(files.get(file)).toBe(
      '---\ntitle: First Step\nslug: first-step\ntags: []\ndate: 2026-10-22T15:06:42.215Z\nmodified: 2026-10-22T15:06:42.215Z\ncategory: task\nproject: site\npath: /parent\nstatus: new\ndue: 2026-11-22T15:06:42.215Z\neffort: []\nsubtasks: []\n---\n'
    )
    const updated = files.get(`${T}/parent.md`)!
    expect(updated).toContain('subtasks:\n  - /parent/first-step\n')
    expect(updated).toContain('modified: 2026-10-22T15:06:42.215Z')
    expect(updated.endsWith('---\n\nBody\n')).toBe(true)
  })

  it('nests a second level and refuses duplicates', async() => {
    const parent = parentFromMarkdown(`${T}/parent.md`, parentMd)!
    const child = await createSubtask(parent, 'Child', now)
    const grandchild = await createSubtask(parentFromMarkdown(child, files.get(child)!)!, 'Grand', now)
    expect(grandchild).toBe(`${T}/parent/child/grand.md`)
    expect(files.get(grandchild)).toContain('path: /parent/child\n')
    expect(files.get(child)).toContain('subtasks:\n  - /parent/child/grand\n')
    await expect(createSubtask(parent, 'Child', now)).rejects.toBeInstanceOf(ExistsError)
  })
})
