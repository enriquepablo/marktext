/**
 * Assembles the actions that migrate one vault project into the content folder
 * (plan-cazalla.net, item 27). The vault is only read; `apply` writes the target.
 */
import fs from 'node:fs'
import path from 'node:path'
import { serialize, split, type Fields } from '../../renderer/core/frontmatter'
import { slug as toSlug } from '../../renderer/core/slug'
import { pickCandidate, rewriteWikiLinks, type WikiLink } from './links'
import { checklistLinks, normalisePath, taskFields, withoutLines } from './tasks'
import { findProject, indexByName, kanbanStatuses, projectRecords, readDoc, readRecord, vaultPath, walk, type Doc } from './vault'

export type Action =
  | { kind: 'mkdir'; dir: string }
  | { kind: 'copy'; from: string; to: string }
  | { kind: 'write'; file: string; content: string }

export type Plan = { actions: Action[]; report: string[]; target: string }

type TaskInfo = { slug: string; path: string; archived: boolean }
type Info = { rel: string; newPath: string; doc: Doc | null; task: TaskInfo | null }

const { join, basename, dirname } = path.posix
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
const first = (v: unknown): unknown => (Array.isArray(v) ? (v[0] ?? null) : v)
const segments = (p: string): string[] => p.split('/').filter(Boolean)
const FOLDERS: Record<string, string> = { Tasks: 'tasks', Notes: 'notes', Assets: 'assets' }

/** Where a project file lands under `target` (content-relative), and its task identity when it is one. */
export const place = (target: string, sub: string, doc: Doc | null): { newPath: string; task: TaskInfo | null } => {
  const segs = sub.split('/')
  const top = segs[0]
  const mid = segs.slice(1, -1)
  const stem = segs[segs.length - 1].replace(/\.md$/, '')
  const fields = doc?.fields
  const fileSlug = (): string => str(fields?.slug) ?? toSlug(str(fields?.title) ?? stem)
  if (fields?.category === 'task' && top === 'Tasks') {
    const slug = fileSlug()
    if (mid[0] === 'archived') {
      const p = normalisePath(str(fields['archived-path']) ?? '/')
      return { newPath: join(target, 'archived', ...segments(p), `${slug}.md`), task: { slug, path: p, archived: true } }
    }
    return { newPath: join(target, 'tasks', ...mid, `${slug}.md`), task: { slug, path: normalisePath(mid.join('/')), archived: false } }
  }
  if (fields?.category === 'note' && (top === 'Notes' || (top === 'Tasks' && mid.length === 0))) {
    return { newPath: join(target, 'notes', ...(top === 'Notes' ? mid : []), `${fileSlug()}.md`), task: null }
  }
  const mapped = top === 'Tasks' && segs[1] === 'archived' && segs.length > 2 ? ['archived', ...segs.slice(2)] : [FOLDERS[top] ?? top, ...segs.slice(1)]
  return { newPath: join(target, ...mapped), task: null }
}

type ResolverContext = {
  root: string
  notes: string
  /** Vault folder of the project being migrated; empty when there is none, and links into projects are then not reported. */
  projectDir: string
  index: Map<string, string[]>
  records: Fields[]
  infos: Map<string, Info>
  /** Content-relative folder that receives copies of `Files/` targets. */
  assetsDir: string
  actions: Action[]
  report: string[]
}

/** Resolves wiki link targets to their content-relative paths after migration, copying `Files/` targets as it goes. */
const makeResolver = (c: ResolverContext): { resolve: (link: WikiLink) => string | null; resolveFile: (target: string) => string | null } => {
  const assets = new Set<string>()
  const foreign = new Set<string>()
  const resolveFile = (target: string): string | null => pickCandidate(c.index.get(target) ?? [], c.projectDir)
  const resolve = (link: WikiLink): string | null => {
    const picked = resolveFile(link.target)
    if (!picked) return null
    const mine = c.infos.get(picked)
    if (mine) return mine.newPath
    if (picked.startsWith('Files/')) {
      const to = join(c.assetsDir, basename(picked))
      if (!assets.has(picked)) {
        assets.add(picked)
        c.actions.push({ kind: 'copy', from: path.join(c.root, picked), to: path.join(c.notes, to) })
        if (picked.endsWith('.excalidraw.md')) c.report.push(`excalidraw copied as is, not converted: ${picked}`)
      }
      return to
    }
    if (picked.startsWith('Daily/')) return dailyPath(picked)
    const other = c.records.find((r) => picked.startsWith(vaultPath(r.path as string) + '/'))
    if (!other) return null
    const otherDir = vaultPath(other.path as string)
    if (c.projectDir && !foreign.has(picked)) {
      foreign.add(picked)
      c.report.push(`link into another project (${String(other.slug)}): ${picked}`)
    }
    return place(join('projects', String(other.slug)), picked.slice(otherDir.length + 1), picked.endsWith('.md') ? readDoc(c.root, picked) : null).newPath
  }
  return { resolve, resolveFile }
}

/** `Daily/YYYY-MM-DD.md` → `_daily/YYYY/MM/YYYY-MM-DD.md`; null for any other name. */
export const dailyPath = (rel: string): string | null => {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(basename(rel, '.md'))
  return m ? join('_daily', m[1], m[2], basename(rel)) : null
}

export const plan = (root: string, notes: string, projectRel: string, now = new Date().toISOString()): Plan => {
  const actions: Action[] = []
  const report: string[] = []
  const projectDir = vaultPath(projectRel)
  const record = findProject(root, projectDir)
  const projectSlug = str(record?.slug) ?? toSlug(basename(projectDir))
  const target = join('projects', projectSlug)
  const out = (rel: string): string => path.join(notes, rel)

  const recordFile = out(join('_metadata', 'projects', `${projectSlug}.md`))
  if (fs.existsSync(recordFile)) report.push(`metadata record exists, left alone: ${recordFile}`)
  else {
    const fields: Fields = { name: str(record?.name) ?? basename(projectDir), slug: projectSlug, organization: first(record?.company) ?? null, leader: record?.leader ?? null, path: target }
    actions.push({ kind: 'write', file: recordFile, content: serialize(fields) })
  }
  for (const dir of ['tasks', 'notes', 'assets', 'archived']) actions.push({ kind: 'mkdir', dir: out(join(target, dir)) })

  const files = walk(root)
  const index = indexByName(files)
  const records = projectRecords(root)
  const boardFile = `${projectDir}/kanban.md`
  const board = files.includes(boardFile) ? kanbanStatuses(readDoc(root, boardFile).text) : new Map<string, string>()

  // Pass one: every project file gets its destination, so links can be rewritten in pass two.
  const infos = new Map<string, Info>()
  const used = new Set<string>()
  // Names with a space before the extension are Obsidian's accidental duplicates; they lose slug collisions.
  const trailing = (f: string): number => Number(/\s\.md$/.test(f))
  const own = files.filter((f) => f.startsWith(projectDir + '/') && f !== boardFile).sort((a, b) => trailing(a) - trailing(b))
  for (const rel of own) {
    const doc = rel.endsWith('.md') ? readDoc(root, rel) : null
    const placed = place(target, rel.slice(projectDir.length + 1), doc)
    let { newPath } = placed
    for (let n = 2; used.has(newPath); n++) {
      newPath = placed.newPath.replace(/\.md$/, `-${n}.md`)
      if (placed.task) placed.task.slug = `${placed.task.slug}-${n}`
      report.push(`name collision, renamed: ${rel} → ${newPath}`)
    }
    used.add(newPath)
    infos.set(rel, { rel, newPath, doc, task: placed.task })
  }
  for (const dir of new Set([...infos.values()].filter((i) => i.task && !i.task.archived).map((i) => dirname(i.newPath)))) {
    if (dir !== join(target, 'tasks') && !used.has(`${dir}.md`)) report.push(`subtask folder without parent task: ${dir}`)
  }

  const { resolve, resolveFile } = makeResolver({ root, notes, projectDir, index, records, infos, assetsDir: join(target, 'assets'), actions, report })

  // Pass two: write or copy each file.
  for (const info of infos.values()) {
    const { rel, newPath, doc } = info
    if (!doc) {
      actions.push({ kind: 'copy', from: path.join(root, rel), to: out(newPath) })
      continue
    }
    const dir = dirname(newPath)
    const stem = basename(rel, '.md')
    if (info.task && doc.fields) {
      const { task } = info
      const childDir = join(dir, task.slug)
      const subtasks: string[] = []
      const lifted = new Set<number>()
      for (const { line, target: t } of checklistLinks(doc.body)) {
        const child = infos.get(resolveFile(t) ?? '')
        if (child?.task && !child.task.archived && dirname(child.newPath) === childDir) {
          subtasks.push(normalisePath(`${task.path}/${task.slug}/${child.task.slug}`))
          lifted.add(line)
        }
      }
      for (const child of infos.values()) {
        if (child.task && !child.task.archived && dirname(child.newPath) === childDir) {
          const entry = normalisePath(`${task.path}/${task.slug}/${child.task.slug}`)
          if (!subtasks.includes(entry)) {
            subtasks.push(entry)
            report.push(`subtask not listed in parent, added: ${child.rel}`)
          }
        }
      }
      const body = rewriteWikiLinks(withoutLines(doc.body, lifted), dir, resolve)
      body.unresolved.forEach((u) => report.push(`unresolved link [[${u}]] in ${rel}`))
      const fields = taskFields({
        origin: doc.fields,
        title: str(doc.fields.title) ?? stem.trim(),
        slug: task.slug,
        project: projectSlug,
        path: task.path,
        archived: task.archived,
        boardStatus: board.get(stem.trim()) ?? board.get(str(doc.fields.title) ?? ''),
        subtasks,
        now
      })
      actions.push({ kind: 'write', file: out(newPath), content: serialize(fields, body.text) })
      continue
    }
    const { yaml, body } = split(doc.text)
    if (yaml === null) report.push(`no frontmatter, links converted only: ${rel}`)
    const rewritten = rewriteWikiLinks(body, dir, resolve)
    rewritten.unresolved.forEach((u) => report.push(`unresolved link [[${u}]] in ${rel}`))
    const content = yaml === null ? rewritten.text : `---\n${yaml}\n---\n${rewritten.text}`
    actions.push({ kind: 'write', file: out(newPath), content })
  }
  return { actions, report, target }
}

/** Plans the migration of `Daily/` into `_daily/YYYY/MM/`, frontmatter kept, body links rewritten. */
export const planDaily = (root: string, notes: string): Plan => {
  const actions: Action[] = []
  const report: string[] = []
  const files = walk(root)
  const { resolve } = makeResolver({
    root,
    notes,
    projectDir: '',
    index: indexByName(files),
    records: projectRecords(root),
    infos: new Map(),
    assetsDir: join('_daily', 'assets'),
    actions,
    report
  })
  for (const rel of files.filter((f) => f.startsWith('Daily/'))) {
    const newPath = dailyPath(rel)
    if (!newPath || !rel.endsWith('.md')) {
      report.push(`not a daily note, skipped: ${rel}`)
      continue
    }
    const { yaml, body } = split(readDoc(root, rel).text)
    const rewritten = rewriteWikiLinks(body, dirname(newPath), resolve)
    rewritten.unresolved.forEach((u) => report.push(`unresolved link [[${u}]] in ${rel}`))
    const content = yaml === null ? rewritten.text : `---\n${yaml}\n---\n${rewritten.text}`
    actions.push({ kind: 'write', file: path.join(notes, newPath), content })
  }
  return { actions, report, target: '_daily' }
}

const METADATA_KINDS: [string, string][] = [
  ['companies', 'organizations'],
  ['people', 'people'],
  ['projects', 'projects']
]

/**
 * Plans `Metadata/{companies,people,projects}` → `_metadata/{organizations,people,projects}/<slug>.md`
 * with fences; `company` becomes `organization` (normalised to an organization slug),
 * `service` is dropped, a project's `path` becomes `projects/<slug>`.
 */
export const planMetadata = (root: string, notes: string): Plan => {
  const actions: Action[] = []
  const report: string[] = []
  const records = METADATA_KINDS.flatMap(([from, to]) => {
    const dir = path.join(root, 'Metadata', from)
    if (!fs.existsSync(dir)) return []
    return fs
      .readdirSync(dir)
      .filter((n) => n.endsWith('.md'))
      .map((n) => ({ rel: `Metadata/${from}/${n}`, to, fields: readRecord(root, `Metadata/${from}/${n}`) }))
  })
  const organizations = new Set(records.filter((r) => r.to === 'organizations').map((r) => str(r.fields?.slug)))
  for (const { rel, to, fields } of records) {
    if (!fields) {
      report.push(`unreadable record, skipped: ${rel}`)
      continue
    }
    const slug = str(fields.slug) ?? toSlug(str(fields.name) ?? basename(rel, '.md'))
    const out: Fields = {}
    for (const [key, value] of Object.entries(fields)) {
      if (key === 'service') continue
      if (key === 'company') {
        const raw = str(first(value))
        const org = raw !== null && !organizations.has(raw) && organizations.has(toSlug(raw)) ? toSlug(raw) : raw
        if (org !== null && !organizations.has(org)) report.push(`organization not found: ${org} in ${rel}`)
        out.organization = org
      } else if (key === 'path' && to === 'projects') out.path = join('projects', slug)
      else out[key] = value
    }
    actions.push({ kind: 'write', file: path.join(notes, '_metadata', to, `${slug}.md`), content: serialize(out) })
  }
  return { actions, report, target: '_metadata' }
}

export const apply = (actions: Action[]): void => {
  for (const a of actions) {
    if (a.kind === 'mkdir') fs.mkdirSync(a.dir, { recursive: true })
    else if (a.kind === 'write') {
      fs.mkdirSync(path.dirname(a.file), { recursive: true })
      fs.writeFileSync(a.file, a.content)
    } else {
      fs.mkdirSync(path.dirname(a.to), { recursive: true })
      fs.copyFileSync(a.from, a.to)
    }
  }
}

export const describe = (a: Action): string =>
  a.kind === 'mkdir' ? `mkdir ${a.dir}` : a.kind === 'write' ? `write ${a.file}` : `copy  ${a.from} → ${a.to}`
