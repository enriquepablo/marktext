import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import bus from '@/bus'
import { usePreferencesStore } from '@/store/preferences'
import {
  dailyNoteSegments,
  formatDateKey,
  monthDirSegments,
  newNoteContent,
  touchModified
} from './util'

export const LAYOUT_ENTRY = 'showDailyNotes'
export const TOGGLE_BUS_EVENT = 'cazalla:toggle-daily-notes'
const VISIBLE_KEY = 'daily-notes-visible'
const WIDTH_KEY = 'daily-notes-width'
const MIN_WIDTH = 280
const DEFAULT_WIDTH = 360
const SAVE_DELAY_MS = 1000
const NOTE_FILE = /^(\d{4}-\d{2}-\d{2})\.md$/

const normalizeWidth = (value: unknown): number => {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? Math.max(n, MIN_WIDTH) : DEFAULT_WIDTH
}

const readStorage = (key: string): string | null => {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

const writeStorage = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value)
  } catch {
    /* storage unavailable */
  }
}

interface PendingSave {
  path: string
  markdown: string
}

export const useDailyNotesStore = defineStore('dailyNotes', () => {
  const preferencesStore = usePreferencesStore()
  const today = new Date()

  const visible = ref(readStorage(VISIBLE_KEY) === 'true')
  const width = ref(normalizeWidth(readStorage(WIDTH_KEY)))
  const effectiveWidth = computed(() => (visible.value ? width.value : 0))
  const contentFolder = computed<string | null>(() => preferencesStore.defaultDirectoryToOpen || null)

  const selectedDate = ref<Date | null>(null)
  const visibleMonth = ref({ year: today.getFullYear(), month: today.getMonth() })
  const notePath = ref<string | null>(null)
  // Content as loaded from disk. Not updated on save, so the editor is not re-rendered while typing.
  const markdown = ref('')
  const existingDays = ref<Set<string>>(new Set())

  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let pendingSave: PendingSave | null = null

  const sendLayoutChanged = (): void => {
    const { windowId } = window.marktext?.env ?? {}
    window.electron.ipcRenderer.send('mt::view-layout-changed', Number(windowId), {
      [LAYOUT_ENTRY]: visible.value
    })
  }

  function TOGGLE(): void {
    visible.value = !visible.value
    writeStorage(VISIBLE_KEY, String(visible.value))
    sendLayoutChanged()
    if (!visible.value) void FLUSH_SAVE()
  }

  function SET_WIDTH(value: number | string): void {
    width.value = normalizeWidth(value)
    writeStorage(WIDTH_KEY, String(width.value))
  }

  const pathFor = (date: Date): string | null => {
    const folder = contentFolder.value
    return folder ? window.path.join(folder, ...dailyNoteSegments(date)) : null
  }

  async function REFRESH_MONTH(): Promise<void> {
    const folder = contentFolder.value
    if (!folder) {
      existingDays.value = new Set()
      return
    }
    const { year, month } = visibleMonth.value
    const dir = window.path.join(folder, ...monthDirSegments(year, month))
    let names: string[] = []
    try {
      names = await window.fileUtils.readdir(dir)
    } catch {
      /* month folder does not exist yet */
    }
    const days = new Set<string>()
    for (const name of names) {
      const m = NOTE_FILE.exec(name)
      if (m) days.add(m[1])
    }
    existingDays.value = days
  }

  async function OPEN_DATE(date: Date): Promise<void> {
    await FLUSH_SAVE()
    const path = pathFor(date)
    if (!path) return
    await window.fileUtils.ensureDir(window.path.dirname(path))
    if (!(await window.fileUtils.pathExists(path))) {
      await window.fileUtils.outputFile(path, newNoteContent(date, new Date()))
    }
    markdown.value = String(await window.fileUtils.readFile(path, 'utf8'))
    notePath.value = path
    selectedDate.value = date
    visibleMonth.value = { year: date.getFullYear(), month: date.getMonth() }
    await REFRESH_MONTH()
  }

  function SAVE_NOTE(content: string): void {
    if (!notePath.value) return
    pendingSave = { path: notePath.value, markdown: content }
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => void FLUSH_SAVE(), SAVE_DELAY_MS)
  }

  async function FLUSH_SAVE(): Promise<void> {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    const save = pendingSave
    pendingSave = null
    if (!save) return
    await window.fileUtils.writeFile(save.path, touchModified(save.markdown, new Date()))
  }

  async function SHIFT_MONTH(delta: number): Promise<void> {
    const { year, month } = visibleMonth.value
    const d = new Date(year, month + delta, 1)
    visibleMonth.value = { year: d.getFullYear(), month: d.getMonth() }
    await REFRESH_MONTH()
  }

  async function GO_TODAY(): Promise<void> {
    await OPEN_DATE(new Date())
  }

  let listening = false
  function LISTEN(): void {
    if (listening) return
    listening = true
    window.electron.ipcRenderer.on('mt::toggle-view-layout-entry', (_e, entry) => {
      if (entry === LAYOUT_ENTRY) TOGGLE()
    })
    bus.on(TOGGLE_BUS_EVENT, () => TOGGLE())
    sendLayoutChanged()
  }

  watch(contentFolder, () => {
    void FLUSH_SAVE()
    notePath.value = null
    selectedDate.value = null
    markdown.value = ''
    void REFRESH_MONTH()
  })

  return {
    visible,
    width,
    effectiveWidth,
    contentFolder,
    selectedDate,
    visibleMonth,
    notePath,
    markdown,
    existingDays,
    selectedKey: computed(() => (selectedDate.value ? formatDateKey(selectedDate.value) : null)),
    TOGGLE,
    SET_WIDTH,
    OPEN_DATE,
    SAVE_NOTE,
    FLUSH_SAVE,
    REFRESH_MONTH,
    SHIFT_MONTH,
    GO_TODAY,
    LISTEN
  }
})
