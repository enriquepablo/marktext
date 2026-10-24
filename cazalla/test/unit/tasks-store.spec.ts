import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const files = vi.hoisted(() => new Map<string, string>())
vi.hoisted(() => {
  const storage = new Map<string, string>()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, String(v)),
      removeItem: (k: string) => storage.delete(k),
      clear: () => storage.clear()
    }
  })
  const w = globalThis as unknown as Record<string, unknown>
  const win = (w.window ??= {}) as Record<string, unknown>
  win.marktext = { env: { windowId: 1 } }
  win.path = {
    sep: '/',
    join: (...p: string[]) => p.join('/'),
    dirname: (p: string) => p.split('/').slice(0, -1).join('/') || '/',
    basename: (p: string, ext?: string) => {
      const b = p.split('/').pop() ?? p
      return ext && b.endsWith(ext) ? b.slice(0, -ext.length) : b
    },
    normalize: (p: string) => p,
    isAbsolute: (p: string) => p.startsWith('/'),
    relative: (from: string, to: string) => to.slice(from.length + 1)
  }
  const children = (dir: string): string[] =>
    [...new Set([...files.keys()].filter((p) => p.startsWith(dir + '/')).map((p) => p.slice(dir.length + 1).split('/')[0]))]
  win.fileUtils = {
    hasMarkdownExtension: (n: string) => n.endsWith('.md'),
    pathExists: async(p: string) => files.has(p),
    readFile: async(p: string) => files.get(p) ?? '',
    outputFile: async(p: string, d: string) => void files.set(p, d),
    readdir: async(dir: string) => {
      const names = children(dir)
      if (!names.length) throw new Error('ENOENT')
      return names
    },
    stat: async(p: string) => ({ isFile: files.has(p), isDirectory: !files.has(p) && children(p).length > 0 })
  }
  win.electron = { ipcRenderer: { send: () => {}, on: () => {} } }
})
vi.mock('@/services/notification', () => ({ default: { notify: () => {}, name: 'notify' } }))

import { useTaskStore } from '@cazalla/renderer/tasks/store'
import { useMetadataStore } from '@cazalla/renderer/metadata/store'
import { usePreferencesStore } from '@/store/preferences'

const flush = async(): Promise<void> => {
  for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0))
}

const task = (title: string, status = 'new'): string =>
  `---\ntitle: ${title}\nslug: ${title.toLowerCase()}\ncategory: task\nproject: site\npath: /\nstatus: ${status}\neffort:\n  - 2026-10-01: 2.5\nsubtasks: []\n---\nbody\n`

describe('task index', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    files.clear()
    files.set('/vault/_metadata/projects/site.md', '---\nname: Site\nslug: site\npath: projects/site\n---\n')
    files.set('/vault/projects/site/tasks/a.md', task('A', 'wip'))
    files.set('/vault/projects/site/tasks/a/sub.md', task('Sub').replace('path: /', 'path: /a'))
    files.set('/vault/projects/site/archived/old.md', task('Old'))
    files.set('/vault/projects/site/notes/n.md', '---\ntitle: n\ncategory: note\n---\n')
    usePreferencesStore().defaultDirectoryToOpen = '/vault'
  })

  it('indexes tasks under tasks/ and archived/ of every project, skipping notes', async() => {
    useMetadataStore()
    const store = useTaskStore()
    await flush()
    expect(store.list.map((t) => t.slug).sort()).toEqual(['a', 'old', 'sub'])
    const a = store.tasks['/vault/projects/site/tasks/a.md']
    expect(a.status).toBe('wip')
    expect(a.effort).toEqual([{ '2026-10-01': 2.5 }])
    expect(store.tasks['/vault/projects/site/tasks/a/sub.md'].path).toBe('/a')
    expect(store.tasks['/vault/projects/site/archived/old.md'].archived).toBe(true)
    expect(store.tasks['/vault/projects/site/archived/old.md'].status).toBe('archived')
    expect(store.active.map((t) => t.slug).sort()).toEqual(['a', 'sub'])
    expect(store.byProject('site')).toHaveLength(3)
  })

  it('updates frontmatter keys and stamps modified', async() => {
    useMetadataStore()
    const store = useTaskStore()
    await flush()
    const file = '/vault/projects/site/tasks/a.md'
    await store.UPDATE(file, { status: 'done' })
    expect(files.get(file)).toMatch(/status: done\n/)
    expect(files.get(file)).toMatch(/modified: \d{4}-\d{2}-\d{2}T/)
    expect(files.get(file)?.endsWith('---\nbody\n')).toBe(true)
    expect(store.tasks[file].status).toBe('done')
  })
})
