import { parse, split } from '../core/frontmatter'

/** One searchable document. `id` is the absolute file path. */
export interface SearchDoc {
  id: string
  title: string
  body: string
  tags: string
  category: string
  project: string
  // First characters of the body, shown under a result.
  excerpt: string
}

const EXCERPT = 300

const strip = (markdown: string): string =>
  markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

export const excerpt = (body: string): string => (body.length > EXCERPT ? body.slice(0, EXCERPT) + '…' : body)

const stem = (file: string): string => file.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? file

export const markdownDoc = (file: string, text: string): SearchDoc => {
  const fields = parse(text)
  const body = strip(split(text).body)
  const tags = Array.isArray(fields?.tags) ? fields!.tags.map(String).join(' ') : typeof fields?.tags === 'string' ? fields.tags : ''
  return {
    id: file,
    title: typeof fields?.title === 'string' && fields.title ? fields.title : stem(file),
    body,
    tags,
    category: typeof fields?.category === 'string' ? fields.category : 'markdown',
    project: typeof fields?.project === 'string' ? fields.project : '',
    excerpt: excerpt(body)
  }
}

/** Text elements of an Excalidraw scene. */
export const excalidrawDoc = (file: string, json: string): SearchDoc => {
  let body = ''
  try {
    const scene = JSON.parse(json) as { elements?: { type?: string; text?: string; isDeleted?: boolean }[] }
    body = (scene.elements ?? [])
      .filter((e) => e.type === 'text' && !e.isDeleted && e.text)
      .map((e) => e.text as string)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  } catch {
    /* not a scene */
  }
  return { id: file, title: stem(file), body, tags: '', category: 'drawing', project: '', excerpt: excerpt(body) }
}

export const pdfDoc = (file: string, text: string): SearchDoc => {
  const body = text.replace(/\s+/g, ' ').trim()
  return { id: file, title: stem(file), body, tags: '', category: 'pdf', project: '', excerpt: excerpt(body) }
}

export const isIndexable = (file: string): boolean => /\.(md|markdown|pdf|excalidraw)$/i.test(file)
