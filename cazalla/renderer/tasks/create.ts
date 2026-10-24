import { serialize } from '../core/frontmatter'
import { exists, join, writeText } from '../core/fs'
import { slug as toSlug } from '../core/slug'
import { addMonths, isoNow } from '../core/time'
import type { Project } from '../metadata/types'

export class ExistsError extends Error {
  constructor(public readonly file: string) {
    super(`exists: ${file}`)
  }
}

export const NOTES_DIR = 'notes'
export const TASKS_DIR = 'tasks'
export const ARCHIVED_DIR = 'archived'

export const projectDir = (contentFolder: string, project: Project): string => join(contentFolder, project.path)

const writeNew = async(file: string, content: string): Promise<string> => {
  if (await exists(file)) throw new ExistsError(file)
  await writeText(file, content)
  return file
}

/** Writes `<project>/notes/<slug>.md` with the note frontmatter and an empty body. */
export const createNote = (
  contentFolder: string,
  project: Project,
  title: string,
  now: Date = new Date()
): Promise<string> => {
  const slug = toSlug(title)
  const stamp = isoNow(now)
  return writeNew(
    join(projectDir(contentFolder, project), NOTES_DIR, `${slug}.md`),
    serialize({
      title: title.trim(),
      slug,
      tags: null,
      date: stamp,
      modified: stamp,
      category: 'note',
      project: project.slug
    })
  )
}

export interface NewTask {
  title: string
  // `YYYY-MM-DD`; defaults to one month from now at the current time.
  due?: string | null
}

export const dueFrom = (due: string | null | undefined, now: Date): string => {
  if (!due) return addMonths(now, 1).toISOString()
  const [y, m, d] = due.split('-').map(Number)
  const at = new Date(now.getTime())
  at.setFullYear(y, m - 1, d)
  return at.toISOString()
}

/** Writes `<project>/tasks/<slug>.md` with the task frontmatter. */
export const createTask = (
  contentFolder: string,
  project: Project,
  input: NewTask,
  now: Date = new Date()
): Promise<string> => {
  const slug = toSlug(input.title)
  const stamp = isoNow(now)
  return writeNew(
    join(projectDir(contentFolder, project), TASKS_DIR, `${slug}.md`),
    serialize({
      title: input.title.trim(),
      slug,
      tags: [],
      date: stamp,
      modified: stamp,
      category: 'task',
      project: project.slug,
      path: '/',
      status: 'new',
      due: dueFrom(input.due, now),
      effort: [],
      subtasks: []
    })
  )
}
