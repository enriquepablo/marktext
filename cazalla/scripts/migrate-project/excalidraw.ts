/**
 * Obsidian's Excalidraw plugin stores a drawing as markdown: a `## Drawing`
 * section with the scene JSON in a fenced block, `compressed-json` (LZ-string,
 * base64, wrapped in lines) in newer files or plain `json` in older ones, and a
 * `## Embedded Files` section mapping a file id to a `[[image.png]]` kept beside
 * the drawing. This module turns that into the `.excalidraw` JSON the app opens.
 */
import LZString from 'lz-string'

export interface Scene {
  elements: unknown[]
  appState: Record<string, unknown>
  files: Record<string, unknown>
}

export interface ObsidianDrawing {
  scene: Scene
  /** Images the scene refers to by id, by vault file name. */
  embedded: { id: string; name: string }[]
}

const BLOCK = /```(compressed-json|json)\r?\n([\s\S]*?)\r?\n```/
const EMBEDDED = /^([0-9a-f]{40}): \[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]/gm
const MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', svg: 'image/svg+xml', webp: 'image/webp' }

/** The scene and the embedded file list of an Obsidian drawing, or null when the file holds no scene. */
export const parseObsidianDrawing = (text: string): ObsidianDrawing | null => {
  const m = BLOCK.exec(text)
  if (!m) return null
  const json = m[1] === 'json' ? m[2] : LZString.decompressFromBase64(m[2].replace(/\s+/g, ''))
  if (!json) return null
  let raw: unknown
  try {
    raw = JSON.parse(json)
  } catch {
    return null
  }
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Partial<Scene>
  const embedded = [...text.matchAll(EMBEDDED)].map(([, id, name]) => ({ id, name: name.trim() }))
  return { scene: { elements: Array.isArray(r.elements) ? r.elements : [], appState: r.appState ?? {}, files: r.files ?? {} }, embedded }
}

export const mimeFor = (name: string): string | null => MIME[name.split('.').pop()?.toLowerCase() ?? ''] ?? null

/**
 * The `.excalidraw` document for a parsed drawing. `dataUrl` returns the data
 * URL of an embedded file by name, or null when it is missing; missing names
 * are returned so the caller can report them.
 */
export const toExcalidraw = (drawing: ObsidianDrawing, dataUrl: (name: string) => string | null): { json: string; missing: string[] } => {
  const files: Record<string, unknown> = { ...drawing.scene.files }
  const missing: string[] = []
  for (const { id, name } of drawing.embedded) {
    const mimeType = mimeFor(name)
    const url = mimeType ? dataUrl(name) : null
    if (!url) missing.push(name)
    else files[id] = { id, mimeType, dataURL: url, created: 0 }
  }
  const doc = { type: 'excalidraw', version: 2, source: 'marktext-cazalla', elements: drawing.scene.elements, appState: drawing.scene.appState, files }
  return { json: JSON.stringify(doc) + '\n', missing }
}
