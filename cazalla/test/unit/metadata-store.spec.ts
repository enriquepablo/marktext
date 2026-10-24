import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

const files = vi.hoisted(() => new Map<string, string>())
const notified = vi.hoisted(() => [] as unknown[])

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
  win.fileUtils = {
    hasMarkdownExtension: (n: string) => n.endsWith('.md'),
    pathExists: async(p: string) => files.has(p),
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
  win.electron = { ipcRenderer: { send: () => {}, on: () => {} } }
})

vi.mock('@/services/notification', () => ({
  default: { notify: (n: unknown) => void notified.push(n), name: 'notify' }
}))

import { useMetadataStore } from '@cazalla/renderer/metadata/store'
import { canBeInvoiced, canInvoice } from '@cazalla/renderer/metadata/types'
import { usePreferencesStore } from '@/store/preferences'

const M = '/vault/_metadata'
const seed = (): void => {
  files.clear()
  files.set(`${M}/people/ana.md`, '---\nname: Ana López\nslug: ana-lopez\norganization: acme\nemail:\nphone: "600"\n---\n')
  files.set(`${M}/people/bob.md`, '---\nname: Bob\n---\n')
  files.set(`${M}/organizations/acme.md`, '---\nname: Acme\nslug: acme\nleader: ana-lopez\nbilling:\n  - site\ninvoice_details:\n  - Acme Inc\n  - Main St 1\n---\n')
  files.set(`${M}/organizations/us.md`, '---\nname: cazalla.net\nslug: cazalla-net\nprice_hour: 55\ninvoice_number: "0026"\niban: ES62\nswift: INGDESMMXXX\npayment_details: 30 days\n---\n')
  files.set(`${M}/projects/site.md`, '---\nname: Web site\nslug: site\norganization: acme\nleader: ana-lopez\nservice: Development\npath: projects/site/\n---\n')
  files.set(`${M}/projects/dup.md`, '---\nname: Duplicate\nslug: site\n---\n')
  files.set(`${M}/projects/broken.md`, '# not metadata\n')
}

const flush = (): Promise<void> => new Promise((r) => setTimeout(r, 0))

describe('metadata store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    notified.length = 0
    seed()
  })

  it('loads the three kinds when the content folder is set', async() => {
    usePreferencesStore().defaultDirectoryToOpen = '/vault'
    const store = useMetadataStore()
    await flush()
    await flush()
    expect(store.loaded).toBe(true)
    expect(Object.keys(store.people).sort()).toEqual(['ana-lopez', 'bob'])
    expect(store.people['ana-lopez'].email).toBeNull()
    expect(store.people['ana-lopez'].phone).toBe('600')
    expect(store.people.bob.file).toBe(`${M}/people/bob.md`)
    expect(store.projects.site.path).toBe('projects/site')
    expect(store.organizations.acme.billing).toEqual(['site'])
    expect(store.organizations['cazalla-net'].price_hour).toBe(55)
    expect(store.organizations['cazalla-net'].invoice_number).toBe('0026')
  })

  it('sorts lists by name and reports duplicates and files without frontmatter', async() => {
    usePreferencesStore().defaultDirectoryToOpen = '/vault'
    const store = useMetadataStore()
    await flush()
    await flush()
    expect(store.organizationsList.map((o) => o.slug)).toEqual(['acme', 'cazalla-net'])
    expect(store.errors).toEqual(['projects/dup.md: duplicate slug site', 'projects/broken.md: no frontmatter'])
    expect(notified).toHaveLength(1)
  })

  it('stays empty without a content folder and reloads on demand', async() => {
    const store = useMetadataStore()
    await flush()
    expect(store.projectsList).toEqual([])
    usePreferencesStore().defaultDirectoryToOpen = '/vault'
    await flush()
    await flush()
    expect(store.projectsList.map((p) => p.slug)).toEqual(['site'])
  })

  it('classifies organizations', async() => {
    usePreferencesStore().defaultDirectoryToOpen = '/vault'
    const store = useMetadataStore()
    await flush()
    await flush()
    expect(canInvoice(store.organizations['cazalla-net'])).toBe(true)
    expect(canBeInvoiced(store.organizations['cazalla-net'])).toBe(false)
    expect(canInvoice(store.organizations.acme)).toBe(false)
    expect(canBeInvoiced(store.organizations.acme)).toBe(true)
  })
})
