import { ipcMain } from 'electron'

export const DEVTOOLS_CHANNEL = 'mt::cazalla-toggle-devtools'

/** Toggles the developer tools of the window that asks, in release builds too. */
export const registerCazallaDevtoolsHandlers = (): void => {
  ipcMain.on(DEVTOOLS_CHANNEL, (e) => e.sender.toggleDevTools())
}
