import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// An in-memory file system behind `window.fileUtils`, plus the globals the
// layout and preferences stores touch at import time.
const files = vi.hoisted(() => new Map<string, string>())
const sent = vi.hoisted(() => [] as unknown[][])

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
  win.marktext = { env: { windowId: 7 } }
  win.path = {
    sep: '/',
    join: (...p: string[]) => p.join('/'),
    dirname: (p: string) => p.split('/').slice(0, -1).join('/') || '/',
    basename: (p: string) => p.split('/').pop() ?? p,
    normalize: (p: string) => p,
    isAbsolute: (p: string) => p.startsWith('/'),
    relative: (from: string, to: string) => to.slice(from.length + 1)
  }
  win.fileUtils = {
    hasMarkdownExtension: (n: string) => n.endsWith('.md'),
    pathExists: async(p: string) => files.has(p),
    ensureDir: async() => {},
    outputFile: async(p: string, d: string) => void files.set(p, d),
    writeFile: async(p: string, d: string) => void files.set(p, d),
    readFile: async(p: string) => files.get(p) ?? '',
    readdir: async(dir: string) => {
      const names = [...files.keys()]
        .filter((p) => p.startsWith(dir + '/'))
        .map((p) => p.slice(dir.length + 1))
        .filter((rest) => !rest.includes('/'))
      if (!names.length) throw new Error('ENOENT')
      return names
    }
  }
  win.electron = { ipcRenderer: { send: (...a: unknown[]) => void sent.push(a), on: () => {} } }
})

vi.mock('@/services/notification', () => ({
  default: { notify: vi.fn(), name: 'notify' }
}))

import { useDailyNotesStore } from '@cazalla/renderer/dailyNotes/store'
import { usePreferencesStore } from '@/store/preferences'

const day = new Date(2026, 9, 23, 9, 0, 0)
const notePath = '/vault/_daily/2026/10/2026-10-23.md'

describe('daily notes store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    files.clear()
    sent.length = 0
    localStorage.clear()
    usePreferencesStore().defaultDirectoryToOpen = '/vault'
  })
  afterEach(() => vi.useRealTimers())

  it('creates a missing note with frontmatter and marks the day', async() => {
    const store = useDailyNotesStore()
    await store.OPEN_DATE(day)
    expect(store.notePath).toBe(notePath)
    expect(files.get(notePath)).toMatch(/^---\ntitle: "2026-10-23"\nslug: 2026-10-23\ncreated: .*\nmodified: .*\ncategory: daily\ntags: \[\]\n---\n$/)
    expect(store.markdown).toBe(files.get(notePath))
    expect(store.existingDays.has('2026-10-23')).toBe(true)
    expect(store.visibleMonth).toEqual({ year: 2026, month: 9 })
  })

  it('reads an existing note without overwriting it', async() => {
    files.set(notePath, '# kept\n')
    const store = useDailyNotesStore()
    await store.OPEN_DATE(day)
    expect(store.markdown).toBe('# kept\n')
    expect(files.get(notePath)).toBe('# kept\n')
  })

  it('debounces saves and refreshes the modified timestamp', async() => {
    vi.useFakeTimers()
    const store = useDailyNotesStore()
    await store.OPEN_DATE(day)
    const created = files.get(notePath)!
    vi.setSystemTime(new Date(2026, 9, 23, 10, 30, 0))
    store.SAVE_NOTE(created + '\nHello\n')
    store.SAVE_NOTE(created + '\nHello world\n')
    expect(files.get(notePath)).toBe(created)
    await vi.advanceTimersByTimeAsync(1000)
    const saved = files.get(notePath)!
    expect(saved.endsWith('---\n\nHello world\n')).toBe(true)
    expect(saved).toMatch(/modified: 2026-10-23T10:30:0[01]/)
    expect(saved).toContain(created.match(/created: .*/)![0])
  })

  it('does nothing without a content folder', async() => {
    usePreferencesStore().defaultDirectoryToOpen = ''
    const store = useDailyNotesStore()
    expect(store.contentFolder).toBeNull()
    await store.OPEN_DATE(day)
    expect(store.notePath).toBeNull()
    expect(files.size).toBe(0)
  })

  it('toggles visibility, persists it and reports it to the menu', () => {
    const store = useDailyNotesStore()
    expect(store.visible).toBe(false)
    store.TOGGLE()
    expect(store.visible).toBe(true)
    expect(localStorage.getItem('daily-notes-visible')).toBe('true')
    expect(sent.at(-1)).toEqual(['mt::view-layout-changed', 7, { showDailyNotes: true }])
    store.SET_WIDTH(100)
    expect(store.width).toBe(280)
    expect(store.effectiveWidth).toBe(280)
  })
})
