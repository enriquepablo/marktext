import YAML, { isMap } from 'yaml'

export type Fields = Record<string, unknown>

// `---` fences on their own lines; the block may be the whole document.
const FENCED = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/

// Bare `key:` for null, as the vault files are written; no line folding.
const OUT = { nullStr: '', lineWidth: 0 }

/** Splits a document into its leading YAML block (without fences) and the rest. */
export const split = (markdown: string): { yaml: string | null; body: string } => {
  const m = FENCED.exec(markdown)
  if (!m) return { yaml: null, body: markdown }
  return { yaml: m[1], body: markdown.slice(m[0].length) }
}

// `effort: []` followed by hand-added `  - 2026-10-24: 3` lines is invalid YAML;
// the empty list marker is dropped so the items parse. The write path keeps `[]`.
const EMPTY_LIST_THEN_ITEMS = /^([^\s:#][^:\n]*):[ \t]*\[\][ \t]*\n(?=[ \t]+-[ \t])/gm
export const repair = (yaml: string): string => yaml.replace(EMPTY_LIST_THEN_ITEMS, '$1:\n')

const MODIFIED_LINE = /^modified:.*$/m

/** Rewrites the `modified:` line of a leading YAML block. Other input is returned as is. */
export const touchModified = (markdown: string, stamp: string): string => {
  const m = FENCED.exec(markdown)
  if (!m || !MODIFIED_LINE.test(m[1])) return markdown
  const yaml = m[1].replace(MODIFIED_LINE, `modified: ${stamp}`)
  return markdown.slice(0, 4) + yaml + markdown.slice(4 + m[1].length)
}

/** True when the two documents differ at most in the `modified:` line of their leading block. */
export const sameExceptModified = (a: string, b: string): boolean =>
  a === b || touchModified(a, '') === touchModified(b, '')

/** Frontmatter as an object, or null when there is no block or it is not a YAML map. */
export const parse = (markdown: string): Fields | null => {
  const { yaml } = split(markdown)
  if (yaml === null) return null
  try {
    const value = YAML.parse(repair(yaml))
    return value && typeof value === 'object' && !Array.isArray(value) ? (value as Fields) : null
  } catch {
    return null
  }
}

/** A document with the given fields as frontmatter followed by `body`. */
export const serialize = (fields: Fields, body = ''): string =>
  `---\n${YAML.stringify(fields, OUT)}---\n${body}`

/**
 * Sets the given keys in the leading YAML block and leaves everything else as
 * written, including key order and unrelated lines. A document without a block
 * gets one. A key set to `undefined` is removed.
 */
export const updateFields = (markdown: string, patch: Fields): string => {
  const { yaml, body } = split(markdown)
  if (yaml === null) return serialize(patch, markdown)
  const doc = YAML.parseDocument(repair(yaml))
  if (!isMap(doc.contents)) return markdown
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) doc.delete(key)
    else doc.set(key, value)
  }
  return `---\n${doc.toString(OUT)}---\n${body}`
}
