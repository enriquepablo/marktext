import bus from '@/bus'
import { t } from '@/i18n'
import notice from '@/services/notification'
import { DIALOG_EVENT, type DialogSpec, type Option, type Values } from '../dialogs/types'
import { useContentFolder } from '../core/contentFolder'
import { CreateError, createSite } from '../metadata/create'
import { useMetadataStore } from '../metadata/store'
import { ExistsError } from '../tasks/create'
import { createWebpage } from './pages'

export const PUBLISH_DIALOG_EVENT = 'cazalla:publish-site'

const str = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v))

const failure = (err: unknown): string => {
  if (err instanceof CreateError) {
    return err.code === 'exists' ? t('cazalla.dialog.exists', { file: err.detail }) : t('cazalla.dialog.duplicateSlug', { slug: err.detail })
  }
  if (err instanceof ExistsError) return t('cazalla.dialog.exists', { file: err.file })
  return err instanceof Error ? err.message : String(err)
}

const guard = (title: string, needSites: boolean): boolean => {
  if (!useContentFolder().value) {
    notice.notify({ title, type: 'warning', message: t('cazalla.dialog.noContentFolder') })
    return false
  }
  if (needSites && useMetadataStore().sitesList.length === 0) {
    notice.notify({ title, type: 'warning', message: t('cazalla.sites.noSites') })
    return false
  }
  return true
}

const afterCreate = async(file: string): Promise<void> => {
  await useMetadataStore().LOAD()
  notice.notify({ title: t('cazalla.dialog.created', { file }), type: 'primary', message: '' })
  window.electron.ipcRenderer.send('mt::open-file', file)
}

export const openSiteDialog = (): void => {
  const title = t('cazalla.sites.newSite')
  if (!guard(title, false)) return
  const spec: DialogSpec = {
    title,
    fields: [
      { key: 'name', label: t('cazalla.sites.name'), type: 'text', required: true },
      { key: 'siteUrl', label: t('cazalla.sites.siteUrl'), type: 'text', placeholder: 'https://' },
      { key: 'path', label: t('cazalla.sites.path'), type: 'text', placeholder: 'sites/<slug>' },
      { key: 'sshHost', label: t('cazalla.sites.sshHost'), type: 'text' },
      { key: 'sshPort', label: t('cazalla.sites.sshPort'), type: 'number', default: 22 },
      { key: 'sshUser', label: t('cazalla.sites.sshUser'), type: 'text', default: 'deploy' },
      { key: 'sshTargetDir', label: t('cazalla.sites.sshTargetDir'), type: 'text', default: '/var/www/site' }
    ],
    submit: async(v: Values) => {
      const folder = useContentFolder().value
      if (!folder) return t('cazalla.dialog.noContentFolder')
      try {
        await afterCreate(
          await createSite(folder, Object.keys(useMetadataStore().sites), {
            name: String(v.name),
            siteUrl: str(v.siteUrl),
            path: str(v.path),
            sshHost: str(v.sshHost),
            sshPort: typeof v.sshPort === 'number' ? v.sshPort : 22,
            sshUser: str(v.sshUser) ?? 'deploy',
            sshTargetDir: str(v.sshTargetDir) ?? '/var/www/site'
          })
        )
      } catch (err) {
        return failure(err)
      }
    }
  }
  bus.emit(DIALOG_EVENT, spec)
}

export const openPageDialog = (): void => {
  const title = t('cazalla.sites.newPage')
  if (!guard(title, true)) return
  bus.emit(DIALOG_EVENT, {
    title,
    fields: [
      { key: 'title', label: t('cazalla.sites.pageTitle'), type: 'text', required: true },
      {
        key: 'site',
        label: t('cazalla.sites.site'),
        type: 'select',
        required: true,
        options: (): Option[] => useMetadataStore().sitesList.map((s) => ({ value: s.slug, label: s.name }))
      }
    ],
    submit: async(v: Values) => {
      const folder = useContentFolder().value
      const site = useMetadataStore().sites[String(v.site)]
      if (!folder || !site) return t('cazalla.sites.noSites')
      try {
        await afterCreate(await createWebpage(folder, site, String(v.title)))
      } catch (err) {
        return failure(err)
      }
    }
  })
}

export const openPublishDialog = (): void => bus.emit(PUBLISH_DIALOG_EVENT)
