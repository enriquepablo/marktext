import { ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useContentFolder } from '../core/contentFolder'
import { folderState, parsePorcelain, type GitState } from './porcelain'

// Mirrors cazalla/main/git.ts; main and renderer bundles do not share modules.
const CHANNEL = 'mt::cazalla-git-status'

const toPosixRelative = (root: string, abs: string): string | null => {
  if (abs === root) return ''
  const sep = window.path.sep
  if (!abs.startsWith(root + sep)) return null
  return abs.slice(root.length + 1).split(sep).join('/')
}

/** Git working-tree state of the content folder, refreshed with the file tree. */
export const useGitStatusStore = defineStore('cazallaGit', () => {
  const contentFolder = useContentFolder()
  const states = ref<Map<string, GitState>>(new Map())
  const available = ref(false)

  async function REFRESH(): Promise<void> {
    const folder = contentFolder.value
    if (!folder) {
      states.value = new Map()
      available.value = false
      return
    }
    const result = (await window.electron.ipcRenderer.invoke(CHANNEL, folder)) as { ok: boolean; output: string }
    available.value = result.ok
    states.value = result.ok ? parsePorcelain(result.output) : new Map()
  }

  /** States for an absolute path: a file's own state, or the mix below a folder. */
  function STATE_OF(abs: string, isDir: boolean): Set<GitState> {
    const folder = contentFolder.value
    const rel = folder ? toPosixRelative(folder, abs) : null
    if (rel === null) return new Set()
    if (!isDir) {
      const s = states.value.get(rel)
      return s ? new Set([s]) : new Set()
    }
    return folderState(states.value, rel)
  }

  let timer: ReturnType<typeof setTimeout> | null = null
  let listening = false
  function LISTEN(): void {
    if (listening) return
    listening = true
    window.electron.ipcRenderer.on('mt::update-object-tree', () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => void REFRESH(), 800)
    })
  }

  watch(contentFolder, () => void REFRESH(), { immediate: true })

  return { states, available, REFRESH, STATE_OF, LISTEN }
})
