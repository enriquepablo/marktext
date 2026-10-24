import { parse, updateFields } from '../core/frontmatter'
import { basename, dirname, exists, listMarkdownFiles, move, readText, writeText } from '../core/fs'
import { isoNow } from '../core/time'
import type { Project } from '../metadata/types'
import { TASKS_DIR } from '../tasks/create'
import { remapper, rewriteLinks } from './links'

export interface MoveContext {
  // The vault root; link rewriting scans every markdown file below it. Null disables sync.
  contentFolder: string | null
  projects: Project[]
}

export interface MoveResult {
  to: string
  rewrittenLinks: number
  updatedFiles: string[]
}

export class MoveError extends Error {
  constructor(public readonly code: 'exists' | 'into-self' | 'missing', public readonly detail: string) {
    super(`${code}: ${detail}`)
  }
}

const sep = (): string => window.path.sep
const isUnder = (parent: string, child: string): boolean => child === parent || child.startsWith(parent + sep())
const join = (...p: string[]): string => window.path.join(...p)

const stem = (file: string): string => basename(file).replace(/\.md$/, '')

/** The parent task file of a subtask lives beside the subtask's folder and shares its name. */
const parentTaskOf = (taskFile: string): string => join(dirname(dirname(taskFile)), `${basename(dirname(taskFile))}.md`)

const addToList = (list: unknown, entry: string): string[] => {
  const out = Array.isArray(list) ? list.map(String) : []
  if (!out.includes(entry)) out.push(entry)
  return out
}

const taskPathFor = (contentFolder: string, project: Project, file: string): string | null => {
  const tasksDir = join(contentFolder, project.path, TASKS_DIR)
  if (!isUnder(tasksDir, dirname(file))) return null
  const rel = window.path.relative(tasksDir, dirname(file))
  return rel ? '/' + rel.split(sep()).join('/') : '/'
}

const projectContaining = (contentFolder: string, projects: Project[], file: string): Project | undefined =>
  projects.find((p) => isUnder(join(contentFolder, p.path), file))

/**
 * Moves `from` to `to` (a full path) and keeps the vault consistent: project
 * paths, task `project`/`path`, the parent's `subtasks` for single task files,
 * and relative links in every markdown document. Returns what changed.
 */
export const moveEntry = async(from: string, to: string, ctx: MoveContext): Promise<MoveResult> => {
  if (!(await exists(from))) throw new MoveError('missing', from)
  if (isUnder(from, to)) throw new MoveError('into-self', to)
  if (await exists(to)) throw new MoveError('exists', to)

  const remap = remapper(from, to)
  const back = remapper(to, from)
  const updated = new Set<string>()
  const stamp = isoNow()

  // A single task file leaving its parent's folder: unlink it before the move.
  const wasTask = from.endsWith('.md') && !!ctx.contentFolder
  let oldParentEntry: { file: string; entry: string } | null = null
  if (wasTask) {
    const fields = parse(await readText(from))
    if (fields?.category === 'task') {
      const parent = parentTaskOf(from)
      if (dirname(dirname(from)) !== dirname(from) && (await exists(parent))) {
        oldParentEntry = { file: parent, entry: `${String(fields.path ?? '/')}/${stem(from)}`.replace(/\/+/g, '/') }
      }
    }
  }

  await move(from, to)

  let rewrittenLinks = 0
  if (ctx.contentFolder) {
    const folder = ctx.contentFolder
    // Project paths are relative to the vault; rewrite those the move touched.
    for (const project of ctx.projects) {
      const abs = join(folder, project.path)
      const next = remap(abs)
      if (next !== abs) {
        const file = remap(project.file)
        await writeText(file, updateFields(await readText(file), { path: window.path.relative(folder, next).split(sep()).join('/') }))
        updated.add(file)
      }
    }
    const projects = ctx.projects.map((p) => ({ ...p, path: window.path.relative(folder, remap(join(folder, p.path))).split(sep()).join('/') }))

    if (oldParentEntry) {
      const text = await readText(oldParentEntry.file)
      const subtasks = (parse(text)?.subtasks as unknown[] | undefined)?.map(String).filter((s) => s !== oldParentEntry!.entry) ?? []
      await writeText(oldParentEntry.file, updateFields(text, { subtasks, modified: stamp }))
      updated.add(oldParentEntry.file)
    }

    // Every markdown file: tasks get their project and path refreshed; links are re-resolved.
    const files = await listMarkdownFiles(folder)
    const movedFiles = new Set(files.filter((f) => isUnder(to, f)))
    for (const file of files) {
      let text = await readText(file)
      const original = text
      const fields = parse(text)
      if (fields?.category === 'task' && movedFiles.has(file)) {
        const project = projectContaining(folder, projects, file)
        const path = project ? taskPathFor(folder, project, file) : null
        const patch: Record<string, unknown> = {}
        if (project && fields.project !== project.slug) patch.project = project.slug
        if (path && fields.path !== path) patch.path = path
        if (Object.keys(patch).length) text = updateFields(text, { ...patch, modified: stamp })
      }
      const oldDir = dirname(back(file))
      const result = rewriteLinks(text, oldDir, dirname(file), remap)
      text = result.text
      rewrittenLinks += result.count
      if (text !== original) {
        await writeText(file, text)
        updated.add(file)
      }
    }

    // A single task file arriving in another task's folder becomes its subtask.
    if (wasTask && to.endsWith('.md')) {
      const parent = parentTaskOf(to)
      if (await exists(parent)) {
        const parentText = await readText(parent)
        const parentFields = parse(parentText)
        if (parentFields?.category === 'task') {
          const entry = `${String(parentFields.path ?? '/')}/${basename(dirname(to))}/${stem(to)}`.replace(/\/+/g, '/')
          await writeText(parent, updateFields(parentText, { subtasks: addToList(parentFields.subtasks, entry), modified: stamp }))
          updated.add(parent)
        }
      }
    }
  }

  return { to, rewrittenLinks, updatedFiles: [...updated] }
}
