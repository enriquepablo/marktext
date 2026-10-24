import { serialize } from '../core/frontmatter'
import { ensureDir, exists, join, writeText } from '../core/fs'
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

export interface ProjectInput {
  name: string
  organization?: string | null
  leader?: string | null
  // Relative to the content folder; empty means `projects/<slug>`.
  path?: string | null
}

export const PROJECT_SUBDIRS = ['archived', 'assets', 'notes', 'tasks'] as const
export const ORGANIZATIONS_DIR = 'organizations'
export const ORGANIZATION_SUBDIRS = ['assets', 'notes'] as const

/** `<content folder>/organizations/<slug>`; derived from the slug, not stored. */
export const organizationDir = (contentFolder: string, slug: string): string => join(contentFolder, ORGANIZATIONS_DIR, slug)

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
export const createOrganization = async(
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
  const file = await writeRecord(contentFolder, 'organizations', knownSlugs, fields)
  for (const sub of ORGANIZATION_SUBDIRS) await ensureDir(join(organizationDir(contentFolder, String(fields.slug)), sub))
  return file
}

const normalizePath = (p: string | null | undefined, slug: string): string => {
  const trimmed = (p ?? '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '')
  return trimmed || `projects/${slug}`
}

/**
 * Writes `_metadata/projects/<slug>.md` and creates the project folder with
 * `archived/`, `notes/` and `tasks/`. Returns the metadata file path.
 */
export const createProject = async(
  contentFolder: string,
  knownSlugs: Iterable<string>,
  input: ProjectInput
): Promise<string> => {
  const slug = toSlug(input.name)
  const path = normalizePath(input.path, slug)
  const file = await writeRecord(contentFolder, 'projects', knownSlugs, {
    name: input.name.trim(),
    slug,
    organization: nullable(input.organization),
    leader: nullable(input.leader),
    path
  })
  for (const sub of PROJECT_SUBDIRS) await ensureDir(join(contentFolder, path, sub))
  return file
}
