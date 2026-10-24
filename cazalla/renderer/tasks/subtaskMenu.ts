import bus from '@/bus'
import { t } from '@/i18n'
import notice from '@/services/notification'
import { useEditorStore } from '@/store/editor'
import { DIALOG_EVENT, type Values } from '../dialogs/types'
import { ExistsError } from './create'
import { useTaskStore } from './store'
import { createSubtask, parentFromMarkdown } from './subtasks'

// Mirrors SUBTASK_CHANNEL in cazalla/main/contextMenu.ts; main and renderer bundles do not share modules.
const CHANNEL = 'mt::cm-cazalla-subtask'

const warn = (message: string): void => {
  void notice.notify({ title: t('cazalla.subtask.title'), type: 'warning', message })
}

const openForCurrentFile = (): void => {
  const current = useEditorStore().currentFile
  const parent = current?.pathname ? parentFromMarkdown(current.pathname, current.markdown) : null
  if (!parent) return warn(t('cazalla.subtask.notATask'))

  bus.emit(DIALOG_EVENT, {
    title: t('cazalla.subtask.title'),
    fields: [{ key: 'title', label: t('cazalla.subtask.name'), type: 'text', required: true }],
    submit: async(v: Values) => {
      try {
        const file = await createSubtask(parent, String(v.title))
        await useTaskStore().LOAD()
        notice.notify({ title: t('cazalla.dialog.created', { file }), type: 'primary', message: '' })
        window.electron.ipcRenderer.send('mt::open-file', file)
      } catch (err) {
        return err instanceof ExistsError ? t('cazalla.dialog.exists', { file: err.file }) : String(err)
      }
    }
  })
}

let listening = false
export const listenForSubtaskMenu = (): void => {
  if (listening) return
  listening = true
  window.electron.ipcRenderer.on(CHANNEL, openForCurrentFile)
}
