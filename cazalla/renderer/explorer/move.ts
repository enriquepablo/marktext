import { parse, updateFields } from '../core/frontmatter'
import { basename, dirname, exists, listMarkdownFiles, move, readText, writeText } from '../core/fs'
import { isoNow } from '../core/time'
import type { Project, Site } from '../metadata/types'
import { TASKS_DIR } from '../tasks/create'
import { PAGES_DIR } from '../sites/pages'
import { remapper, rewriteLinks } from './links'

export interface MoveContext {
  // The vault root; link rewriting scans every markdown file below it. Null disables sync.
  contentFolder: string | null
  projects: Project[]
  sites?: Site[]
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
const norm = (p: string): string => {
  const n = window.path.normalize ? window.path.normalize(p) : p
  return n.length > 1 ? n.replace(/[\\/]+$/, '') : n
}
const isUnder = (parent: string, child: string): boolean => {
  const a = norm(parent)
  const b = norm(child)
  return b === a || b.startsWith(a + sep())
}
const join = (...p: string[]): string => window.path.join(...p)

const stem = (file: string): string => basename(file).replace(/\.md$/, '')

/** The parent task file of a subtask lives beside the subtask's folder and shares its name. */
const parentTaskOf = (taskFile: string): string => join(dirname(dirname(taskFile)), `${basename(dirname(taskFile))}.md`)

const addToList = (list: unknown, entry: string): string[] => {
  const out = Array.isArray(list) ? list.map(String) : []
  if (!out.includes(entry)) out.push(entry)
  return out
}

/** `path` of a task or page: its folder relative to `<record>/<subdir>`, or null when it lies elsewhere. */
const pathWithin = (contentFolder: string, record: Project | Site, subdir: string, file: string): string | null => {
  const base = join(contentFolder, record.path, subdir)
  if (!isUnder(base, dirname(file))) return null
  const rel = window.path.relative(base, dirname(file))
  return rel ? '/' + rel.split(sep()).join('/') : '/'
}

/** The project (or site) whose folder holds `file`; paths of the records are relative to the content folder. */
export const projectContaining = <T extends Project | Site>(contentFolder: string, projects: T[], file: string): T | undefined =>
  projects.find((p) => isUnder(join(contentFolder, p.path), file))

/**
 * Moves `from` to `to` (a full path) and keeps the vault consistent: project
 * paths, task `project`/`path`, the parent's `subtasks` for single task files,
 * and relative links in every markdown document. Returns what changed.
 */
export const moveEntry = async(fromRaw: string, toRaw: string, ctx: MoveContext): Promise<MoveResult> => {
  const from = norm(fromRaw)
  const to = norm(toRaw)
  if (ctx.contentFolder) ctx = { ...ctx, contentFolder: norm(ctx.contentFolder) }
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
    // Project and site paths are relative to the vault; rewrite those the move touched.
    for (const record of [...ctx.projects, ...(ctx.sites ?? [])]) {
      const abs = join(folder, record.path)
      const next = remap(abs)
      if (next !== abs) {
        const file = remap(record.file)
        await writeText(file, updateFields(await readText(file), { path: window.path.relative(folder, next).split(sep()).join('/') }))
        updated.add(file)
      }
    }
    const relocate = <T extends Project | Site>(r: T): T => ({ ...r, path: window.path.relative(folder, remap(join(folder, r.path))).split(sep()).join('/') })
    const projects = ctx.projects.map(relocate)
    const sites = (ctx.sites ?? []).map(relocate)

    if (oldParentEntry) {
      const text = await readText(oldParentEntry.file)
      const subtasks = (parse(text)?.subtasks as unknown[] | undefined)?.map(String).filter((s) => s !== oldParentEntry!.entry) ?? []
      await writeText(oldParentEntry.file, updateFields(text, { subtasks, modified: stamp }))
      updated.add(oldParentEntry.file)
    }

    // Every markdown file: moved tasks and pages get their project and path refreshed; links are re-resolved.
    const files = await listMarkdownFiles(folder)
    const movedFiles = new Set(files.filter((f) => isUnder(to, f)))
    for (const file of files) {
      let text = await readText(file)
      const original = text
      const fields = parse(text)
      const kind = fields?.category === 'task' ? 'task' : fields?.category === 'webpage' ? 'webpage' : null
      if (fields && kind && movedFiles.has(file)) {
        const owner = projectContaining<Project | Site>(folder, kind === 'task' ? projects : sites, file)
        const path = owner ? pathWithin(folder, owner, kind === 'task' ? TASKS_DIR : PAGES_DIR, file) : null
        const patch: Record<string, unknown> = {}
        if (owner && fields.project !== owner.slug) patch.project = owner.slug
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
