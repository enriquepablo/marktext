/**
 * Reading side of the project migration (plan-cazalla.net, item 27): walks the
 * vault, reads documents, indexes files by name as Obsidian resolves `[[Name]]`,
 * reads a project's Kanban board and finds its metadata record. Nothing here writes.
 */
import fs from 'node:fs'
import path from 'node:path'
import YAML from 'yaml'
import { parse, split, type Fields } from '../../renderer/core/frontmatter'

export type Doc = { rel: string; text: string; fields: Fields | null; body: string }

const SKIP = new Set(['.git', '.obsidian', '.trash'])

/** Every file below `root/dir` as a vault-relative posix path; hidden tool folders skipped. */
export const walk = (root: string, dir = ''): string[] =>
  fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    if (SKIP.has(e.name)) return []
    const rel = dir ? `${dir}/${e.name}` : e.name
    return e.isDirectory() ? walk(root, rel) : [rel]
  })

export const readDoc = (root: string, rel: string): Doc => {
  const text = fs.readFileSync(path.join(root, rel), 'utf8')
  return { rel, text, fields: parse(text), body: split(text).body }
}

/** A metadata record: YAML with `---` fences or, as the vault writes them, without. */
export const readRecord = (root: string, rel: string): Fields | null => {
  const text = fs.readFileSync(path.join(root, rel), 'utf8')
  const fenced = parse(text)
  if (fenced) return fenced
  try {
    const value: unknown = YAML.parse(text)
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Fields) : null
  } catch {
    return null
  }
}

/** Maps file names, stems (trimmed, as Obsidian matches them) and vault-relative paths to every file so named. */
export const indexByName = (files: string[]): Map<string, string[]> => {
  const index = new Map<string, string[]>()
  const add = (key: string, rel: string): void => void index.set(key, [...(index.get(key) ?? []), rel])
  for (const rel of files) {
    const base = path.posix.basename(rel)
    for (const key of new Set([base, base.trim(), rel])) add(key, rel)
    if (base.endsWith('.md')) for (const key of new Set([base.slice(0, -3).trim(), rel.slice(0, -3)])) add(key, rel)
  }
  return index
}

const COLUMN = /^## (\S+)/
const CARD = /^- \[[ xX]\] \[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]/

/** Card title (base name, trimmed) → status from an Obsidian Kanban board; `archive` maps to `archived`. */
export const kanbanStatuses = (text: string): Map<string, string> => {
  const out = new Map<string, string>()
  let status: string | null = null
  for (const line of split(text).body.split('\n')) {
    const column = COLUMN.exec(line)
    if (column) status = column[1] === 'archive' ? 'archived' : column[1]
    const card = CARD.exec(line)
    if (card && status) out.set(path.posix.basename(card[1]).trim(), status)
  }
  return out
}

/** A vault path without surrounding slashes; the stale `cazalla.net` spelling of the records maps to the folder name. */
export const vaultPath = (p: string): string => p.replace(/^\/+|\/+$/g, '').replace(/cazalla\.net/g, 'cazalla-net')

/** Every record under `Metadata/projects` that has a string `path`. */
export const projectRecords = (root: string): Fields[] => {
  const dir = path.join(root, 'Metadata', 'projects')
  if (!fs.existsSync(dir)) return []
  return fs
    .readdirSync(dir)
    .filter((n) => n.endsWith('.md'))
    .map((n) => readRecord(root, `Metadata/projects/${n}`))
    .filter((r): r is Fields => r !== null && typeof r.path === 'string')
}

/** The project record whose `path` names `rel`. */
export const findProject = (root: string, rel: string): Fields | null =>
  projectRecords(root).find((r) => vaultPath(r.path as string) === vaultPath(rel)) ?? null
