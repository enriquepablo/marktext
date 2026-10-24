import { describe, it, expect } from 'vitest'
import MiniSearch from 'minisearch'
import { excalidrawDoc, isIndexable, markdownDoc, pdfDoc } from '@cazalla/renderer/search/extract'
import { indexOptions, newIndex } from '@cazalla/renderer/search/indexOptions'

const note = '---\ntitle: Invoice Workflow\ntags:\n  - billing\n  - admin\ncategory: note\nproject: site\n---\n\n# Steps\n\nGenerate the **invoice** from [the report](report.md).\n\n```js\nconst hidden = 1\n```\n'

describe('search extraction', () => {
  it('turns markdown into a document with stripped body and excerpt', () => {
    const doc = markdownDoc('/v/notes/invoice-workflow.md', note)
    expect(doc.title).toBe('Invoice Workflow')
    expect(doc.tags).toBe('billing admin')
    expect(doc.category).toBe('note')
    expect(doc.project).toBe('site')
    expect(doc.body).toBe('Steps Generate the invoice from the report.')
    expect(doc.excerpt).toBe(doc.body)
  })

  it('falls back to the file stem and handles drawings and pdfs', () => {
    expect(markdownDoc('/v/plain.md', 'Just text').title).toBe('plain')
    const drawing = excalidrawDoc('/v/d.excalidraw', JSON.stringify({ elements: [{ type: 'text', text: 'Server' }, { type: 'rectangle' }, { type: 'text', text: 'DB', isDeleted: true }] }))
    expect(drawing.body).toBe('Server')
    expect(drawing.category).toBe('drawing')
    expect(pdfDoc('/v/a.pdf', 'Page  one\n\npage two').body).toBe('Page one page two')
    expect(isIndexable('/v/a.PDF')).toBe(true)
    expect(isIndexable('/v/a.png')).toBe(false)
  })
})

describe('search index', () => {
  it('finds documents with fuzzy and prefix matching, boosting titles, and survives a JSON round trip', () => {
    const index = newIndex()
    index.add(markdownDoc('/v/a.md', note))
    index.add(markdownDoc('/v/b.md', '---\ntitle: Random\n---\nThe invoices pile up.'))
    index.add(markdownDoc('/v/c.md', '---\ntitle: Nothing\n---\nUnrelated text.'))
    // One edit away from `invoice`; `invoices` needs two, so only the title match survives.
    expect(index.search('invoce').map((h) => h.id)).toEqual(['/v/a.md'])
    expect(index.search('inv').map((h) => h.id)).toEqual(['/v/a.md', '/v/b.md'])
    expect(index.search('invoice', { filter: (r) => r.category === 'markdown' }).map((h) => h.id)).toEqual(['/v/b.md'])

    const restored = MiniSearch.loadJSON(JSON.stringify(index.toJSON()), indexOptions)
    expect(restored.documentCount).toBe(3)
    expect(restored.search('billing')[0].title).toBe('Invoice Workflow')
  })
})
