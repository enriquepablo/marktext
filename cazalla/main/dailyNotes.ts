import type { BrowserWindow, Menu, MenuItemConstructorOptions } from 'electron'
import type Keybindings from '../../packages/desktop/src/main/keyboard/shortcutHandler'
import type { CommandManager } from '../../packages/desktop/src/main/commands'
import { getCurrentLanguage } from '../../packages/desktop/src/main/i18n'
import en from '../renderer/dailyNotes/locales/en.json'
import es from '../renderer/dailyNotes/locales/es.json'

export const DAILY_NOTES_COMMAND = 'view.toggle-daily-notes'
export const DAILY_NOTES_MENU_ID = 'dailyNotesMenuItem'
export const DAILY_NOTES_LAYOUT_ENTRY = 'showDailyNotes'

const labels: Record<string, typeof en> = { en, es }

// Unit specs mock the main i18n module with only `t`; English is the fallback there.
const currentLanguage = (): string => {
  try {
    return getCurrentLanguage()
  } catch {
    return 'en'
  }
}
const menuLabel = (): string => (labels[currentLanguage()] ?? en).dailyNotes.title

type Win = BrowserWindow | null | undefined

export const toggleDailyNotes = (win: Win): void => {
  if (win && win.webContents) {
    win.webContents.send('mt::toggle-view-layout-entry', DAILY_NOTES_LAYOUT_ENTRY)
  }
}

/** View menu entry. Checked state is kept in sync by `syncDailyNotesMenu`. */
export const dailyNotesMenuItem = (keybindings: Keybindings): MenuItemConstructorOptions => ({
  id: DAILY_NOTES_MENU_ID,
  label: menuLabel(),
  type: 'checkbox',
  checked: false,
  accelerator: keybindings.getAccelerator(DAILY_NOTES_COMMAND) ?? undefined,
  click(_item, focusedWindow) {
    toggleDailyNotes(focusedWindow as BrowserWindow | undefined)
  }
})

export const registerDailyNotesCommand = (commandManager: CommandManager): void => {
  commandManager.add(DAILY_NOTES_COMMAND, (win: Win) => toggleDailyNotes(win))
}

/** Applies a `showDailyNotes` entry from `mt::view-layout-changed` to the menu checkbox. */
export const syncDailyNotesMenu = (menu: Menu, value: unknown): void => {
  const item = menu.getMenuItemById(DAILY_NOTES_MENU_ID)
  if (item) item.checked = !!value
}
