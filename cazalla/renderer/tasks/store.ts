import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { useContentFolder } from '../core/contentFolder'
import { parse, updateFields, type Fields } from '../core/frontmatter'
import { basename, join, listMarkdownFiles, readText, writeText } from '../core/fs'
import { isoNow } from '../core/time'
import { useMetadataStore } from '../metadata/store'
import type { Project } from '../metadata/types'
import { ARCHIVED_DIR, TASKS_DIR } from './create'
import { isTaskStatus, type EffortEntry, type TaskRecord } from './types'

const str = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v))
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : [])

const efforts = (v: unknown): EffortEntry[] => {
  if (!Array.isArray(v)) return []
  const out: EffortEntry[] = []
  for (const item of v) {
    if (!item || typeof item !== 'object') continue
    const entry: EffortEntry = {}
    for (const [k, hours] of Object.entries(item as Record<string, unknown>)) {
      const n = Number(hours)
      if (Number.isFinite(n)) entry[k] = n
    }
    if (Object.keys(entry).length) out.push(entry)
  }
  return out
}

const toRecord = (f: Fields, file: string, archived: boolean): TaskRecord => ({
  file,
  title: str(f.title) ?? basename(file, '.md'),
  slug: str(f.slug) ?? basename(file, '.md'),
  project: str(f.project),
  path: str(f.path) ?? '/',
  status: archived ? 'archived' : isTaskStatus(f.status) ? f.status : 'new',
  kanban: f.kanban !== false,
  due: str(f.due),
  effort: efforts(f.effort),
  subtasks: strings(f.subtasks),
  tags: strings(f.tags),
  date: str(f.date),
  modified: str(f.modified),
  archived
})

export const useTaskStore = defineStore('cazallaTasks', () => {
  const contentFolder = useContentFolder()
  const metadata = useMetadataStore()

  const tasks = ref<Record<string, TaskRecord>>({})
  const loaded = ref(false)

  const list = computed(() => Object.values(tasks.value))
  const byProject = (slug: string): TaskRecord[] => list.value.filter((t) => t.project === slug)
  const active = computed(() => list.value.filter((t) => !t.archived))

  const projectDirs = (project: Project): { dir: string; archived: boolean }[] => {
    const root = join(contentFolder.value as string, project.path)
    return [
      { dir: join(root, TASKS_DIR), archived: false },
      { dir: join(root, ARCHIVED_DIR), archived: true }
    ]
  }

  async function readOne(file: string, archived: boolean): Promise<TaskRecord | null> {
    const fields = parse(await readText(file))
    if (!fields || fields.category !== 'task') return null
    return toRecord(fields, file, archived)
  }

  async function LOAD(): Promise<void> {
    const out: Record<string, TaskRecord> = {}
    if (contentFolder.value) {
      for (const project of metadata.projectsList) {
        for (const { dir, archived } of projectDirs(project)) {
          for (const file of await listMarkdownFiles(dir)) {
            const record = await readOne(file, archived)
            if (record) out[file] = record
          }
        }
      }
    }
    tasks.value = out
    loaded.value = true
  }

  /** Rewrites frontmatter keys of one task, stamps `modified`, and refreshes its record. */
  async function UPDATE(file: string, patch: Fields): Promise<void> {
    const text = await readText(file)
    await writeText(file, updateFields(text, { ...patch, modified: isoNow() }))
    const record = await readOne(file, tasks.value[file]?.archived ?? false)
    if (record) tasks.value = { ...tasks.value, [file]: record }
  }

  const isUnderProject = (pathname: string): boolean => {
    const folder = contentFolder.value
    if (!folder) return false
    return metadata.projectsList.some((p) => pathname.startsWith(join(folder, p.path) + window.path.sep))
  }

  let reloadTimer: ReturnType<typeof setTimeout> | null = null
  let listening = false
  function LISTEN(): void {
    if (listening) return
    listening = true
    window.electron.ipcRenderer.on('mt::update-object-tree', (_e, payload) => {
      const pathname = (payload as { change?: { pathname?: string } })?.change?.pathname
      if (!pathname || !isUnderProject(pathname)) return
      if (reloadTimer) clearTimeout(reloadTimer)
      reloadTimer = setTimeout(() => void LOAD(), 300)
    })
  }

  // Projects come from metadata; whenever that list settles, the index follows.
  watch(() => [contentFolder.value, metadata.projectsList.map((p) => p.slug + ':' + p.path).join('|')], () => void LOAD(), {
    immediate: true
  })

  return { tasks, list, active, loaded, byProject, LOAD, UPDATE, LISTEN }
})
