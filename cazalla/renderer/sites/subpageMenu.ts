import bus from '@/bus'
import { t } from '@/i18n'
import notice from '@/services/notification'
import { useEditorStore } from '@/store/editor'
import { DIALOG_EVENT, type Values } from '../dialogs/types'
import { ExistsError } from '../tasks/create'
import { createSubpage, parentPageFromMarkdown } from './pages'

// Mirrors SUBPAGE_CHANNEL in cazalla/main/contextMenu.ts; main and renderer bundles do not share modules.
const CHANNEL = 'mt::cm-cazalla-subpage'

const openForCurrentFile = (): void => {
  const current = useEditorStore().currentFile
  const parent = current?.pathname ? parentPageFromMarkdown(current.pathname, current.markdown) : null
  if (!parent) {
    void notice.notify({ title: t('cazalla.sites.newSubpage'), type: 'warning', message: t('cazalla.sites.notAPage') })
    return
  }
  bus.emit(DIALOG_EVENT, {
    title: t('cazalla.sites.newSubpage'),
    fields: [{ key: 'title', label: t('cazalla.sites.pageTitle'), type: 'text', required: true }],
    submit: async(v: Values) => {
      try {
        const file = await createSubpage(parent, String(v.title))
        notice.notify({ title: t('cazalla.dialog.created', { file }), type: 'primary', message: '' })
        window.electron.ipcRenderer.send('mt::open-file', file)
      } catch (err) {
        return err instanceof ExistsError ? t('cazalla.dialog.exists', { file: err.file }) : String(err)
      }
    }
  })
}

let listening = false
export const listenForSubpageMenu = (): void => {
  if (listening) return
  listening = true
  window.electron.ipcRenderer.on(CHANNEL, openForCurrentFile)
}
