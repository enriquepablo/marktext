import { describe, it, expect } from 'vitest'
import {
  buildInvoice,
  buildReport,
  effortInPeriod,
  invoiceFileName,
  nextInvoiceNumber,
  outputSegments,
  periodFrom,
  previousMonth,
  reportFileName
} from '@cazalla/renderer/billing/data'
import { renderReportPdf } from '@cazalla/renderer/billing/reportPdf'
import { renderInvoicePdf } from '@cazalla/renderer/billing/invoicePdf'
import type { Organization, Project } from '@cazalla/renderer/metadata/types'
import type { TaskRecord } from '@cazalla/renderer/tasks/types'

const project: Project = { name: 'Web site', slug: 'site', organization: 'acme', leader: null, service: 'Development', path: 'projects/site', file: '' }
const other: Project = { ...project, name: 'Ops', slug: 'ops', service: 'Operations' }
const task = (slug: string, projectSlug: string, effort: Record<string, number>[]): TaskRecord => ({
  file: `/vault/projects/${projectSlug}/tasks/${slug}.md`, title: slug.toUpperCase(), slug, project: projectSlug, path: '/', status: 'done', kanban: true,
  due: null, effort, subtasks: [], tags: [], date: null, modified: null, archived: false
})
const tasks = [
  task('b', 'site', [{ '2026-09-15': 3 }, { '2026-10-01': 1 }]),
  task('a', 'site', [{ '2026-09-02': 2.5 }, { '2026-09-30': 4 }]),
  task('x', 'ops', [{ '2026-09-10': 8 }]),
  task('none', 'site', [{ '2026-08-31': 5 }])
]
const period = periodFrom('2026-09-01', '2026-09-30')

const issuer: Organization = {
  name: 'cazalla.net', slug: 'cazalla-net', leader: null, phone: null, price_hour: 55, invoice_number: '0026', iban: 'ES62 0000', swift: 'INGDESMMXXX',
  payment_details: '30 days', invoice_details: ['cazalla.net', 'Calle 1'], billing: [], file: '/vault/_metadata/organizations/us.md'
}
const client: Organization = { ...issuer, name: 'Acme', slug: 'acme', iban: null, price_hour: null, invoice_details: ['Acme Inc', 'Main St'], billing: ['site', 'ops', 'missing'] }

describe('billing data', () => {
  it('builds inclusive periods and the previous month', () => {
    expect(period.end.getHours()).toBe(23)
    expect(previousMonth(new Date(2026, 9, 24))).toEqual({ start: '2026-09-01', end: '2026-09-30' })
    expect(previousMonth(new Date(2026, 0, 5))).toEqual({ start: '2025-12-01', end: '2025-12-31' })
  })

  it('filters and sorts effort inside the period', () => {
    expect(effortInPeriod(tasks[1], period)).toEqual([{ date: '2026-09-02', hours: 2.5 }, { date: '2026-09-30', hours: 4 }])
    expect(effortInPeriod(tasks[3], period)).toEqual([])
  })

  it('builds a report ordered by first effort with the total', () => {
    const report = buildReport(project, tasks, period)
    expect(report.project).toBe('Web site')
    expect(report.startDate).toBe('2026-09-01')
    expect(report.tasks.map((t) => t.title)).toEqual(['A', 'B'])
    expect(report.totalHours).toBe(9.5)
  })

  it('builds an invoice with one line per billed project that has hours', () => {
    const invoice = buildInvoice({ client, issuer, projects: { site: project, ops: other }, tasks, period, sequence: '0027', date: new Date(2026, 9, 24), locale: 'en' })
    expect(invoice.invoiceNumber).toBe('20260027')
    expect(invoice.date).toBe('2026-10-24')
    expect(invoice.services).toEqual([
      { description: 'Development September 2026', quantity: 9.5, price: 55, vat: 0 },
      { description: 'Operations September 2026', quantity: 8, price: 55, vat: 0 }
    ])
    expect(invoice.total).toBe(17.5 * 55)
    expect(invoice.bankAccount).toBe('ES62 0000')
    expect(invoice.clientDetails).toEqual(['Acme Inc', 'Main St'])
  })

  it('numbers and names files', () => {
    expect(nextInvoiceNumber('0026')).toBe('0027')
    expect(nextInvoiceNumber(null)).toBe('0001')
    expect(outputSegments('acme', period)).toEqual(['organizations', 'acme', 'assets', 'invoices', '2026', '09'])
    expect(reportFileName(project, period)).toBe('report-site-2026-09.pdf')
    expect(invoiceFileName(client, period, '0027')).toBe('invoice-acme-2026-09-0027.pdf')
  })

  it('renders both PDFs', async() => {
    const report = await renderReportPdf(buildReport(project, tasks, period))
    const invoice = await renderInvoicePdf(buildInvoice({ client, issuer, projects: { site: project, ops: other }, tasks, period, sequence: '0027', date: new Date() }))
    const head = (b: Uint8Array): string => String.fromCharCode(...b.slice(0, 5))
    expect(head(report)).toBe('%PDF-')
    expect(head(invoice)).toBe('%PDF-')
    expect(invoice.length).toBeGreaterThan(1000)
  })
})
