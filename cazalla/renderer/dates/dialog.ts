import bus from '@/bus'
import { t } from '@/i18n'
import notice from '@/services/notification'
import { DIALOG_EVENT, type Values } from '../dialogs/types'
import { dateKey } from '../core/time'
import { activeInstance, cursorOf, replaceRange } from '../editor/registry'

const pad = (n: number): string => String(n).padStart(2, '0')

/** `YYYY-MM-DD` or `YYYY-MM-DD HH:mm` from the dialog values. */
export const formatInsert = (date: string, time: string | null, includeTime: boolean): string =>
  includeTime && time ? `${date} ${time}` : date

export const openDateDialog = (): void => {
  // The dialog takes focus, so the caret is captured before it opens.
  const active = activeInstance()
  const position = active ? cursorOf(active.muya) : null
  if (!active || !position) {
    notice.notify({ title: t('cazalla.date.title'), type: 'warning', message: t('cazalla.date.noCursor') })
    return
  }
  const now = new Date()
  bus.emit(DIALOG_EVENT, {
    title: t('cazalla.date.title'),
    fields: [
      { key: 'includeTime', label: t('cazalla.date.includeTime'), type: 'checkbox' },
      { key: 'date', label: t('cazalla.date.date'), type: 'date', required: true, default: dateKey(now) },
      { key: 'time', label: t('cazalla.date.time'), type: 'time', default: `${pad(now.getHours())}:${pad(now.getMinutes())}`, when: (v: Values) => !!v.includeTime }
    ],
    submit: async(v: Values) => {
      replaceRange(position, formatInsert(String(v.date), v.time ? String(v.time) : null, !!v.includeTime))
      active.muya.focus()
    }
  })
}
