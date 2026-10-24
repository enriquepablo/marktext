import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { apply, plan } from '@cazalla/scripts/migrate-vault'

let root: string
const write = (rel: string, text: string): void => {
  const p = path.join(root, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, text)
}

describe('migrate-vault', () => {
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-'))
    write('Metadata/companies/acme.md', 'name: Acme\nslug: acme\nleader: ana\nbilling:\n  - site\n')
    write('Metadata/people/ana.md', 'name: Ana\nslug: ana\ncompany:\n  - acme\nemail:\n')
    write('Metadata/projects/site.md', 'name: Site\nslug: site\ncompany: [acme]\npath: work/site/\n')
    write('work/site/Tasks/a.md', '---\ntitle: a\n---\n')
    write('work/site/Tasks/archived/old.md', '---\ntitle: old\n---\n')
  })
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

  it('plans fenced files, renamed keys and the project layout', () => {
    const actions = plan(root)
    const writes = actions.filter((a) => a.kind === 'write')
    expect(writes.map((a) => path.relative(root, a.file)).sort()).toEqual([
      '_metadata/organizations/acme.md',
      '_metadata/people/ana.md',
      '_metadata/projects/site.md'
    ])
    const ana = writes.find((a) => a.file.endsWith('ana.md'))!
    expect(ana.content).toBe('---\nname: Ana\nslug: ana\nemail:\norganization: acme\n---\n')
    const site = writes.find((a) => a.file.endsWith('site.md'))!
    expect(site.content).toContain('path: work/site\n')
    expect(site.content).toContain('organization: acme\n')
    const moves = actions.filter((a) => a.kind === 'move').map((a) => [path.relative(root, a.from), path.relative(root, a.to)])
    expect(moves).toEqual([
      ['work/site/Tasks', 'work/site/tasks'],
      ['work/site/tasks/archived/old.md', 'work/site/archived/old.md']
    ])
  })

  it('applies the plan without touching the source directory', () => {
    apply(plan(root))
    expect(fs.existsSync(path.join(root, '_metadata/organizations/acme.md'))).toBe(true)
    expect(fs.existsSync(path.join(root, 'work/site/tasks/a.md'))).toBe(true)
    expect(fs.existsSync(path.join(root, 'work/site/archived/old.md'))).toBe(true)
    expect(fs.existsSync(path.join(root, 'work/site/notes'))).toBe(true)
    expect(fs.existsSync(path.join(root, 'Metadata/companies/acme.md'))).toBe(true)
  })
})
