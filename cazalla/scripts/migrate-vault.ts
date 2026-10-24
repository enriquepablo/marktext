/**
 * One-time migration of an Obsidian vault written for cazalla-net.plugin to the
 * layout this fork reads (see plan-cazalla.net, item 2):
 *
 *   Metadata/companies/*.md  →  _metadata/organizations/*.md
 *   Metadata/people/*.md     →  _metadata/people/*.md
 *   Metadata/projects/*.md   →  _metadata/projects/*.md
 *   plain YAML files         →  markdown with `---` fences
 *   key `company`            →  `organization` (first value when it was a list)
 *   project `path` trailing slash removed; `<path>/Tasks` → `tasks`, `notes/`,
 *   `assets/` and `archived/` created; `Tasks/archived/*` moved to `archived/`
 *   organizations/<slug>/{assets,notes} created for every organization
 *
 * Usage: tsx cazalla/scripts/migrate-vault.ts <vault> [--apply]
 * Without --apply the planned actions are printed and nothing is written.
 */
import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'

export type Action =
  | { kind: 'write'; file: string; content: string }
  | { kind: 'move'; from: string; to: string }
  | { kind: 'mkdir'; dir: string }

const FENCED = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

const readFields = (file: string): Record<string, unknown> | null => {
  const text = fs.readFileSync(file, 'utf8')
  const m = FENCED.exec(text)
  try {
    const value = YAML.parse(m ? m[1] : text)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch {
    return null
  }
}

const fenced = (fields: Record<string, unknown>): string =>
  `---\n${YAML.stringify(fields, { nullStr: '', lineWidth: 0 })}---\n`

const first = (v: unknown): unknown => (Array.isArray(v) ? (v[0] ?? null) : v)

const KINDS: [string, string][] = [
  ['companies', 'organizations'],
  ['people', 'people'],
  ['projects', 'projects']
]

/** Plans the migration of `root`. Pure apart from reading the vault. */
export const plan = (root: string): Action[] => {
  const actions: Action[] = []
  const srcRoot = path.join(root, 'Metadata')
  const dstRoot = path.join(root, '_metadata')
  const projectPaths: string[] = []
  const organizationSlugs: string[] = []

  for (const [from, to] of KINDS) {
    const srcDir = path.join(srcRoot, from)
    if (!fs.existsSync(srcDir)) continue
    actions.push({ kind: 'mkdir', dir: path.join(dstRoot, to) })
    for (const name of fs.readdirSync(srcDir).filter((n) => n.endsWith('.md'))) {
      const fields = readFields(path.join(srcDir, name))
      if (!fields) continue
      if (to === 'organizations') organizationSlugs.push(String(fields.slug ?? name.replace(/\.md$/, '')))
      if ('company' in fields) {
        fields.organization = first(fields.company)
        delete fields.company
      }
      if (to === 'projects' && typeof fields.path === 'string') {
        const rel = fields.path.replace(/^\/+|\/+$/g, '')
        fields.path = rel
        projectPaths.push(rel)
      }
      actions.push({ kind: 'write', file: path.join(dstRoot, to, name), content: fenced(fields) })
    }
  }

  for (const rel of projectPaths) {
    const dir = path.join(root, rel)
    const tasksOld = path.join(dir, 'Tasks')
    const tasks = path.join(dir, 'tasks')
    if (fs.existsSync(tasksOld) && !fs.existsSync(tasks)) actions.push({ kind: 'move', from: tasksOld, to: tasks })
    for (const sub of ['tasks', 'notes', 'assets', 'archived']) actions.push({ kind: 'mkdir', dir: path.join(dir, sub) })
    const archivedOld = path.join(fs.existsSync(tasksOld) ? tasksOld : tasks, 'archived')
    if (fs.existsSync(archivedOld)) {
      for (const name of fs.readdirSync(archivedOld)) {
        actions.push({ kind: 'move', from: path.join(tasks, 'archived', name), to: path.join(dir, 'archived', name) })
      }
    }
  }
  for (const slug of organizationSlugs) {
    for (const sub of ['assets', 'notes']) actions.push({ kind: 'mkdir', dir: path.join(root, 'organizations', slug, sub) })
  }
  return actions
}

export const apply = (actions: Action[]): void => {
  for (const a of actions) {
    if (a.kind === 'mkdir') fs.mkdirSync(a.dir, { recursive: true })
    else if (a.kind === 'write') {
      fs.mkdirSync(path.dirname(a.file), { recursive: true })
      fs.writeFileSync(a.file, a.content)
    } else {
      fs.mkdirSync(path.dirname(a.to), { recursive: true })
      fs.renameSync(a.from, a.to)
    }
  }
}

const describe = (a: Action): string =>
  a.kind === 'mkdir' ? `mkdir ${a.dir}` : a.kind === 'write' ? `write ${a.file}` : `move  ${a.from} → ${a.to}`

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)
if (isMain) {
  const [root, flag] = process.argv.slice(2)
  if (!root) {
    console.error('usage: migrate-vault.ts <vault> [--apply]')
    process.exit(2)
  }
  const actions = plan(path.resolve(root))
  actions.forEach((a) => console.log(describe(a)))
  if (flag === '--apply') {
    apply(actions)
    console.log(`applied ${actions.length} actions; remove ${path.join(root, 'Metadata')} by hand once verified`)
  } else {
    console.log(`${actions.length} actions planned; rerun with --apply to execute`)
  }
}
