import { ipcMain } from 'electron'
import { execFile } from 'node:child_process'

export const GIT_STATUS_CHANNEL = 'mt::cazalla-git-status'

/** `git status --porcelain=v1 -z` of a folder; empty output when git or a repository is missing. */
export const registerCazallaGitHandlers = (): void => {
  ipcMain.handle(GIT_STATUS_CHANNEL, (_e, cwd: string) =>
    new Promise<{ ok: boolean; output: string }>((resolve) => {
      execFile(
        'git',
        ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
        { cwd, maxBuffer: 16 * 1024 * 1024, env: { ...process.env, GIT_OPTIONAL_LOCKS: '0' } },
        (err, stdout) => resolve(err ? { ok: false, output: '' } : { ok: true, output: stdout })
      )
    })
  )
}
