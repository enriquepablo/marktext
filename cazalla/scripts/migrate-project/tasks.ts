/**
 * Task frontmatter rules of the project migration (plan-cazalla.net, item 27).
 * Pure: the caller decides location, slug and resolved subtasks; this module
 * only derives the fields to write and finds the checklist lines to lift.
 */
import type { Fields } from '../../renderer/core/frontmatter'
import { TASK_STATUSES } from '../../renderer/tasks/types'

export type TaskInput = {
  origin: Fields
  title: string
  slug: string
  project: string
  /** `/a/b`, computed from the file's location or from `archived-path`. */
  path: string
  archived: boolean
  /** Column of the card on the project's Kanban board, when there is one. */
  boardStatus?: string
  subtasks: string[]
  now: string
}

/** `/a/b/` or `a/b` → `/a/b`; empty → `/`. */
export const normalisePath = (p: string): string => '/' + p.split('/').filter(Boolean).join('/')

const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : [])
const known = (s: unknown): s is string => typeof s === 'string' && (TASK_STATUSES as readonly string[]).includes(s)

/** Fields in the order `tasks/create.ts` writes them, followed by the origin's other keys. */
export const taskFields = (i: TaskInput): Fields => {
  const { origin } = i
  const hasDue = origin.due != null && origin.due !== ''
  const hasStatus = (origin.status != null && origin.status !== '') || i.boardStatus != null
  const status = i.archived ? 'archived' : known(i.boardStatus) ? i.boardStatus : known(origin.status) ? origin.status : 'new'
  const head: Fields = {
    title: i.title,
    slug: i.slug,
    tags: list(origin.tags),
    date: origin.date ?? i.now,
    modified: origin.modified ?? i.now,
    category: 'task',
    project: i.project,
    path: normalisePath(i.path),
    status,
    kanban: !i.archived && (hasDue || hasStatus),
    due: hasDue ? origin.due : i.now,
    effort: list(origin.effort),
    subtasks: i.subtasks
  }
  const rest = Object.fromEntries(Object.entries(origin).filter(([k]) => !(k in head) && k !== 'archived-path'))
  return { ...head, ...rest }
}

const CHECK = /^\s*- \[[ xX]\] \[\[([^\]|#]+)(?:[#|][^\]]*)?\]\]\s*$/

/** Checklist lines that consist of one wiki link: line index and the link's target name. */
export const checklistLinks = (body: string): { line: number; target: string }[] =>
  body.split('\n').flatMap((text, line) => {
    const m = CHECK.exec(text)
    return m ? [{ line, target: (m[1].split('/').pop() ?? m[1]).trim() }] : []
  })

export const withoutLines = (body: string, lines: Set<number>): string =>
  body
    .split('\n')
    .filter((_, i) => !lines.has(i))
    .join('\n')
