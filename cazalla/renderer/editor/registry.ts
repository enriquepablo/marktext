// Registry of live Muya instances: the upstream editor (`primary`) and the
// cazalla file panes. It gives features a way to insert text where the user
// is typing and to watch typed input, without each feature knowing the panes.

import type { Muya } from '@muyajs/core'
import { attachFrontmatterFold } from './frontmatterFold'

/** The subset of a Muya content block the helpers rely on. */
export interface TextBlock {
  text: string
  getCursor(): { start: { offset: number }; end: { offset: number } } | null
  setCursor(start: number, end: number, update?: boolean): void
}

export interface CursorPosition {
  block: TextBlock
  start: number
  end: number
}

export interface Registered {
  id: string
  muya: Muya
  // Folder of the document shown, for relative hrefs; null for untitled documents.
  dir: () => string | null
}

const instances = new Map<string, Registered>()
let primaryDir: () => string | null = () => (window.DIRNAME ? window.DIRNAME : null)
let focusedId = 'primary'

type TypedListener = (ctx: { registered: Registered; position: CursorPosition; text: string }) => void
const typedListeners: TypedListener[] = []

const attach = (registered: Registered): void => {
  instances.set(registered.id, registered)
  attachFrontmatterFold(registered)
  registered.muya.on('focus', () => {
    focusedId = registered.id
  })
  registered.muya.on('content-change', ({ block }: { block: TextBlock }) => {
    const cursor = block.getCursor()
    if (!cursor) return
    const position = { block, start: cursor.start.offset, end: cursor.end.offset }
    for (const listener of typedListeners) listener({ registered, position, text: block.text })
  })
}

/** Called by the upstream editor hook when its instance is created or destroyed. */
export const setPrimaryMuya = (muya: Muya | null): void => {
  if (muya) attach({ id: 'primary', muya, dir: primaryDir })
  else instances.delete('primary')
}

export const setPrimaryDirResolver = (resolver: () => string | null): void => {
  primaryDir = resolver
}

export const registerPaneMuya = (id: string, muya: Muya, dir: () => string | null): void => attach({ id, muya, dir })
export const unregisterPaneMuya = (id: string): void => {
  instances.delete(id)
  if (focusedId === id) focusedId = 'primary'
}

/** The instance that last had focus, falling back to the primary editor. */
export const activeInstance = (): Registered | null => instances.get(focusedId) ?? instances.get('primary') ?? null

/** Current cursor of an instance, when it is collapsed inside one block. */
export const cursorOf = (muya: Muya): CursorPosition | null => {
  const sel = muya.getSelection()
  if (!sel || !sel.isSelectionInSameBlock) return null
  const block = sel.anchor.block as unknown as TextBlock
  const a = sel.anchor.offset
  const b = sel.focus.offset
  return { block, start: Math.min(a, b), end: Math.max(a, b) }
}

/** Replaces `[start, end)` of the block with `text` and puts the caret after it. */
export const replaceRange = (position: CursorPosition, text: string): void => {
  const { block, start, end } = position
  block.text = block.text.slice(0, start) + text + block.text.slice(end)
  block.setCursor(start + text.length, start + text.length, true)
}

/** Inserts at the caret of the active instance. Returns false when there is no caret. */
export const insertAtCursor = (text: string): boolean => {
  const active = activeInstance()
  const position = active ? cursorOf(active.muya) : null
  if (!position) return false
  replaceRange(position, text)
  active?.muya.focus()
  return true
}

/** Notifies on every keystroke-driven content change of any instance. */
export const onTyped = (listener: TypedListener): void => {
  typedListeners.push(listener)
}
