import { ref } from 'vue'
import type { Site } from '../metadata/types'
import { join } from '../core/fs'
import { PAGES_DIR } from './pages'

// Mirrors cazalla/main/sites.ts; main and renderer bundles do not share modules.
export const SITE_RUN_CHANNEL = 'mt::cazalla-site-run'
export const SITE_LOG_CHANNEL = 'mt::cazalla-site-log'

export type SiteStep = 'ensure' | 'draft' | 'publish' | 'upload'

export interface SiteRunRequest {
  siteSlug: string
  step: SiteStep
  // Environment for the Makefile: SSH_* and SITEURL from the site record, INPUTDIR from its pages folder.
  env: Record<string, string>
}

export interface SiteRunResult {
  code: number
  // Pelican project directory used for this site, under the app's user data.
  dir: string
}

export const runEnv = (contentFolder: string, site: Site): Record<string, string> => ({
  SSH_HOST: site.sshHost ?? '',
  SSH_PORT: String(site.sshPort ?? 22),
  SSH_USER: site.sshUser ?? 'deploy',
  SSH_TARGET_DIR: site.sshTargetDir ?? '/var/www/site',
  SITEURL: site.siteUrl ?? '',
  INPUTDIR: join(contentFolder, site.path, PAGES_DIR)
})

export const log = ref<string[]>([])
export const running = ref(false)

let listening = false
export const listenForSiteLog = (): void => {
  if (listening) return
  listening = true
  window.electron.ipcRenderer.on(SITE_LOG_CHANNEL, (_e, payload) => {
    const line = (payload as { line?: string })?.line
    if (typeof line === 'string') log.value.push(line)
  })
}

export const runStep = (siteSlug: string, step: SiteStep, env: Record<string, string>): Promise<SiteRunResult> =>
  window.electron.ipcRenderer.invoke(SITE_RUN_CHANNEL, { siteSlug, step, env } as SiteRunRequest) as Promise<SiteRunResult>

/** Runs the steps in order, stopping at the first non-zero exit. Returns the last result. */
export const runSteps = async(siteSlug: string, steps: SiteStep[], env: Record<string, string>): Promise<SiteRunResult> => {
  running.value = true
  try {
    let last: SiteRunResult = { code: 0, dir: '' }
    for (const step of steps) {
      log.value.push(`$ ${step}`)
      last = await runStep(siteSlug, step, env)
      if (last.code !== 0) {
        log.value.push(`exit ${last.code}`)
        break
      }
    }
    return last
  } finally {
    running.value = false
  }
}
