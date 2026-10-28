import { describe, it, expect, vi } from 'vitest'
import { stampModified } from '@cazalla/renderer/editor/modified'
import { shouldStamp } from '@cazalla/renderer/editor/modifiedOnSave'

vi.mock('@/store/preferences', () => ({ usePreferencesStore: () => ({ sourceCode: false }) }))

const yaml = 'title: t\nmodified: 2026-10-22T15:06:42.215Z\ncategory: note'

const fakeMuya = (text: string, cursor: { start: number; end: number } | null = null, first = true) => {
  const content = {
    text,
    update: vi.fn(),
    getCursor: () => (cursor ? { start: { offset: cursor.start }, end: { offset: cursor.end } } : null),
    setCursor: vi.fn()
  }
  const muya = {
    flush: vi.fn(),
    editor: { scrollPage: { firstChild: first ? { blockName: 'frontmatter', firstContentInDescendant: () => content } : { blockName: 'paragraph' } } }
  }
  return { content, muya }
}

describe('stampModified', () => {
  it('rewrites the line in the block, re-renders and flushes', () => {
    const { content, muya } = fakeMuya(yaml)
    expect(stampModified(muya as never, 'X')).toBe(true)
    expect(content.text).toBe('title: t\nmodified: X\ncategory: note')
    expect(content.update).toHaveBeenCalled()
    expect(muya.flush).toHaveBeenCalled()
  })

  it('keeps a caret inside the block, shifted past the replaced line', () => {
    const { content, muya } = fakeMuya(yaml, { start: yaml.length, end: yaml.length })
    stampModified(muya as never, 'X')
    const shift = 'X'.length - '2026-10-22T15:06:42.215Z'.length
    expect(content.setCursor).toHaveBeenCalledWith(yaml.length + shift, yaml.length + shift, true)
    expect(content.update).not.toHaveBeenCalled()
  })

  it('does nothing without a frontmatter block or a modified line', () => {
    expect(stampModified(fakeMuya(yaml, null, false).muya as never, 'X')).toBe(false)
    const { content, muya } = fakeMuya('title: t')
    expect(stampModified(muya as never, 'X')).toBe(false)
    expect(content.text).toBe('title: t')
  })
})

describe('shouldStamp', () => {
  const doc = '---\nmodified: a\n---\nbody\n'
  it('stamps a dirty document never written in the session, not a clean one', () => {
    expect(shouldStamp(doc, undefined, false)).toBe(true)
    expect(shouldStamp(doc, undefined, true)).toBe(false)
  })
  it('stamps only when something besides the modified line changed', () => {
    expect(shouldStamp(doc, doc, false)).toBe(false)
    expect(shouldStamp('---\nmodified: b\n---\nbody\n', doc, false)).toBe(false)
    expect(shouldStamp('---\nmodified: b\n---\nbody!\n', doc, true)).toBe(true)
  })
})
