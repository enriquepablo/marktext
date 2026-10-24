import type { BrowserWindow, MenuItemConstructorOptions } from 'electron'
import { getCurrentLanguage } from '../../packages/desktop/src/main/i18n'
import en from '../renderer/core/locales/en.json'
import es from '../renderer/core/locales/es.json'

export const SUBTASK_CHANNEL = 'mt::cm-cazalla-subtask'
export const PANE_CHANNEL = 'mt::cm-cazalla-pane'

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

const paneItem = (label: string, id: string, action: string): MenuItemConstructorOptions => ({
  label,
  id,
  click(_item, targetWindow) {
    ;(targetWindow as BrowserWindow | undefined)?.webContents.send(PANE_CHANNEL, action)
  }
})

/** Entries appended to the editor's right-click menu. The renderer decides whether they apply. */
export const cazallaEditorContextItems = (): MenuItemConstructorOptions[] => {
  const { panes } = bundle().cazalla
  return [
    { type: 'separator' },
    getAddSubtask(),
    { type: 'separator' },
    paneItem(panes.splitHorizontal, 'cazallaSplitHorizontalMenuItem', 'split-horizontal'),
    paneItem(panes.splitVertical, 'cazallaSplitVerticalMenuItem', 'split-vertical'),
    paneItem(panes.close, 'cazallaClosePaneMenuItem', 'close')
  ]
}
