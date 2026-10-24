import { describe, it, expect } from 'vitest'
import { PRIMARY, findNode, isValidTree, leaves, removeLeaf, setFile, setRatio, splitLeaf, type Leaf, type PaneNode } from '@cazalla/renderer/panes/tree'

const fileLeaf = (id: string, file = `/vault/${id}.md`): Leaf => ({ kind: 'file', id, file })

describe('pane tree', () => {
  it('splits the primary leaf and keeps it first', () => {
    const tree = splitLeaf(PRIMARY, 'primary', 'vertical', fileLeaf('a'))
    expect(tree.kind).toBe('split')
    if (tree.kind !== 'split') return
    expect(tree.direction).toBe('vertical')
    expect(tree.ratio).toBe(0.5)
    expect(tree.children[0]).toEqual(PRIMARY)
    expect(tree.children[1]).toEqual(fileLeaf('a'))
    expect(leaves(tree).map((l) => l.id)).toEqual(['primary', 'a'])
  })

  it('splits a nested file leaf', () => {
    let tree: PaneNode = splitLeaf(PRIMARY, 'primary', 'vertical', fileLeaf('a'))
    tree = splitLeaf(tree, 'a', 'horizontal', fileLeaf('b'))
    expect(leaves(tree).map((l) => l.id)).toEqual(['primary', 'a', 'b'])
    const inner = findNode(tree, 'b')
    expect(inner?.kind).toBe('file')
    expect(tree.kind === 'split' && tree.children[1].kind === 'split' && tree.children[1].direction).toBe('horizontal')
  })

  it('removes a leaf and collapses its split, never the primary', () => {
    let tree: PaneNode = splitLeaf(PRIMARY, 'primary', 'vertical', fileLeaf('a'))
    tree = splitLeaf(tree, 'a', 'horizontal', fileLeaf('b'))
    tree = removeLeaf(tree, 'a')
    expect(leaves(tree).map((l) => l.id)).toEqual(['primary', 'b'])
    expect(tree.kind === 'split' && tree.children[1]).toEqual(fileLeaf('b'))
    tree = removeLeaf(tree, 'b')
    expect(tree).toEqual(PRIMARY)
    expect(removeLeaf(PRIMARY, 'primary')).toEqual(PRIMARY)
  })

  it('changes a pane file and clamps ratios', () => {
    let tree: PaneNode = splitLeaf(PRIMARY, 'primary', 'vertical', fileLeaf('a'))
    tree = setFile(tree, 'a', '/vault/other.md')
    expect(findNode(tree, 'a')).toEqual({ kind: 'file', id: 'a', file: '/vault/other.md' })
    tree = setFile(tree, 'a', '/vault/doc.pdf', 'pdf')
    expect(findNode(tree, 'a')).toEqual({ kind: 'pdf', id: 'a', file: '/vault/doc.pdf' })
    expect(removeLeaf(tree, 'a')).toEqual(PRIMARY)
    const id = tree.id
    expect((setRatio(tree, id, 0.95) as { ratio: number }).ratio).toBe(0.9)
    expect((setRatio(tree, id, 0.02) as { ratio: number }).ratio).toBe(0.1)
    expect((setRatio(tree, id, 0.3) as { ratio: number }).ratio).toBe(0.3)
  })

  it('validates persisted trees', () => {
    expect(isValidTree(PRIMARY)).toBe(true)
    expect(isValidTree(splitLeaf(PRIMARY, 'primary', 'vertical', fileLeaf('a')))).toBe(true)
    expect(isValidTree(fileLeaf('a'))).toBe(false)
    expect(isValidTree({ kind: 'split', id: 's', direction: 'vertical', ratio: 0.5, children: [PRIMARY, PRIMARY] })).toBe(false)
    expect(isValidTree(null)).toBe(false)
    expect(isValidTree({ kind: 'file', id: 'x' })).toBe(false)
    expect(isValidTree(splitLeaf(PRIMARY, 'primary', 'vertical', { kind: 'pdf', id: 'p', file: '/v/a.pdf' }))).toBe(true)
    expect(isValidTree({ kind: 'video', id: 'v', file: '/v/a.mp4' })).toBe(false)
  })
})
