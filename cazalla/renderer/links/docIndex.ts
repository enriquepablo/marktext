import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useContentFolder } from '../core/contentFolder'
import { parse } from '../core/frontmatter'
import { basename, listMarkdownFiles, readText } from '../core/fs'

export interface DocEntry {
  file: string
  title: string
  // Creation time from frontmatter `date`, else the file's birth time.
  created: number
}

const HIDDEN = /(^|[\\/])(\.[^\\/]+|node_modules)([\\/]|$)/

/** Titles of every markdown document in the vault, newest first; feeds the link dialog. */
export const useDocIndexStore = defineStore('cazallaDocs', () => {
  const contentFolder = useContentFolder()
  const docs = ref<DocEntry[]>([])
  const loaded = ref(false)

  const recent = computed(() => [...docs.value].sort((a, b) => b.created - a.created))

  async function LOAD(): Promise<void> {
    const folder = contentFolder.value
    const out: DocEntry[] = []
    if (folder) {
      for (const file of await listMarkdownFiles(folder)) {
        if (HIDDEN.test(file.slice(folder.length))) continue
        const text = await readText(file).catch(() => '')
        const fields = parse(text)
        const title = typeof fields?.title === 'string' && fields.title ? fields.title : basename(file, '.md')
        const date = typeof fields?.date === 'string' ? Date.parse(fields.date) : NaN
        const stat = Number.isNaN(date) ? await window.fileUtils.stat(file).catch(() => null) : null
        out.push({ file, title, created: Number.isNaN(date) ? (stat?.birthtimeMs ?? 0) : date })
      }
    }
    docs.value = out
    loaded.value = true
  }

  let timer: ReturnType<typeof setTimeout> | null = null
  let listening = false
  function LISTEN(): void {
    if (listening) return
    listening = true
    window.electron.ipcRenderer.on('mt::update-object-tree', (_e, payload) => {
      const type = (payload as { type?: string })?.type
      if (type !== 'add' && type !== 'unlink' && type !== 'change') return
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void LOAD(), 500)
    })
  }

  watch(contentFolder, () => void LOAD(), { immediate: true })

  return { docs, recent, loaded, LOAD, LISTEN }
})
