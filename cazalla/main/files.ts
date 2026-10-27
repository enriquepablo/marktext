import { BrowserWindow, dialog, ipcMain } from 'electron'

export const PICK_FILES_CHANNEL = 'mt::cazalla-pick-files'

/** Native open dialog for the explorer's "add file from outside"; the chosen paths, none when cancelled. */
export const registerCazallaFileHandlers = (): void => {
  ipcMain.handle(PICK_FILES_CHANNEL, async(event): Promise<string[]> => {
    const win = BrowserWindow.fromWebContents(event.sender)
    const options = { properties: ['openFile', 'multiSelections'] as ('openFile' | 'multiSelections')[] }
    const result = win ? await dialog.showOpenDialog(win, options) : await dialog.showOpenDialog(options)
    return result.canceled ? [] : result.filePaths
  })
}
