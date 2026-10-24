import { describe, it, expect, vi } from 'vitest'
await vi.hoisted(async() => {
  const { posix } = await import('node:path')
  const w = globalThis as unknown as Record<string, unknown>
  const win = (w.window ??= {}) as Record<string, unknown>
  win.path = { sep: '/', relative: posix.relative }
})
import { replaceRange, type TextBlock } from '@cazalla/renderer/editor/registry'
import { formatInsert } from '@cazalla/renderer/dates/dialog'

const block = (text: string): TextBlock & { cursor: [number, number] } => {
  const b = {
    text,
    cursor: [0, 0] as [number, number],
    getCursor: () => ({ start: { offset: b.cursor[0] }, end: { offset: b.cursor[1] } }),
    setCursor: (s: number, e: number) => {
      b.cursor = [s, e]
    }
  }
  return b
}

describe('cursor insertion', () => {
  it('replaces a range and leaves the caret after the text', () => {
    const b = block('see [[] here')
    replaceRange({ block: b, start: 4, end: 7 }, '[Doc](doc.md)')
    expect(b.text).toBe('see [Doc](doc.md) here')
    expect(b.cursor).toEqual([17, 17])
  })

  it('inserts at a collapsed caret', () => {
    const b = block('Due ')
    replaceRange({ block: b, start: 4, end: 4 }, '2026-10-24 09:30')
    expect(b.text).toBe('Due 2026-10-24 09:30')
    expect(b.cursor).toEqual([20, 20])
  })

  it('formats the date dialog result', () => {
    expect(formatInsert('2026-10-24', '09:30', true)).toBe('2026-10-24 09:30')
    expect(formatInsert('2026-10-24', '09:30', false)).toBe('2026-10-24')
    expect(formatInsert('2026-10-24', null, true)).toBe('2026-10-24')
  })
})
