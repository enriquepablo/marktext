import { describe, it, expect, vi } from 'vitest'

// The Excalidraw package's dev build does not load under vitest; only the export functions are used here.
vi.mock('@excalidraw/excalidraw', () => ({ exportToSvg: async() => ({ outerHTML: '<svg/>' }), restore: (scene: unknown) => scene }))

import { drawingImageRenderer, pathOfFileUrl } from '@cazalla/renderer/drawings/render'

describe('drawing image renderer', () => {
  it('accepts drawing sources, relative or as file URLs, and nothing else', () => {
    expect(drawingImageRenderer.test('../assets/My%20draw.excalidraw')).toBe(true)
    expect(drawingImageRenderer.test('file:///home/u/notes/a.excalidraw?mucache=3')).toBe(true)
    expect(drawingImageRenderer.test('../assets/a.excalidraw.md')).toBe(false)
    expect(drawingImageRenderer.test('../assets/a.png')).toBe(false)
  })

  it('turns the file URL back into a local path', () => {
    expect(pathOfFileUrl('file:///home/u/notes/My%20draw.excalidraw?mucache=3')).toBe('/home/u/notes/My draw.excalidraw')
    expect(pathOfFileUrl('file:///C:/Users/u/a.excalidraw')).toBe('C:/Users/u/a.excalidraw')
  })
})
