import bus from '@/bus'
import { t } from '@/i18n'
import notice from '@/services/notification'
import { DIALOG_EVENT, type DialogSpec, type Option, type Values } from '../dialogs/types'
import { useContentFolder } from '../core/contentFolder'
import { CreateError, createOrganization, createPerson } from './create'
import { useMetadataStore } from './store'

const str = (v: unknown): string | null => (v === null || v === undefined ? null : String(v))

const failure = (err: unknown): string => {
  if (err instanceof CreateError) {
    return err.code === 'exists'
      ? t('cazalla.dialog.exists', { file: err.detail })
      : t('cazalla.dialog.duplicateSlug', { slug: err.detail })
  }
  return err instanceof Error ? err.message : String(err)
}

const afterCreate = async(file: string): Promise<void> => {
  await useMetadataStore().LOAD()
  notice.notify({ title: t('cazalla.dialog.created', { file }), type: 'primary', message: '' })
  window.electron.ipcRenderer.send('mt::open-file', file)
}

const open = (spec: DialogSpec): void => {
  if (!useContentFolder().value) {
    notice.notify({ title: spec.title, type: 'warning', message: t('cazalla.dialog.noContentFolder') })
    return
  }
  bus.emit(DIALOG_EVENT, spec)
}

const personOptions = (): Option[] =>
  useMetadataStore().peopleList.map((p) => ({ value: p.slug, label: p.name }))
const organizationOptions = (): Option[] =>
  useMetadataStore().organizationsList.map((o) => ({ value: o.slug, label: o.name }))
const projectOptions = (): Option[] =>
  useMetadataStore().projectsList.map((p) => ({ value: p.slug, label: p.name }))

export const openPersonDialog = (): void =>
  open({
    title: t('cazalla.person.title'),
    fields: [
      { key: 'name', label: t('cazalla.person.name'), type: 'text', required: true },
      { key: 'organization', label: t('cazalla.person.organization'), type: 'select', options: organizationOptions },
      { key: 'email', label: t('cazalla.person.email'), type: 'text' },
      { key: 'phone', label: t('cazalla.person.phone'), type: 'text' }
    ],
    submit: async(v: Values) => {
      const folder = useContentFolder().value
      if (!folder) return t('cazalla.dialog.noContentFolder')
      try {
        const file = await createPerson(folder, Object.keys(useMetadataStore().people), {
          name: String(v.name),
          organization: str(v.organization),
          email: str(v.email),
          phone: str(v.phone)
        })
        await afterCreate(file)
      } catch (err) {
        return failure(err)
      }
    }
  })

export const openOrganizationDialog = (): void =>
  open({
    title: t('cazalla.organization.title'),
    fields: [
      { key: 'name', label: t('cazalla.organization.name'), type: 'text', required: true },
      { key: 'leader', label: t('cazalla.organization.leader'), type: 'select', options: personOptions },
      { key: 'phone', label: t('cazalla.organization.phone'), type: 'text' },
      { key: 'canInvoice', label: t('cazalla.organization.canInvoice'), type: 'checkbox' },
      { key: 'price_hour', label: t('cazalla.organization.priceHour'), type: 'number', when: (v) => !!v.canInvoice },
      { key: 'invoice_number', label: t('cazalla.organization.invoiceNumber'), type: 'text', default: '0000', when: (v) => !!v.canInvoice },
      { key: 'iban', label: t('cazalla.organization.iban'), type: 'text', when: (v) => !!v.canInvoice },
      { key: 'swift', label: t('cazalla.organization.swift'), type: 'text', when: (v) => !!v.canInvoice },
      { key: 'payment_details', label: t('cazalla.organization.paymentDetails'), type: 'text', when: (v) => !!v.canInvoice },
      { key: 'canBeInvoiced', label: t('cazalla.organization.canBeInvoiced'), type: 'checkbox' },
      { key: 'billing', label: t('cazalla.organization.billing'), type: 'multiselect', options: projectOptions, when: (v) => !!v.canBeInvoiced },
      {
        key: 'invoice_details',
        label: t('cazalla.organization.invoiceDetails'),
        type: 'textarea',
        when: (v) => !!v.canInvoice || !!v.canBeInvoiced
      }
    ],
    submit: async(v: Values) => {
      const folder = useContentFolder().value
      if (!folder) return t('cazalla.dialog.noContentFolder')
      try {
        const file = await createOrganization(folder, Object.keys(useMetadataStore().organizations), {
          name: String(v.name),
          leader: str(v.leader),
          phone: str(v.phone),
          canInvoice: !!v.canInvoice,
          price_hour: typeof v.price_hour === 'number' ? v.price_hour : null,
          invoice_number: str(v.invoice_number),
          iban: str(v.iban),
          swift: str(v.swift),
          payment_details: str(v.payment_details),
          canBeInvoiced: !!v.canBeInvoiced,
          billing: Array.isArray(v.billing) ? v.billing.map(String) : [],
          invoice_details: str(v.invoice_details)
        })
        await afterCreate(file)
      } catch (err) {
        return failure(err)
      }
    }
  })
