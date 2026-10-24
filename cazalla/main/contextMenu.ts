import type { BrowserWindow, MenuItemConstructorOptions } from 'electron'
import { getCurrentLanguage } from '../../packages/desktop/src/main/i18n'
import en from '../renderer/core/locales/en.json'
import es from '../renderer/core/locales/es.json'

export const SUBTASK_CHANNEL = 'mt::cm-cazalla-subtask'

const labels: Record<string, typeof en> = { en, es }

// Unit specs mock the main i18n module with only `t`; English is the fallback there.
const bundle = (): typeof en => {
  try {
    return labels[getCurrentLanguage()] ?? en
  } catch {
    return en
  }
}

const getAddSubtask = (): MenuItemConstructorOptions => ({
  label: bundle().cazalla.subtask.menu,
  id: 'cazallaAddSubtaskMenuItem',
  click(_item, targetWindow) {
    ;(targetWindow as BrowserWindow | undefined)?.webContents.send(SUBTASK_CHANNEL)
  }
})

/** Entries appended to the editor's right-click menu. The renderer decides whether they apply. */
export const cazallaEditorContextItems = (): MenuItemConstructorOptions[] => [{ type: 'separator' }, getAddSubtask()]
