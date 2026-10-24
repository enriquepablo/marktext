// Records under `_metadata/`. Each is the frontmatter of one markdown file.
// `file` is the absolute path the record was read from.

export interface Person {
  name: string
  slug: string
  organization: string | null
  email: string | null
  phone: string | null
  file: string
}

export interface Organization {
  name: string
  slug: string
  leader: string | null
  phone: string | null
  // Present when the organization can invoice.
  price_hour: number | null
  invoice_number: string | null
  iban: string | null
  swift: string | null
  payment_details: string | null
  // Address lines, ours or the client's.
  invoice_details: string[]
  // Project slugs this organization pays for. Non-empty means it can be invoiced.
  billing: string[]
  file: string
}

export interface Project {
  name: string
  slug: string
  organization: string | null
  leader: string | null
  // Project folder relative to the content folder, no trailing slash.
  path: string
  file: string
}

export type MetadataKind = 'people' | 'organizations' | 'projects'

export const canInvoice = (org: Organization): boolean => !!org.iban
export const canBeInvoiced = (org: Organization): boolean => org.billing.length > 0
