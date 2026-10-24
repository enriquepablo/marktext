import { parse, serialize, updateFields } from '../core/frontmatter'
import { dirname, ensureDir, exists, join, readText, writeText } from '../core/fs'
import { slug as toSlug } from '../core/slug'
import { isoNow } from '../core/time'
import { dueFrom, ExistsError } from './create'

/** The parent as read from its frontmatter; the task index is not required. */
export interface ParentTask {
  file: string
  slug: string
  path: string
  project: string | null
}

export const parentFromMarkdown = (file: string, markdown: string): ParentTask | null => {
  const f = parse(markdown)
  if (!f || f.category !== 'task') return null
  const stem = file.split(/[\\/]/).pop()?.replace(/\.md$/, '') ?? ''
  return {
    file,
    slug: typeof f.slug === 'string' && f.slug ? f.slug : stem,
    path: typeof f.path === 'string' && f.path ? f.path : '/',
    project: typeof f.project === 'string' && f.project ? f.project : null
  }
}

const joinPath = (...parts: string[]): string => ('/' + parts.join('/')).replace(/\/+/g, '/')

/**
 * Creates `<parent dir>/<parent slug>/<slug>.md` with the task frontmatter, the
 * parent's project, and `path` extended by the parent's slug; then appends
 * `<path>/<slug>` to the parent's `subtasks`. Returns the new file.
 */
export const createSubtask = async(parent: ParentTask, title: string, now: Date = new Date()): Promise<string> => {
  const slug = toSlug(title)
  const dir = join(dirname(parent.file), parent.slug)
  const file = join(dir, `${slug}.md`)
  if (await exists(file)) throw new ExistsError(file)
  const path = joinPath(parent.path, parent.slug)
  const stamp = isoNow(now)

  await ensureDir(dir)
  await writeText(
    file,
    serialize({
      title: title.trim(),
      slug,
      tags: [],
      date: stamp,
      modified: stamp,
      category: 'task',
      project: parent.project,
      path,
      status: 'new',
      due: dueFrom(null, now),
      effort: [],
      subtasks: []
    })
  )

  const parentText = await readText(parent.file)
  const current = parse(parentText)?.subtasks
  const entry = joinPath(path, slug)
  const subtasks = Array.isArray(current) ? current.map(String) : []
  if (!subtasks.includes(entry)) subtasks.push(entry)
  await writeText(parent.file, updateFields(parentText, { subtasks, modified: stamp }))
  return file
}
