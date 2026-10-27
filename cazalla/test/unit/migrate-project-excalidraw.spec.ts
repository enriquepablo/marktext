import { describe, it, expect } from 'vitest'
import LZString from 'lz-string'
import { mimeFor, parseObsidianDrawing, toExcalidraw } from '@cazalla/scripts/migrate-project/excalidraw'

const scene = { type: 'excalidraw', version: 2, elements: [{ id: 'a', type: 'rectangle' }, { id: 'b', type: 'image', fileId: 'f'.repeat(40) }], appState: { viewBackgroundColor: '#fff' }, files: {} }
const head = '---\n\nexcalidraw-plugin: parsed\ntags: [excalidraw]\n\n---\n==⚠ Switch to EXCALIDRAW VIEW ⚠==\n\n# Excalidraw Data\n## Text Elements\nhello ^abc\n## Embedded Files\n' + 'f'.repeat(40) + ': [[image_6.png]]\n\n' + 'e'.repeat(40) + ': [[missing.png|alias]]\n\n%%\n## Drawing\n'

describe('parseObsidianDrawing', () => {
  it('decodes a compressed-json block wrapped in lines', () => {
    const b64 = LZString.compressToBase64(JSON.stringify(scene))
    const wrapped = (b64.match(/.{1,40}/g) ?? []).join('\n\n')
    const d = parseObsidianDrawing(head + '```compressed-json\n' + wrapped + '\n```\n%%')
    expect(d?.scene.elements).toEqual(scene.elements)
    expect(d?.scene.appState).toEqual(scene.appState)
    expect(d?.embedded).toEqual([
      { id: 'f'.repeat(40), name: 'image_6.png' },
      { id: 'e'.repeat(40), name: 'missing.png' }
    ])
  })

  it('reads a plain json block and returns null without a block or with bad data', () => {
    expect(parseObsidianDrawing('# Drawing\n```json\n' + JSON.stringify(scene) + '\n```\n')?.scene.elements).toHaveLength(2)
    expect(parseObsidianDrawing('no drawing here')).toBeNull()
    expect(parseObsidianDrawing('```json\n{not json\n```')).toBeNull()
  })
})

describe('toExcalidraw', () => {
  it('fills files from embedded images and reports the missing ones', () => {
    const d = parseObsidianDrawing(head + '```json\n' + JSON.stringify(scene) + '\n```')
    if (!d) throw new Error('parse failed')
    const out = toExcalidraw(d, (name) => (name === 'image_6.png' ? 'data:image/png;base64,AAAA' : null))
    const doc = JSON.parse(out.json)
    expect(doc).toMatchObject({ type: 'excalidraw', version: 2, elements: scene.elements, appState: scene.appState })
    expect(doc.files).toEqual({ ['f'.repeat(40)]: { id: 'f'.repeat(40), mimeType: 'image/png', dataURL: 'data:image/png;base64,AAAA', created: 0 } })
    expect(out.missing).toEqual(['missing.png'])
    expect(mimeFor('x.JPG')).toBe('image/jpeg')
    expect(mimeFor('x.txt')).toBeNull()
  })
})
