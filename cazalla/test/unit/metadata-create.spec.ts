import { describe, it, expect, vi, beforeEach } from 'vitest'

const files = vi.hoisted(() => new Map<string, string>())
const dirs = vi.hoisted(() => new Set<string>())

vi.hoisted(() => {
  const w = globalThis as unknown as Record<string, unknown>
  const win = (w.window ??= {}) as Record<string, unknown>
  win.path = { join: (...p: string[]) => p.join('/'), sep: '/' }
  win.fileUtils = {
    pathExists: async(p: string) => files.has(p),
    outputFile: async(p: string, d: string) => void files.set(p, d),
    ensureDir: async(p: string) => void dirs.add(p)
  }
})

import { CreateError, createOrganization, createPerson, createProject, metadataFile } from '@cazalla/renderer/metadata/create'

describe('metadata creation', () => {
  beforeEach(() => {
    files.clear()
    dirs.clear()
  })

  it('writes a person with the sample key order and bare nulls', async() => {
    const file = await createPerson('/vault', [], { name: ' Ana López ', organization: 'acme', email: '' })
    expect(file).toBe('/vault/_metadata/people/ana-lopez.md')
    expect(files.get(file)).toBe('---\nname: Ana López\nslug: ana-lopez\norganization: acme\nemail:\nphone:\n---\n')
  })

  it('refuses duplicate slugs and existing files', async() => {
    await expect(createPerson('/vault', ['ana-lopez'], { name: 'Ana López' })).rejects.toMatchObject({ code: 'duplicateSlug', detail: 'ana-lopez' })
    files.set(metadataFile('/vault', 'people', 'bob'), 'x')
    const err = await createPerson('/vault', [], { name: 'Bob' }).catch((e) => e)
    expect(err).toBeInstanceOf(CreateError)
    expect(err.code).toBe('exists')
  })

  it('writes only the organization groups that are enabled', async() => {
    const plain = await createOrganization('/vault', [], { name: 'Plain Co', leader: 'ana-lopez' })
    expect(files.get(plain)).toBe('---\nname: Plain Co\nslug: plain-co\nleader: ana-lopez\nphone:\n---\n')
    expect(dirs.has('/vault/organizations/plain-co/assets')).toBe(true)
    expect(dirs.has('/vault/organizations/plain-co/notes')).toBe(true)

    const us = await createOrganization('/vault', [], {
      name: 'cazalla.net',
      canInvoice: true,
      price_hour: 55,
      invoice_number: '0026',
      iban: 'ES62',
      swift: 'INGDESMMXXX',
      payment_details: '30 days',
      invoice_details: 'Line 1\n\nLine 2\n'
    })
    expect(us).toBe('/vault/_metadata/organizations/cazalla-net.md')
    expect(files.get(us)).toBe(
      '---\nname: cazalla.net\nslug: cazalla-net\nleader:\nphone:\nprice_hour: 55\ninvoice_number: "0026"\niban: ES62\nswift: INGDESMMXXX\npayment_details: 30 days\ninvoice_details:\n  - Line 1\n  - Line 2\n---\n'
    )

    const client = await createOrganization('/vault', [], { name: 'Acme', canBeInvoiced: true, billing: ['site'] })
    expect(files.get(client)).toBe('---\nname: Acme\nslug: acme\nleader:\nphone:\nbilling:\n  - site\ninvoice_details: []\n---\n')
  })
})

describe('project creation', () => {
  beforeEach(() => {
    files.clear()
    dirs.clear()
  })

  it('writes the record and scaffolds the folder with a default path', async() => {
    const file = await createProject('/vault', [], { name: 'Web Site', organization: 'acme', leader: 'ana-lopez', service: 'Development' })
    expect(file).toBe('/vault/_metadata/projects/web-site.md')
    expect(files.get(file)).toBe('---\nname: Web Site\nslug: web-site\norganization: acme\nleader: ana-lopez\nservice: Development\npath: projects/web-site\n---\n')
    expect([...dirs].sort()).toEqual(['/vault/projects/web-site/archived', '/vault/projects/web-site/assets', '/vault/projects/web-site/notes', '/vault/projects/web-site/tasks'])
  })

  it('normalizes an explicit path', async() => {
    const file = await createProject('/vault', [], { name: 'Ops', path: ' /work/ops/ ' })
    expect(files.get(file)).toContain('path: work/ops\n')
    expect(dirs.has('/vault/work/ops/tasks')).toBe(true)
  })
})
