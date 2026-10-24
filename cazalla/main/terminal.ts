import { ipcMain, type WebContents } from 'electron'
import * as pty from 'node-pty'

export const TERM_OPEN = 'mt::cazalla-term-open'
export const TERM_INPUT = 'mt::cazalla-term-input'
export const TERM_RESIZE = 'mt::cazalla-term-resize'
export const TERM_CLOSE = 'mt::cazalla-term-close'
export const TERM_DATA = 'mt::cazalla-term-data'
export const TERM_EXIT = 'mt::cazalla-term-exit'

interface OpenRequest {
  id: string
  cwd: string
  cols: number
  rows: number
  // Program to run in the terminal; lazygit by default.
  command?: string
  args?: string[]
}

const sessions = new Map<string, { proc: pty.IPty; sender: WebContents }>()

const close = (id: string): void => {
  const session = sessions.get(id)
  if (!session) return
  sessions.delete(id)
  try {
    session.proc.kill()
  } catch {
    /* already gone */
  }
}

/** One pseudo-terminal per pane; output streams to the renderer, input and resizes come back. */
export const registerCazallaTerminalHandlers = (): void => {
  ipcMain.handle(TERM_OPEN, (event, request: OpenRequest) => {
    const { id, cwd, cols, rows } = request
    close(id)
    const command = request.command ?? 'lazygit'
    try {
      const proc = pty.spawn(command, request.args ?? [], {
        name: 'xterm-256color',
        cwd,
        cols: Math.max(2, cols),
        rows: Math.max(1, rows),
        env: { ...process.env, TERM: 'xterm-256color', COLORTERM: 'truecolor', LANG: process.env.LANG ?? 'en_US.UTF-8' } as Record<string, string>
      })
      const sender = event.sender
      sessions.set(id, { proc, sender })
      proc.onData((data) => {
        if (!sender.isDestroyed()) sender.send(TERM_DATA, { id, data })
      })
      proc.onExit(({ exitCode }) => {
        sessions.delete(id)
        if (!sender.isDestroyed()) sender.send(TERM_EXIT, { id, code: exitCode })
      })
      sender.once('destroyed', () => close(id))
      return { ok: true }
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })
  ipcMain.on(TERM_INPUT, (_e, id: string, data: string) => sessions.get(id)?.proc.write(data))
  ipcMain.on(TERM_RESIZE, (_e, id: string, cols: number, rows: number) => {
    try {
      sessions.get(id)?.proc.resize(Math.max(2, cols), Math.max(1, rows))
    } catch {
      /* resize after exit */
    }
  })
  ipcMain.on(TERM_CLOSE, (_e, id: string) => close(id))
}
