import { parse, updateFields } from '../core/frontmatter'
import { dirname, ensureDir, exists, join, listDir, move, readText, writeText } from '../core/fs'
import { isoNow } from '../core/time'
import type { Project } from '../metadata/types'
import { ARCHIVED_DIR, ExistsError } from './create'
import type { TaskRecord } from './types'

export class HasSubtasksError extends Error {
  constructor(public readonly slug: string) {
    super(`has subtasks: ${slug}`)
  }
}

const segments = (path: string): string[] => path.split('/').filter(Boolean)

/** Where a task lands when archived: `<project>/archived/<path>/<slug>.md`. */
export const archivedFile = (contentFolder: string, project: Project, task: TaskRecord): string =>
  join(contentFolder, project.path, ARCHIVED_DIR, ...segments(task.path), `${task.slug}.md`)

/**
 * Moves a task to the project's `archived/` folder keeping its subpath, marks
 * it archived, removes it from its parent's `subtasks`, and trashes the parent's
 * subtask folder when that was the last entry. Returns the new file path.
 * A task that still has subtasks is refused.
 */
export const archiveTask = async(contentFolder: string, project: Project, task: TaskRecord): Promise<string> => {
  if (task.subtasks.length > 0) throw new HasSubtasksError(task.slug)
  const target = archivedFile(contentFolder, project, task)
  if (await exists(target)) throw new ExistsError(target)

  await ensureDir(dirname(target))
  await move(task.file, target)
  const stamp = isoNow()
  await writeText(target, updateFields(await readText(target), { status: 'archived', modified: stamp }))

  const parentSlug = segments(task.path).at(-1)
  if (!parentSlug) return target

  const subtaskDir = dirname(task.file)
  const parentFile = join(dirname(subtaskDir), `${parentSlug}.md`)
  if (await exists(parentFile)) {
    const text = await readText(parentFile)
    const current = parse(text)?.subtasks
    const entry = `${task.path}/${task.slug}`.replace(/\/+/g, '/')
    const subtasks = (Array.isArray(current) ? current.map(String) : []).filter((s) => s !== entry)
    await writeText(parentFile, updateFields(text, { subtasks, modified: stamp }))
  }
  if ((await listDir(subtaskDir)).length === 0) {
    // The bridge has no rmdir; the trash keeps the removal reversible.
    await window.electron.ipcRenderer.invoke('mt::fs-trash-item', subtaskDir)
  }
  return target
}
