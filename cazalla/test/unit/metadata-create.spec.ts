import { describe, it, expect, vi, beforeEach } from 'vitest'

const files = vi.hoisted(() => new Map<string, string>())

vi.hoisted(() => {
  const w = globalThis as unknown as Record<string, unknown>
  const win = (w.window ??= {}) as Record<string, unknown>
  win.path = { join: (...p: string[]) => p.join('/'), sep: '/' }
  win.fileUtils = {
    pathExists: async(p: string) => files.has(p),
    outputFile: async(p: string, d: string) => void files.set(p, d)
  }
})

import { CreateError, createOrganization, createPerson, metadataFile } from '@cazalla/renderer/metadata/create'

describe('metadata creation', () => {
  beforeEach(() => files.clear())

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
