import bus from '@/bus'
import { t } from '@/i18n'
import notice from '@/services/notification'
import { DIALOG_EVENT, type Option, type Values } from '../dialogs/types'
import { useContentFolder } from '../core/contentFolder'
import { useMetadataStore } from '../metadata/store'
import { useCazallaLayoutStore } from '../core/layout'
import { ExistsError } from '../tasks/create'
import { createDrawing } from './create'

export const openDrawingDialog = (): void => {
  const title = t('cazalla.drawing.title')
  if (!useContentFolder().value) {
    notice.notify({ title, type: 'warning', message: t('cazalla.dialog.noContentFolder') })
    return
  }
  if (useMetadataStore().projectsList.length === 0) {
    notice.notify({ title, type: 'warning', message: t('cazalla.dialog.noProjects') })
    return
  }
  bus.emit(DIALOG_EVENT, {
    title,
    fields: [
      { key: 'name', label: t('cazalla.drawing.name'), type: 'text', required: true },
      {
        key: 'project',
        label: t('cazalla.note.project'),
        type: 'select',
        required: true,
        options: (): Option[] => useMetadataStore().projectsList.map((p) => ({ value: p.slug, label: p.name }))
      }
    ],
    submit: async(v: Values) => {
      const folder = useContentFolder().value
      const project = useMetadataStore().projects[String(v.project)]
      if (!folder || !project) return t('cazalla.dialog.noProjects')
      try {
        const file = await createDrawing(folder, project, String(v.name))
        notice.notify({ title: t('cazalla.dialog.created', { file }), type: 'primary', message: '' })
        useCazallaLayoutStore().OPEN_VIEWER('drawing', file)
      } catch (err) {
        return err instanceof ExistsError ? t('cazalla.dialog.exists', { file: err.file }) : String(err)
      }
    }
  })
}
