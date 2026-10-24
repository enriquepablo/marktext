import bus from '@/bus'
import { t } from '@/i18n'
import notice from '@/services/notification'
import { DIALOG_EVENT, type DialogSpec, type Option, type Values } from '../dialogs/types'
import { useContentFolder } from '../core/contentFolder'
import { dateKey, addMonths } from '../core/time'
import { useMetadataStore } from '../metadata/store'
import { createNote, createTask, ExistsError } from './create'
import { useTaskStore } from './store'

const projectOptions = (): Option[] =>
  useMetadataStore().projectsList.map((p) => ({ value: p.slug, label: p.name }))

const failure = (err: unknown): string =>
  err instanceof ExistsError
    ? t('cazalla.dialog.exists', { file: err.file })
    : err instanceof Error
      ? err.message
      : String(err)

const open = (spec: DialogSpec): void => {
  if (!useContentFolder().value) {
    notice.notify({ title: spec.title, type: 'warning', message: t('cazalla.dialog.noContentFolder') })
    return
  }
  if (useMetadataStore().projectsList.length === 0) {
    notice.notify({ title: spec.title, type: 'warning', message: t('cazalla.dialog.noProjects') })
    return
  }
  bus.emit(DIALOG_EVENT, spec)
}

const afterCreate = async(file: string): Promise<void> => {
  await useTaskStore().LOAD()
  notice.notify({ title: t('cazalla.dialog.created', { file }), type: 'primary', message: '' })
  window.electron.ipcRenderer.send('mt::open-file', file)
}

const projectField = (): DialogSpec['fields'][number] => ({
  key: 'project',
  label: t('cazalla.note.project'),
  type: 'select',
  required: true,
  options: projectOptions
})

export const openNoteDialog = (): void =>
  open({
    title: t('cazalla.note.title'),
    fields: [{ key: 'title', label: t('cazalla.note.name'), type: 'text', required: true }, projectField()],
    submit: async(v: Values) => {
      const folder = useContentFolder().value
      const project = useMetadataStore().projects[String(v.project)]
      if (!folder || !project) return t('cazalla.dialog.noProjects')
      try {
        await afterCreate(await createNote(folder, project, String(v.title)))
      } catch (err) {
        return failure(err)
      }
    }
  })

export const openTaskDialog = (): void =>
  open({
    title: t('cazalla.task.title'),
    fields: [
      { key: 'title', label: t('cazalla.task.name'), type: 'text', required: true },
      projectField(),
      { key: 'due', label: t('cazalla.task.due'), type: 'date', default: dateKey(addMonths(new Date(), 1)) }
    ],
    submit: async(v: Values) => {
      const folder = useContentFolder().value
      const project = useMetadataStore().projects[String(v.project)]
      if (!folder || !project) return t('cazalla.dialog.noProjects')
      try {
        await afterCreate(await createTask(folder, project, { title: String(v.title), due: v.due ? String(v.due) : null }))
      } catch (err) {
        return failure(err)
      }
    }
  })
