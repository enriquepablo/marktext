import { describe, it, expect, vi, beforeEach } from 'vitest'

const files = vi.hoisted(() => new Map<string, string>())
await vi.hoisted(async() => {
  const w = globalThis as unknown as Record<string, unknown>
  const win = (w.window ??= {}) as Record<string, unknown>
  // The spec runs on posix paths; node's posix helpers stand in for the bridge.
  const { posix } = await import('node:path')
  win.path = { sep: '/', join: posix.join, dirname: posix.dirname, basename: posix.basename, resolve: posix.resolve, relative: posix.relative }
  const children = (dir: string): string[] =>
    [...new Set([...files.keys()].filter((p) => p.startsWith(dir + '/')).map((p) => p.slice(dir.length + 1).split('/')[0]))]
  win.fileUtils = {
    pathExists: async(p: string) => files.has(p) || children(p).length > 0,
    readFile: async(p: string) => files.get(p) ?? '',
    outputFile: async(p: string, d: string) => void files.set(p, d),
    ensureDir: async() => {},
    move: async(from: string, to: string) => {
      for (const [p, text] of [...files.entries()]) {
        if (p === from || p.startsWith(from + '/')) {
          files.delete(p)
          files.set(to + p.slice(from.length), text)
        }
      }
    },
    readdir: async(dir: string) => {
      const names = children(dir)
      if (!names.length) throw new Error('ENOENT')
      return names
    },
    stat: async(p: string) => ({ isFile: files.has(p), isDirectory: !files.has(p) && children(p).length > 0 })
  }
})

import { rewriteLinks, remapper } from '@cazalla/renderer/explorer/links'
import { moveEntry, MoveError } from '@cazalla/renderer/explorer/move'
import type { Project, Site } from '@cazalla/renderer/metadata/types'

const V = '/vault'
const site: Project = { name: 'Site', slug: 'site', organization: 'acme', leader: null, path: 'projects/site', file: `${V}/_metadata/projects/site.md` }
const ops: Project = { ...site, name: 'Ops', slug: 'ops', path: 'projects/ops', file: `${V}/_metadata/projects/ops.md` }
const web: Site = { name: 'Web', slug: 'web', siteUrl: null, path: 'sites/web', sshHost: null, sshPort: 22, sshUser: null, sshTargetDir: null, file: `${V}/_metadata/sites/web.md` }
const ctx = { contentFolder: V, projects: [site, ops], sites: [web] }

describe('rewriteLinks', () => {
  it('re-resolves relative targets and leaves external ones', () => {
    const remap = remapper('/v/a/old.md', '/v/b/old.md')
    const text = 'See [x](old.md#top), ![i](../img/p.png), [w](https://x.y/z), [a](#anchor), [[wiki]]'
    const { text: out, count } = rewriteLinks(text, '/v/a', '/v/a', remap)
    expect(out).toBe('See [x](../b/old.md#top), ![i](../img/p.png), [w](https://x.y/z), [a](#anchor), [[wiki]]')
    expect(count).toBe(1)
  })

  it('rewrites outgoing links of a moved document', () => {
    const remap = remapper('/v/a', '/v/c/a')
    const { text } = rewriteLinks('[s](sibling.md) [u](../up.md)', '/v/a', '/v/c/a', remap)
    expect(text).toBe('[s](sibling.md) [u](../../up.md)')
  })

  it('keeps percent-encoding when the original target was encoded', () => {
    const remap = remapper('/v/my file.md', '/v/dir/my file.md')
    const { text } = rewriteLinks('[f](my%20file.md)', '/v', '/v', remap)
    expect(text).toBe('[f](dir/my%20file.md)')
  })
})

describe('moveEntry', () => {
  beforeEach(() => {
    files.clear()
    files.set(site.file, '---\nname: Site\nslug: site\npath: projects/site\n---\n')
    files.set(ops.file, '---\nname: Ops\nslug: ops\npath: projects/ops\n---\n')
    files.set(`${V}/projects/site/tasks/parent.md`, '---\ntitle: parent\nslug: parent\ncategory: task\nproject: site\npath: /\nsubtasks:\n  - /parent/child\n---\n[child](parent/child.md)\n')
    files.set(`${V}/projects/site/tasks/parent/child.md`, '---\ntitle: child\nslug: child\ncategory: task\nproject: site\npath: /parent\nsubtasks: []\n---\n[up](../parent.md)\n')
    files.set(`${V}/projects/site/notes/n.md`, '---\ncategory: note\n---\n[task](../tasks/parent.md) ![d](../assets/d.png)\n')
    files.set(`${V}/projects/site/assets/d.png`, 'PNG')
    files.set(`${V}/projects/ops/tasks/other.md`, '---\ntitle: other\nslug: other\ncategory: task\nproject: ops\npath: /\nsubtasks: []\n---\n')
    files.set(web.file, '---\nname: Web\nslug: web\npath: sites/web\n---\n')
    files.set(`${V}/sites/web/pages/home.md`, '---\ntitle: Home\nslug: home\ncategory: webpage\nproject: web\npath: /\norder: 0\n---\n')
    files.set(`${V}/sites/web/pages/about.md`, '---\ntitle: About\nslug: about\ncategory: webpage\nproject: web\npath: /\norder: 1\n---\n')
  })

  it('moves a task into a plain subfolder: path follows', async() => {
    const to = `${V}/projects/ops/tasks/later/other.md`
    await moveEntry(`${V}/projects/ops/tasks/other.md`, to, ctx)
    expect(files.get(to)).toContain('path: /later\n')
    expect(files.get(to)).toContain('project: ops\n')
  })

  it('moves a webpage under another page: path follows, site kept', async() => {
    const to = `${V}/sites/web/pages/home/about.md`
    await moveEntry(`${V}/sites/web/pages/about.md`, to, ctx)
    expect(files.get(to)).toContain('path: /home\n')
    expect(files.get(to)).toContain('project: web\n')
    expect(files.get(`${V}/sites/web/pages/home.md`)).toContain('path: /\n')
  })

  it('moves a site folder: metadata path follows, page paths stay', async() => {
    const result = await moveEntry(`${V}/sites/web`, `${V}/www/web`, ctx)
    expect(files.get(web.file)).toContain('path: www/web\n')
    expect(files.get(`${V}/www/web/pages/about.md`)).toContain('path: /\n')
    expect(result.updatedFiles).toEqual([web.file])
  })

  it('moves a subtask out to another project: parent unlinked, project and path rewritten, links fixed', async() => {
    const from = `${V}/projects/site/tasks/parent/child.md`
    const to = `${V}/projects/ops/tasks/child.md`
    const result = await moveEntry(from, to, ctx)
    expect(result.to).toBe(to)
    expect(files.has(from)).toBe(false)
    const parent = files.get(`${V}/projects/site/tasks/parent.md`)!
    expect(parent).toContain('subtasks: []\n')
    expect(parent).toContain('[child](../../ops/tasks/child.md)')
    const child = files.get(to)!
    expect(child).toContain('project: ops\n')
    expect(child).toContain('path: /\n')
    expect(child).toContain('[up](../../site/tasks/parent.md)')
    expect(result.rewrittenLinks).toBe(2)
  })

  it('moves a task into another task folder and links it as a subtask', async() => {
    const from = `${V}/projects/ops/tasks/other.md`
    const to = `${V}/projects/site/tasks/parent/other.md`
    await moveEntry(from, to, ctx)
    expect(files.get(`${V}/projects/site/tasks/parent.md`)).toContain('subtasks:\n  - /parent/child\n  - /parent/other\n')
    const moved = files.get(to)!
    expect(moved).toContain('project: site\n')
    expect(moved).toContain('path: /parent\n')
  })

  it('moves a whole project folder: metadata path and every link follow', async() => {
    const result = await moveEntry(`${V}/projects/site`, `${V}/work/site`, ctx)
    expect(files.get(site.file)).toContain('path: work/site\n')
    expect(files.get(`${V}/work/site/notes/n.md`)).toContain('[task](../tasks/parent.md) ![d](../assets/d.png)')
    expect(files.get(`${V}/work/site/tasks/parent.md`)).toContain('[child](parent/child.md)')
    expect(result.updatedFiles).toContain(site.file)
    expect(result.rewrittenLinks).toBe(0)
  })

  it('refuses existing targets and moves into itself', async() => {
    await expect(moveEntry(`${V}/projects/ops/tasks/other.md`, `${V}/projects/site/notes/n.md`, ctx)).rejects.toBeInstanceOf(MoveError)
    await expect(moveEntry(`${V}/projects/site`, `${V}/projects/site/notes/site`, ctx)).rejects.toMatchObject({ code: 'into-self' })
  })
})

