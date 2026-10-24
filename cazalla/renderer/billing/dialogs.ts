import bus from '@/bus'
import { t, getCurrentLanguage } from '@/i18n'
import notice from '@/services/notification'
import { DIALOG_EVENT, type DialogSpec, type FieldSpec, type Option, type Values } from '../dialogs/types'
import { useContentFolder } from '../core/contentFolder'
import { updateFields } from '../core/frontmatter'
import { ensureDir, exists, join, readText, writeBytes, writeText } from '../core/fs'
import { useMetadataStore } from '../metadata/store'
import { canBeInvoiced, canInvoice } from '../metadata/types'
import { useTaskStore } from '../tasks/store'
import { useEditorStore } from '@/store/editor'
import {
  buildInvoice,
  buildReport,
  invoiceFileName,
  nextInvoiceNumber,
  outputSegments,
  periodFrom,
  previousMonth,
  reportFileName
} from './data'
import { renderInvoicePdf } from './invoicePdf'
import { renderReportPdf } from './reportPdf'
import { useCazallaLayoutStore } from '../core/layout'

const open = (spec: DialogSpec): void => {
  if (!useContentFolder().value) {
    notice.notify({ title: spec.title, type: 'warning', message: t('cazalla.dialog.noContentFolder') })
    return
  }
  bus.emit(DIALOG_EVENT, spec)
}

// The index reads disk; a task edited in a tab but not saved would be reported stale.
const unsavedUnder = (contentFolder: string, relPaths: string[]): string[] => {
  const dirs = relPaths.map((p) => join(contentFolder, p) + window.path.sep)
  return useEditorStore()
    .tabs.filter((tab) => tab.pathname && !tab.isSaved && dirs.some((d) => tab.pathname!.startsWith(d)))
    .map((tab) => tab.pathname as string)
}

const periodFields = (): FieldSpec[] => {
  const { start, end } = previousMonth()
  return [
    { key: 'start', label: t('cazalla.billing.start'), type: 'date', required: true, default: start },
    { key: 'end', label: t('cazalla.billing.end'), type: 'date', required: true, default: end }
  ]
}

const writePdf = async(
  contentFolder: string,
  organizationSlug: string,
  period: ReturnType<typeof periodFrom>,
  name: string,
  bytes: Uint8Array
): Promise<string> => {
  const dir = join(contentFolder, ...outputSegments(organizationSlug, period))
  const file = join(dir, name)
  if (await exists(file)) throw new Error(t('cazalla.dialog.exists', { file }))
  await ensureDir(dir)
  await writeBytes(file, bytes)
  return file
}

const done = (title: string, file: string): void => {
  notice.notify({ title, type: 'primary', message: t('cazalla.billing.written', { file }) })
  useCazallaLayoutStore().OPEN_VIEWER('pdf', file)
}

export const openReportDialog = (): void =>
  open({
    title: t('cazalla.billing.reportTitle'),
    fields: [
      {
        key: 'project',
        label: t('cazalla.billing.project'),
        type: 'select',
        required: true,
        options: (): Option[] => useMetadataStore().projectsList.map((p) => ({ value: p.slug, label: p.name }))
      },
      ...periodFields()
    ],
    submit: async(v: Values) => {
      const folder = useContentFolder().value
      const project = useMetadataStore().projects[String(v.project)]
      if (!folder || !project) return t('cazalla.dialog.noProjects')
      const period = periodFrom(String(v.start), String(v.end))
      if (!project.organization) return t('cazalla.billing.noOrganization')
      const unsaved = unsavedUnder(folder, [project.path])
      if (unsaved.length) return t('cazalla.billing.unsaved', { files: unsaved.join('\n') })
      const taskStore = useTaskStore()
      await taskStore.LOAD()
      if (taskStore.byProject(project.slug).length === 0) return t('cazalla.billing.noTasks', { path: project.path })
      const report = buildReport(project, taskStore.list, period)
      if (report.tasks.length === 0) return t('cazalla.billing.noEffort')
      try {
        done(
          t('cazalla.billing.reportTitle'),
          await writePdf(folder, project.organization, period, reportFileName(project, period), await renderReportPdf(report))
        )
      } catch (err) {
        return err instanceof Error ? err.message : String(err)
      }
    }
  })

export const openInvoiceDialog = (): void => {
  const metadata = useMetadataStore()
  const issuers = metadata.organizationsList.filter(canInvoice)
  if (issuers.length === 0) {
    notice.notify({ title: t('cazalla.billing.invoiceTitle'), type: 'warning', message: t('cazalla.billing.noIssuer') })
    return
  }
  const fields: FieldSpec[] = [
    {
      key: 'client',
      label: t('cazalla.billing.client'),
      type: 'select',
      required: true,
      options: (): Option[] => metadata.organizationsList.filter(canBeInvoiced).map((o) => ({ value: o.slug, label: o.name }))
    },
    ...periodFields()
  ]
  // Only ask who issues when more than one organization can.
  if (issuers.length > 1) {
    fields.unshift({
      key: 'issuer',
      label: t('cazalla.billing.issuer'),
      type: 'select',
      required: true,
      options: (): Option[] => issuers.map((o) => ({ value: o.slug, label: o.name }))
    })
  }
  open({
    title: t('cazalla.billing.invoiceTitle'),
    fields,
    submit: async(v: Values) => {
      const folder = useContentFolder().value
      const client = metadata.organizations[String(v.client)]
      const issuer = issuers.length === 1 ? issuers[0] : metadata.organizations[String(v.issuer)]
      if (!folder || !client || !issuer) return t('cazalla.billing.noIssuer')
      const period = periodFrom(String(v.start), String(v.end))
      const unsaved = unsavedUnder(folder, client.billing.map((slug) => metadata.projects[slug]?.path).filter((p): p is string => !!p))
      if (unsaved.length) return t('cazalla.billing.unsaved', { files: unsaved.join('\n') })
      await useTaskStore().LOAD()
      const sequence = nextInvoiceNumber(issuer.invoice_number)
      const invoice = buildInvoice({
        client,
        issuer,
        projects: metadata.projects,
        tasks: useTaskStore().list,
        period,
        sequence,
        date: new Date(),
        locale: getCurrentLanguage()
      })
      if (invoice.services.length === 0) return t('cazalla.billing.noEffort')
      try {
        const file = await writePdf(folder, client.slug, period, invoiceFileName(client, period, sequence), await renderInvoicePdf(invoice))
        // The counter advances only once the PDF exists, so a failed write never skips a number.
        await writeText(issuer.file, updateFields(await readText(issuer.file), { invoice_number: sequence }))
        await metadata.LOAD()
        done(t('cazalla.billing.invoiceTitle'), file)
      } catch (err) {
        return err instanceof Error ? err.message : String(err)
      }
    }
  })
}
