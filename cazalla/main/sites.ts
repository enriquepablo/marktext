import { app, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

export const SITE_RUN_CHANNEL = 'mt::cazalla-site-run'
export const SITE_LOG_CHANNEL = 'mt::cazalla-site-log'

type SiteStep = 'ensure' | 'draft' | 'publish' | 'upload'

interface SiteRunRequest {
  siteSlug: string
  step: SiteStep
  env: Record<string, string>
}

/** The Pelican project shipped with the app: `cazalla/pelican` in a checkout, an extra resource when packaged. */
const sourceDir = (): string =>
  app.isPackaged ? path.join(process.resourcesPath, 'cazalla', 'pelican') : path.join(app.getAppPath(), '..', '..', 'cazalla', 'pelican')

/** Per-site working copy under user data; venv and output live here, never in the vault. */
const siteDir = (slug: string): string => path.join(app.getPath('userData'), 'cazalla', 'pelican', slug.replace(/[^a-z0-9-]/gi, '_'))

const ensureProject = (dir: string): void => {
  // Templates, theme and configs are refreshed from the source on every run; venv and output are kept.
  fs.mkdirSync(dir, { recursive: true })
  fs.cpSync(sourceDir(), dir, { recursive: true, force: true })
}

const run = (
  event: IpcMainInvokeEvent,
  siteSlug: string,
  cmd: string,
  args: string[],
  cwd: string,
  env: Record<string, string>
): Promise<number> =>
  new Promise((resolve) => {
    const send = (line: string): void => {
      if (!event.sender.isDestroyed()) event.sender.send(SITE_LOG_CHANNEL, { siteSlug, line })
    }
    send(`> ${cmd} ${args.join(' ')}`)
    const child = spawn(cmd, args, { cwd, env: { ...process.env, ...env }, shell: false })
    const forward = (chunk: Buffer): void => {
      for (const line of chunk.toString().split(/\r?\n/)) if (line) send(line)
    }
    child.stdout.on('data', forward)
    child.stderr.on('data', forward)
    child.on('error', (err) => {
      send(String(err.message))
      resolve(127)
    })
    child.on('close', (code) => resolve(code ?? 1))
  })

const STEP_COMMANDS: Record<Exclude<SiteStep, 'ensure'>, string[]> = {
  draft: ['draft'],
  publish: ['publish'],
  upload: ['rsync_upload']
}

/** Registers the single IPC handler that builds and publishes sites; the renderer streams the log. */
export const registerCazallaSiteHandlers = (): void => {
  ipcMain.handle(SITE_RUN_CHANNEL, async(event, request: SiteRunRequest) => {
    const { siteSlug, step, env } = request
    const dir = siteDir(siteSlug)
    ensureProject(dir)
    let code = 0
    if (step === 'ensure') {
      if (!fs.existsSync(path.join(dir, 'venv', 'bin', 'pip'))) {
        code = await run(event, siteSlug, 'python3', ['-m', 'venv', '--clear', 'venv'], dir, env)
        if (code === 0) code = await run(event, siteSlug, path.join(dir, 'venv', 'bin', 'pip'), ['install', '-q', '-r', 'requirements.txt'], dir, env)
      }
    } else {
      code = await run(event, siteSlug, 'make', STEP_COMMANDS[step], dir, env)
    }
    return { code, dir }
  })
}
