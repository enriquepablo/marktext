// Stamps the `modified` field of a document's frontmatter inside the live Muya
// block, so the editor shows the new value; see item 33 of the plan. The save
// paths call it through `modifiedOnSave.ts`, the fold's button directly.

import type { Muya } from '@muyajs/core'
import { isoNow } from '../core/time'

const MODIFIED_LINE = /^modified:.*$/m

interface ContentBlock {
  text: string
  update(): void
  getCursor(): { start: { offset: number }; end: { offset: number } } | null
  setCursor(start: number, end: number, update?: boolean): void
}

/** The content block of the frontmatter, when the document starts with one. */
const frontmatterContent = (muya: Muya): ContentBlock | null => {
  const first = muya.editor.scrollPage?.firstChild as
    | { blockName?: string; firstContentInDescendant?: () => ContentBlock | null }
    | null
    | undefined
  if (!first || first.blockName !== 'frontmatter') return null
  return first.firstContentInDescendant?.() ?? null
}

/**
 * Sets `modified` to now in the frontmatter block of the instance and pushes
 * the change through `json-change` at once. Returns false when the document has
 * no `modified:` line.
 */
export const stampModified = (muya: Muya, stamp = isoNow()): boolean => {
  const content = frontmatterContent(muya)
  if (!content) return false
  const old = content.text
  const m = MODIFIED_LINE.exec(old)
  if (!m) return false
  const line = `modified: ${stamp}`
  const next = old.slice(0, m.index) + line + old.slice(m.index + m[0].length)
  if (next === old) return true
  const cursor = content.getCursor()
  content.text = next
  if (cursor) {
    // Offsets after the replaced line shift by the change in length.
    const delta = line.length - m[0].length
    const shift = (offset: number): number => (offset > m.index + m[0].length ? offset + delta : offset)
    content.setCursor(shift(cursor.start.offset), shift(cursor.end.offset), true)
  } else {
    content.update()
  }
  muya.flush()
  return true
}
