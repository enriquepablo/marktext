import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import MiniSearch, { type SearchResult } from 'minisearch'
import { indexOptions, newIndex } from './indexOptions'
import { useContentFolder } from '../core/contentFolder'
import { exists, join, listFiles, readText, writeText } from '../core/fs'
import { excalidrawDoc, isIndexable, markdownDoc, pdfDoc, type SearchDoc } from './extract'

const INDEX_FILE = ['.cazalla', 'search-index.json']
const VERSION = 1

interface Persisted {
  version: number
  mtimes: Record<string, number>
  index: unknown
}

export type SearchHit = SearchResult & { title: string; category: string; project: string; excerpt: string }

export const useSearchStore = defineStore('cazallaSearch', () => {
  const contentFolder = useContentFolder()
  let index = newIndex()
  let mtimes: Record<string, number> = {}
  const ready = ref(false)
  const indexing = ref(false)
  const count = ref(0)
  const indexFile = (): string | null => (contentFolder.value ? join(contentFolder.value, ...INDEX_FILE) : null)

  const docFor = async(file: string): Promise<SearchDoc | null> => {
    if (/\.pdf$/i.test(file)) {
      const data = await window.fileUtils.readFile(file)
      const { extractPdfText } = await import('./pdfText')
      return pdfDoc(file, await extractPdfText(typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)))
    }
    const text = await readText(file)
    return /\.excalidraw$/i.test(file) ? excalidrawDoc(file, text) : markdownDoc(file, text)
  }

  const upsert = (doc: SearchDoc): void => {
    if (index.has(doc.id)) index.replace(doc)
    else index.add(doc)
  }

  let saveTimer: ReturnType<typeof setTimeout> | null = null
  const save = (): void => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const file = indexFile()
      if (!file) return
      const payload: Persisted = { version: VERSION, mtimes, index: index.toJSON() }
      void writeText(file, JSON.stringify(payload))
    }, 1000)
  }

  const restore = async(): Promise<void> => {
    index = newIndex()
    mtimes = {}
    const file = indexFile()
    if (!file || !(await exists(file))) return
    try {
      const saved = JSON.parse(await readText(file)) as Persisted
      if (saved.version !== VERSION) return
      index = MiniSearch.loadJS(saved.index as Parameters<typeof MiniSearch.loadJS>[0], indexOptions)
      mtimes = saved.mtimes ?? {}
    } catch {
      index = newIndex()
      mtimes = {}
    }
  }

  /** Reconciles the index with the files on disk: new and changed files are read, missing ones dropped. */
  async function REFRESH(full = false): Promise<void> {
    const folder = contentFolder.value
    if (!folder || indexing.value) return
    indexing.value = true
    try {
      if (full) {
        index = newIndex()
        mtimes = {}
      }
      const files = await listFiles(folder, isIndexable)
      const seen = new Set<string>()
      for (const file of files) {
        seen.add(file)
        const stat = await window.fileUtils.stat(file).catch(() => null)
        if (!stat) continue
        if (mtimes[file] === stat.mtimeMs && index.has(file)) continue
        try {
          const doc = await docFor(file)
          if (doc) {
            upsert(doc)
            mtimes[file] = stat.mtimeMs
          }
        } catch {
          /* unreadable file: skipped until it changes */
        }
      }
      for (const id of Object.keys(mtimes)) {
        if (!seen.has(id)) {
          if (index.has(id)) index.discard(id)
          delete mtimes[id]
        }
      }
      count.value = index.documentCount
      ready.value = true
      save()
    } finally {
      indexing.value = false
    }
  }

  function SEARCH(query: string, category: string | null): SearchHit[] {
    if (!query.trim()) return []
    const hits = index.search(query, category ? { filter: (r) => r.category === category } : {}) as SearchHit[]
    return hits.slice(0, 100)
  }

  let timer: ReturnType<typeof setTimeout> | null = null
  let listening = false
  function LISTEN(): void {
    if (listening) return
    listening = true
    window.electron.ipcRenderer.on('mt::update-object-tree', () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void REFRESH(), 1500)
    })
  }

  watch(
    contentFolder,
    async() => {
      ready.value = false
      await restore()
      count.value = index.documentCount
      void REFRESH()
    },
    { immediate: true }
  )

  return { ready, indexing, count, REFRESH, SEARCH, LISTEN }
})
