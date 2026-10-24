import { dateKey } from '../core/time'
import type { Organization, Project } from '../metadata/types'
import type { TaskRecord } from '../tasks/types'

export const CURRENCY = 'EUR'
export const VAT_RATE = 0
export const INVOICES_DIR = '_invoices'

export interface Period {
  // Local calendar days, both inclusive.
  start: Date
  end: Date
}

export interface EffortLine {
  date: string
  hours: number
}

export interface ReportTask {
  title: string
  effort: EffortLine[]
}

export interface ReportData {
  project: string
  startDate: string
  endDate: string
  tasks: ReportTask[]
  totalHours: number
}

export interface InvoiceService {
  description: string
  quantity: number
  price: number
  vat: number
}

export interface InvoiceData {
  invoiceNumber: string
  date: string
  companyDetails: string[]
  clientDetails: string[]
  services: InvoiceService[]
  vatBasis: number
  vatRate: number
  total: number
  currency: string
  paymentTerms: string
  bankAccount: string
  swift: string
}

const pad = (n: number): string => String(n).padStart(2, '0')

/** Inclusive period from two `YYYY-MM-DD` keys; the end runs to the last millisecond of its day. */
export const periodFrom = (startKey: string, endKey: string): Period => {
  const [sy, sm, sd] = startKey.split('-').map(Number)
  const [ey, em, ed] = endKey.split('-').map(Number)
  return { start: new Date(sy, sm - 1, sd), end: new Date(ey, em - 1, ed, 23, 59, 59, 999) }
}

/** First and last day of the month before `now`, as `YYYY-MM-DD`. */
export const previousMonth = (now: Date = new Date()): { start: string; end: string } => {
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const last = new Date(now.getFullYear(), now.getMonth(), 0)
  return { start: dateKey(first), end: dateKey(last) }
}

const inPeriod = (key: string, period: Period): boolean => {
  const [y, m, d] = key.split('-').map(Number)
  if (!y || !m || !d) return false
  const t = new Date(y, m - 1, d).getTime()
  return t >= period.start.getTime() && t <= period.end.getTime()
}

/** Effort lines of one task inside the period, oldest first. */
export const effortInPeriod = (task: TaskRecord, period: Period): EffortLine[] => {
  const lines: EffortLine[] = []
  for (const entry of task.effort) {
    for (const [date, hours] of Object.entries(entry)) {
      if (inPeriod(date, period)) lines.push({ date, hours })
    }
  }
  return lines.sort((a, b) => a.date.localeCompare(b.date))
}

export const buildReport = (project: Project, tasks: TaskRecord[], period: Period): ReportData => {
  const reportTasks: ReportTask[] = []
  let totalHours = 0
  for (const task of tasks) {
    if (task.project !== project.slug) continue
    const effort = effortInPeriod(task, period)
    if (effort.length === 0) continue
    totalHours += effort.reduce((sum, e) => sum + e.hours, 0)
    reportTasks.push({ title: task.title, effort })
  }
  reportTasks.sort((a, b) => a.effort[0].date.localeCompare(b.effort[0].date))
  return { project: project.name, startDate: dateKey(period.start), endDate: dateKey(period.end), tasks: reportTasks, totalHours }
}

/** Zero-padded running number, as stored in the issuer's `invoice_number`. */
export const nextInvoiceNumber = (current: string | null): string => pad(Number.parseInt(current ?? '0', 10) + 1).padStart(4, '0')

export const monthLabel = (period: Period, locale = 'en'): string =>
  new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(period.start)

export interface InvoiceInput {
  client: Organization
  issuer: Organization
  projects: Record<string, Project>
  tasks: TaskRecord[]
  period: Period
  // Four digits; the full number is `<year><nnnn>`.
  sequence: string
  date: Date
  locale?: string
}

/** One service line per billed project with hours in the period; projects without hours are left out. */
export const buildInvoice = (input: InvoiceInput): InvoiceData => {
  const { client, issuer, projects, tasks, period } = input
  const label = monthLabel(period, input.locale)
  const services: InvoiceService[] = []
  for (const slug of client.billing) {
    const project = projects[slug]
    if (!project) continue
    const hours = tasks
      .filter((t) => t.project === slug)
      .flatMap((t) => effortInPeriod(t, period))
      .reduce((sum, e) => sum + e.hours, 0)
    if (hours > 0) {
      services.push({ description: `${project.service ?? project.name} ${label}`, quantity: hours, price: issuer.price_hour ?? 0, vat: VAT_RATE })
    }
  }
  const total = services.reduce((sum, s) => sum + s.quantity * s.price * (1 + s.vat / 100), 0)
  return {
    invoiceNumber: `${period.start.getFullYear()}${input.sequence}`,
    date: dateKey(input.date),
    companyDetails: issuer.invoice_details,
    clientDetails: client.invoice_details,
    services,
    vatBasis: total,
    vatRate: VAT_RATE,
    total,
    currency: CURRENCY,
    paymentTerms: issuer.payment_details ?? '',
    bankAccount: issuer.iban ?? '',
    swift: issuer.swift ?? ''
  }
}

/** `_invoices/YYYY/MM` segments for a period. */
export const outputSegments = (period: Period): string[] => [INVOICES_DIR, String(period.start.getFullYear()), pad(period.start.getMonth() + 1)]

export const reportFileName = (project: Project, period: Period): string =>
  `report-${project.slug}-${period.start.getFullYear()}-${pad(period.start.getMonth() + 1)}.pdf`

export const invoiceFileName = (client: Organization, period: Period, sequence: string): string =>
  `invoice-${client.slug}-${period.start.getFullYear()}-${pad(period.start.getMonth() + 1)}-${sequence}.pdf`
