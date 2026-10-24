import { describe, it, expect, vi, beforeEach } from 'vitest'

const files = vi.hoisted(() => new Map<string, string>())
const dirs = vi.hoisted(() => new Set<string>())
vi.hoisted(() => {
  const w = globalThis as unknown as Record<string, unknown>
  const win = (w.window ??= {}) as Record<string, unknown>
  win.path = { join: (...p: string[]) => p.join('/'), dirname: (p: string) => p.split('/').slice(0, -1).join('/'), sep: '/' }
  win.fileUtils = {
    pathExists: async(p: string) => files.has(p),
    ensureDir: async(p: string) => void dirs.add(p),
    outputFile: async(p: string, d: string) => void files.set(p, d),
    readdir: async(dir: string) => {
      const names = [...files.keys()].filter((p) => p.startsWith(dir + '/')).map((p) => p.slice(dir.length + 1)).filter((r) => !r.includes('/'))
      if (!names.length) throw new Error('ENOENT')
      return names
    }
  }
})

import { createSite } from '@cazalla/renderer/metadata/create'
import { createSubpage, createWebpage, parentPageFromMarkdown } from '@cazalla/renderer/sites/pages'
import { runEnv } from '@cazalla/renderer/sites/publish'
import type { Site } from '@cazalla/renderer/metadata/types'

const now = new Date(Date.UTC(2026, 8, 6, 15, 37, 24, 357))
const site: Site = { name: 'cazalla.net', slug: 'cazalla-net', siteUrl: 'https://www.cazalla.net', path: 'sites/cazalla-net', sshHost: 'www', sshPort: 22, sshUser: 'deploy', sshTargetDir: '/var/www/site', file: '' }

describe('sites', () => {
  beforeEach(() => {
    files.clear()
    dirs.clear()
  })

  it('writes the site record with hyphenated keys and scaffolds assets and pages', async() => {
    const file = await createSite('/vault', [], { name: 'cazalla.net', siteUrl: 'https://www.cazalla.net', sshHost: 'www' })
    expect(file).toBe('/vault/_metadata/sites/cazalla-net.md')
    expect(files.get(file)).toBe('---\nname: cazalla.net\nslug: cazalla-net\nsite-url: https://www.cazalla.net\npath: sites/cazalla-net\nssh-host: www\nssh-port: 22\nssh-user: deploy\nssh-target-dir: /var/www/site\n---\n')
    expect([...dirs].sort()).toEqual(['/vault/sites/cazalla-net/assets', '/vault/sites/cazalla-net/pages'])
  })

  it('creates pages ordered after their siblings and nested sub-pages', async() => {
    const first = await createWebpage('/vault', site, 'Home', now)
    expect(first).toBe('/vault/sites/cazalla-net/pages/home.md')
    expect(files.get(first)).toBe('---\ntitle: Home\nslug: home\ntags:\ndate: 2026-09-06T15:37:24.357Z\nmodified: 2026-09-06T15:37:24.357Z\ncategory: webpage\nstatus: draft\nproject: cazalla-net\norder: 0\npath: /\n---\n')
    const second = await createWebpage('/vault', site, 'About', now)
    expect(files.get(second)).toContain('order: 1\n')
    const parent = parentPageFromMarkdown(second, files.get(second)!)!
    const child = await createSubpage(parent, 'Team', now)
    expect(child).toBe('/vault/sites/cazalla-net/pages/about/team.md')
    expect(files.get(child)).toContain('path: /about\n')
    expect(files.get(child)).toContain('order: 0\n')
    expect(parentPageFromMarkdown('/x.md', '---\ncategory: task\n---\n')).toBeNull()
  })

  it('maps a site record to the Makefile environment', () => {
    expect(runEnv('/vault', site)).toEqual({
      SSH_HOST: 'www', SSH_PORT: '22', SSH_USER: 'deploy', SSH_TARGET_DIR: '/var/www/site', SITEURL: 'https://www.cazalla.net', INPUTDIR: '/vault/sites/cazalla-net/pages'
    })
  })
})
