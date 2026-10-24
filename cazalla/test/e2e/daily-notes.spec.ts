import { mkdtempSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { expect, test } from '@playwright/test'
import type { ElectronApplication, Page } from 'playwright'
import { launchWithMarkdown, clickMenuById } from '../../../packages/desktop/test/e2e/helpers'

const pad = (n: number): string => String(n).padStart(2, '0')

let app: ElectronApplication
let page: Page
let vault: string
let notePath: string

test.beforeAll(async() => {
  vault = mkdtempSync(join(tmpdir(), 'marktext-vault-'))
  const now = new Date()
  const key = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  notePath = join(vault, '_daily', String(now.getFullYear()), pad(now.getMonth() + 1), `${key}.md`)
  const launched = await launchWithMarkdown('# doc\n', {
    preferences: { defaultDirectoryToOpen: vault, startUpAction: 'blank' }
  })
  app = launched.app
  page = launched.page
})
test.afterAll(async() => { await app?.close() })

test('menu toggles the panel and clicking today creates the note', async() => {
  await expect(page.locator('.daily-notes-panel')).toBeHidden()
  await clickMenuById(app, 'dailyNotesMenuItem')
  await expect(page.locator('.daily-notes-panel')).toBeVisible()
  await expect(page.locator('.dn-calendar')).toBeVisible()

  await page.locator('.dn-day.today').click()
  await expect.poll(() => existsSync(notePath)).toBe(true)
  const created = readFileSync(notePath, 'utf8')
  expect(created).toMatch(/^---\ntitle: "\d{4}-\d{2}-\d{2}"\nslug: \d{4}-\d{2}-\d{2}\ncreated: .+\nmodified: .+\ncategory: daily\ntags: \[\]\n---\n$/)
  await expect(page.locator('.dn-day.today')).toHaveClass(/has-note/)
  await expect(page.locator('.dn-note-editor .mu-container')).toBeVisible()
})

test('typing in the panel is saved with a new modified timestamp', async() => {
  const before = readFileSync(notePath, 'utf8')
  const editor = page.locator('.dn-note-editor .mu-container')
  await editor.click()
  await page.keyboard.press('End')
  await page.keyboard.type('Daily entry')
  await expect.poll(() => readFileSync(notePath, 'utf8'), { timeout: 5000 }).toContain('Daily entry')
  const after = readFileSync(notePath, 'utf8')
  expect(after.match(/^created: .*$/m)?.[0]).toBe(before.match(/^created: .*$/m)?.[0])
  expect(after).toMatch(/^modified: .*$/m)
})
