/**
 * Draws `.excalidraw` files for image embeds in notes (plan-cazalla.net, item 32).
 * Muya hands over the resolved file URL of an embed whose source we accept; the
 * scene is restored and exported to SVG, returned as a data URL and cached by
 * modification time, so a drawing edited in the pane re-renders in the note.
 */
import { exportToSvg, restore } from '@excalidraw/excalidraw'
import type { IImageSourceRenderer } from '@muyajs/core'
import { readText } from '../core/fs'

const DRAWING_SRC = /\.excalidraw(?=\?|$)/i
const cache = new Map<string, { mtime: number; url: string }>()

/** Local path of a `file://` URL as Muya builds it; the query is dropped and a Windows drive loses its leading slash. */
export const pathOfFileUrl = (fileUrl: string): string => {
  const pathname = decodeURIComponent(new URL(fileUrl).pathname)
  return /^\/[a-z]:\//i.test(pathname) ? pathname.slice(1) : pathname
}

export const renderDrawing = async(file: string): Promise<string> => {
  const { mtimeMs } = await window.fileUtils.stat(file)
  const hit = cache.get(file)
  if (hit && hit.mtime === mtimeMs) return hit.url
  const raw = JSON.parse(await readText(file))
  const scene = restore({ elements: raw.elements ?? [], appState: raw.appState ?? {}, files: raw.files ?? {} }, null, null)
  const svg = await exportToSvg({
    elements: scene.elements,
    appState: { ...scene.appState, exportBackground: true, exportWithDarkMode: false },
    files: scene.files
  })
  const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg.outerHTML)}`
  cache.set(file, { mtime: mtimeMs, url })
  return url
}

export const drawingImageRenderer: IImageSourceRenderer = {
  test: (src) => DRAWING_SRC.test(src),
  render: (fileUrl) => renderDrawing(pathOfFileUrl(fileUrl))
}
