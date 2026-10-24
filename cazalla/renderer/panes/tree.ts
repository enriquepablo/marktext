// The pane layout is a binary tree. Leaves are the upstream editor (`primary`,
// exactly one) or a file pane. Inner nodes split their two children.

export type Direction = 'horizontal' | 'vertical'

/** Leaf kinds that show a file: the markdown editor, the PDF viewer, the drawing board. */
export type FileLeafKind = 'file' | 'pdf' | 'drawing'
export const FILE_LEAF_KINDS: readonly FileLeafKind[] = ['file', 'pdf', 'drawing']
export type Leaf = { kind: 'primary'; id: 'primary' } | { kind: FileLeafKind; id: string; file: string }
export interface Split {
  kind: 'split'
  id: string
  // `horizontal`: children stacked top and bottom; `vertical`: side by side.
  direction: Direction
  // Share of the first child, between 0.1 and 0.9.
  ratio: number
  children: [PaneNode, PaneNode]
}
export type PaneNode = Leaf | Split

export const PRIMARY: Leaf = { kind: 'primary', id: 'primary' }

let counter = 0
export const nextId = (): string => `pane-${Date.now().toString(36)}-${(counter++).toString(36)}`

export const findNode = (tree: PaneNode, id: string): PaneNode | null => {
  if (tree.id === id) return tree
  if (tree.kind !== 'split') return null
  return findNode(tree.children[0], id) ?? findNode(tree.children[1], id)
}

export const leaves = (tree: PaneNode): Leaf[] =>
  tree.kind === 'split' ? [...leaves(tree.children[0]), ...leaves(tree.children[1])] : [tree]

const map = (tree: PaneNode, fn: (node: PaneNode) => PaneNode | null): PaneNode | null => {
  const mapped = fn(tree)
  if (mapped !== tree) return mapped
  if (tree.kind !== 'split') return tree
  const a = map(tree.children[0], fn)
  const b = map(tree.children[1], fn)
  if (a === tree.children[0] && b === tree.children[1]) return tree
  // A removed child collapses the split into the remaining one.
  if (!a) return b
  if (!b) return a
  return { ...tree, children: [a, b] }
}

/** Replaces leaf `id` with a split holding it and `newLeaf` after it. */
export const splitLeaf = (tree: PaneNode, id: string, direction: Direction, newLeaf: Leaf): PaneNode =>
  map(tree, (node) =>
    node.id === id && node.kind !== 'split'
      ? { kind: 'split', id: nextId(), direction, ratio: 0.5, children: [node, newLeaf] }
      : node
  ) ?? tree

/** Removes leaf `id`; the primary leaf cannot be removed. */
export const removeLeaf = (tree: PaneNode, id: string): PaneNode => {
  if (id === 'primary') return tree
  return map(tree, (node) => (node.id === id && node.kind !== 'split' && node.kind !== 'primary' ? null : node)) ?? tree
}

/** Points leaf `id` at another file, changing its kind when the file type differs. */
export const setFile = (tree: PaneNode, id: string, file: string, kind?: FileLeafKind): PaneNode =>
  map(tree, (node) =>
    node.id === id && node.kind !== 'split' && node.kind !== 'primary' ? { ...node, file, kind: kind ?? node.kind } : node
  ) ?? tree

export const setRatio = (tree: PaneNode, id: string, ratio: number): PaneNode =>
  map(tree, (node) =>
    node.id === id && node.kind === 'split' ? { ...node, ratio: Math.min(0.9, Math.max(0.1, ratio)) } : node
  ) ?? tree

/** Accepts a persisted tree only if it has exactly one primary leaf and valid file leaves. */
export const isValidTree = (value: unknown): value is PaneNode => {
  const check = (node: unknown): boolean => {
    if (!node || typeof node !== 'object') return false
    const n = node as Record<string, unknown>
    if (n.kind === 'primary') return n.id === 'primary'
    if ((FILE_LEAF_KINDS as readonly string[]).includes(String(n.kind))) return typeof n.id === 'string' && typeof n.file === 'string'
    if (n.kind === 'split') {
      return (
        typeof n.id === 'string' &&
        (n.direction === 'horizontal' || n.direction === 'vertical') &&
        typeof n.ratio === 'number' &&
        Array.isArray(n.children) &&
        n.children.length === 2 &&
        n.children.every(check)
      )
    }
    return false
  }
  return check(value) && leaves(value as PaneNode).filter((l) => l.kind === 'primary').length === 1
}
