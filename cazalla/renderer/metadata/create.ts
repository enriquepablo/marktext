import { serialize } from '../core/frontmatter'
import { exists, join, writeText } from '../core/fs'
import { slug as toSlug } from '../core/slug'
import { METADATA_DIR } from './store'
import type { MetadataKind } from './types'

export interface PersonInput {
  name: string
  organization?: string | null
  email?: string | null
  phone?: string | null
}

export interface OrganizationInput {
  name: string
  leader?: string | null
  phone?: string | null
  canInvoice?: boolean
  price_hour?: number | null
  invoice_number?: string | null
  iban?: string | null
  swift?: string | null
  payment_details?: string | null
  invoice_details?: string[] | string | null
  canBeInvoiced?: boolean
  billing?: string[] | null
}

export class CreateError extends Error {
  constructor(
    public readonly code: 'exists' | 'duplicateSlug',
    public readonly detail: string
  ) {
    super(`${code}: ${detail}`)
  }
}

const nullable = (v: unknown): string | null => (v === undefined || v === null || v === '' ? null : String(v))

const lines = (v: string[] | string | null | undefined): string[] =>
  Array.isArray(v) ? v.filter(Boolean) : typeof v === 'string' ? v.split('\n').map((s) => s.trim()).filter(Boolean) : []

export const metadataFile = (contentFolder: string, kind: MetadataKind, slug: string): string =>
  join(contentFolder, METADATA_DIR, kind, `${slug}.md`)

const writeRecord = async(
  contentFolder: string,
  kind: MetadataKind,
  knownSlugs: Iterable<string>,
  fields: Record<string, unknown>
): Promise<string> => {
  const slug = String(fields.slug)
  if ([...knownSlugs].includes(slug)) throw new CreateError('duplicateSlug', slug)
  const file = metadataFile(contentFolder, kind, slug)
  if (await exists(file)) throw new CreateError('exists', file)
  await writeText(file, serialize(fields))
  return file
}

/** Writes `_metadata/people/<slug>.md` and returns its path. */
export const createPerson = (contentFolder: string, knownSlugs: Iterable<string>, input: PersonInput): Promise<string> =>
  writeRecord(contentFolder, 'people', knownSlugs, {
    name: input.name.trim(),
    slug: toSlug(input.name),
    organization: nullable(input.organization),
    email: nullable(input.email),
    phone: nullable(input.phone)
  })

/** Writes `_metadata/organizations/<slug>.md` with the field groups the flags enable. */
export const createOrganization = (
  contentFolder: string,
  knownSlugs: Iterable<string>,
  input: OrganizationInput
): Promise<string> => {
  const fields: Record<string, unknown> = {
    name: input.name.trim(),
    slug: toSlug(input.name),
    leader: nullable(input.leader),
    phone: nullable(input.phone)
  }
  if (input.canInvoice) {
    Object.assign(fields, {
      price_hour: input.price_hour ?? null,
      invoice_number: nullable(input.invoice_number) ?? '0000',
      iban: nullable(input.iban),
      swift: nullable(input.swift),
      payment_details: nullable(input.payment_details)
    })
  }
  if (input.canBeInvoiced) fields.billing = input.billing ?? []
  if (input.canInvoice || input.canBeInvoiced) fields.invoice_details = lines(input.invoice_details)
  return writeRecord(contentFolder, 'organizations', knownSlugs, fields)
}
