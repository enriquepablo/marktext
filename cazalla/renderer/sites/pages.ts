import { parse, serialize } from '../core/frontmatter'
import { dirname, ensureDir, exists, join, listDir } from '../core/fs'
import { slug as toSlug } from '../core/slug'
import { isoNow } from '../core/time'
import { writeText } from '../core/fs'
import type { Site } from '../metadata/types'
import { ExistsError } from '../tasks/create'

export const PAGES_DIR = 'pages'

/** Number of `.md` siblings in `dir`; a new page takes this as its `order`. */
export const siblingCount = async(dir: string): Promise<number> => (await listDir(dir)).filter((n) => n.endsWith('.md')).length

const pageFrontmatter = (title: string, slug: string, site: string, path: string, order: number, stamp: string): string =>
  serialize({
    title: title.trim(),
    slug,
    tags: null,
    date: stamp,
    modified: stamp,
    category: 'webpage',
    status: 'draft',
    project: site,
    order,
    path
  })

/** Writes `<site path>/pages/<slug>.md`, ordered after its siblings. */
export const createWebpage = async(contentFolder: string, site: Site, title: string, now: Date = new Date()): Promise<string> => {
  const dir = join(contentFolder, site.path, PAGES_DIR)
  const slug = toSlug(title)
  const file = join(dir, `${slug}.md`)
  if (await exists(file)) throw new ExistsError(file)
  await ensureDir(dir)
  await writeText(file, pageFrontmatter(title, slug, site.slug, '/', await siblingCount(dir), isoNow(now)))
  return file
}

export interface ParentPage {
  file: string
  slug: string
  path: string
  project: string | null
}

export const parentPageFromMarkdown = (file: string, markdown: string): ParentPage | null => {
  const f = parse(markdown)
  if (!f || f.category !== 'webpage') return null
  const stem = file.split(/[\\/]/).pop()?.replace(/\.md$/, '') ?? ''
  return {
    file,
    slug: typeof f.slug === 'string' && f.slug ? f.slug : stem,
    path: typeof f.path === 'string' && f.path ? f.path : '/',
    project: typeof f.project === 'string' && f.project ? f.project : null
  }
}

/**
 * Creates `<parent dir>/<parent slug>/<slug>.md` as a child page: same site,
 * `path` extended by the parent's slug, `order` after its siblings. Pelican
 * maps the folder to the URL `<parent>/<child>/`.
 */
export const createSubpage = async(parent: ParentPage, title: string, now: Date = new Date()): Promise<string> => {
  const dir = join(dirname(parent.file), parent.slug)
  const slug = toSlug(title)
  const file = join(dir, `${slug}.md`)
  if (await exists(file)) throw new ExistsError(file)
  await ensureDir(dir)
  const path = ('/' + [parent.path, parent.slug].join('/')).replace(/\/+/g, '/')
  await writeText(file, pageFrontmatter(title, slug, parent.project ?? '', path, await siblingCount(dir), isoNow(now)))
  return file
}
