// A task as indexed from its frontmatter. `file` is the absolute path.

export const TASK_STATUSES = ['continuous', 'new', 'pending', 'wip', 'done', 'archived'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

/** One day of effort: `{ '2026-10-22': 2.5 }` as written in the vault. */
export type EffortEntry = Record<string, number>

export interface TaskRecord {
  file: string
  title: string
  slug: string
  project: string | null
  // Position below the project's `tasks/` folder: `/` for a top-level task,
  // `/<parent-slug>` for a subtask.
  path: string
  status: TaskStatus
  // Absent means shown on the board; only an explicit `false` hides a task.
  kanban: boolean
  due: string | null
  effort: EffortEntry[]
  subtasks: string[]
  tags: string[]
  date: string | null
  modified: string | null
  archived: boolean
}

export const isTaskStatus = (v: unknown): v is TaskStatus =>
  typeof v === 'string' && (TASK_STATUSES as readonly string[]).includes(v)
