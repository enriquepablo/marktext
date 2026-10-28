import { describe, it, expect } from 'vitest'
import { parse, sameExceptModified, serialize, split, touchModified, updateFields } from '@cazalla/renderer/core/frontmatter'

const note = `---
title: Some Note
slug: some-note
tags:
date: 2026-10-22T15:06:42.215Z
modified: 2026-10-22T15:06:42.215Z
category: note
project: site
---

Body line.
`

describe('frontmatter', () => {
  it('splits the block from the body', () => {
    const { yaml, body } = split(note)
    expect(yaml?.startsWith('title: Some Note')).toBe(true)
    expect(body).toBe('\nBody line.\n')
    expect(split('# plain\n')).toEqual({ yaml: null, body: '# plain\n' })
  })

  it('parses fields and tolerates bare nulls and dates', () => {
    const fields = parse(note)
    expect(fields?.title).toBe('Some Note')
    expect(fields?.tags).toBeNull()
    expect(fields?.date).toBe('2026-10-22T15:06:42.215Z')
    expect(parse('# plain\n')).toBeNull()
    expect(parse('---\n- a\n---\n')).toBeNull()
  })

  it('serializes in key order with bare nulls and empty lists', () => {
    const out = serialize({ name: 'Some Name', slug: 'some-name', email: null, tags: [] })
    expect(out).toBe('---\nname: Some Name\nslug: some-name\nemail:\ntags: []\n---\n')
  })

  it('quotes values that would otherwise change type', () => {
    expect(serialize({ title: 'a: b', n: '0026' })).toBe('---\ntitle: "a: b"\nn: "0026"\n---\n')
  })

  it('updates named keys and keeps order, other keys and the body', () => {
    const out = updateFields(note, { status: 'wip', modified: 'X', tags: undefined })
    expect(out).toBe(`---
title: Some Note
slug: some-note
date: 2026-10-22T15:06:42.215Z
modified: X
category: note
project: site
status: wip
---

Body line.
`)
  })

  it('appends to a list field', () => {
    const task = serialize({ title: 't', subtasks: [] }, 'x\n')
    const out = updateFields(task, { subtasks: ['/a/b'] })
    expect(out).toBe('---\ntitle: t\nsubtasks:\n  - /a/b\n---\nx\n')
  })

  it('repairs an empty list marker followed by hand-written items', () => {
    const task = '---\ntitle: t\neffort: []\n  - 2026-10-24: 3\n  - 2026-10-25: 1.5\nsubtasks: []\n---\n'
    expect(parse(task)?.effort).toEqual([{ '2026-10-24': 3 }, { '2026-10-25': 1.5 }])
    expect(parse(task)?.subtasks).toEqual([])
    expect(updateFields(task, { status: 'done' })).toContain('effort:\n  - 2026-10-24: 3\n  - 2026-10-25: 1.5\nsubtasks: []\nstatus: done\n')
  })

  it('adds a block to a document without one', () => {
    expect(updateFields('# plain\n', { category: 'note' })).toBe('---\ncategory: note\n---\n# plain\n')
  })

  it('touchModified rewrites only the modified line of the leading block', () => {
    const out = touchModified(note, 'X')
    expect(out).toContain('modified: X')
    expect(out.replace('modified: X', 'modified: 2026-10-22T15:06:42.215Z')).toBe(note)
    expect(touchModified('# No block\nmodified: a\n', 'X')).toBe('# No block\nmodified: a\n')
    expect(touchModified('---\ntitle: t\n---\nbody\n', 'X')).toBe('---\ntitle: t\n---\nbody\n')
  })

  it('sameExceptModified ignores the modified line and nothing else', () => {
    expect(sameExceptModified(note, touchModified(note, 'X'))).toBe(true)
    expect(sameExceptModified(note, note + 'more\n')).toBe(false)
    expect(sameExceptModified('a', 'a')).toBe(true)
  })
})
