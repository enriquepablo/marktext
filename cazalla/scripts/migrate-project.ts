/**
 * Migrates one project from the Obsidian vault into the content folder
 * (plan-cazalla.net, item 27). The vault is only read.
 *
 * Usage: pnpm exec tsx cazalla/scripts/migrate-project.ts <project path relative to the vault> | --daily
 *            [--vault ~/work/Work] [--notes ~/notes] [--apply]
 *
 * --daily migrates Daily/ into _daily/YYYY/MM/ instead of a project.
 *
 * Without --apply the planned actions and the report are printed and nothing is written.
 */
import os from 'node:os'
import path from 'node:path'
import { apply, describe, plan, planDaily } from './migrate-project/plan'

const USAGE = 'usage: migrate-project.ts <project path> | --daily [--vault <dir>] [--notes <dir>] [--apply]'

const expand = (p: string): string => path.resolve(p.replace(/^~(?=$|\/)/, os.homedir()))

export const parseArgs = (argv: string[]): { project: string; daily: boolean; vault: string; notes: string; apply: boolean } | null => {
  const opts = { project: '', daily: false, vault: '~/work/Work', notes: '~/notes', apply: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--apply') opts.apply = true
    else if (a === '--daily') opts.daily = true
    else if ((a === '--vault' || a === '--notes') && argv[i + 1]) opts[a.slice(2) as 'vault' | 'notes'] = argv[++i]
    else if (a.startsWith('--') || opts.project) return null
    else opts.project = a
  }
  return opts.project !== '' !== opts.daily ? { ...opts, vault: expand(opts.vault), notes: expand(opts.notes) } : null
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)
if (isMain) {
  const args = parseArgs(process.argv.slice(2))
  if (!args) {
    console.error(USAGE)
    process.exit(2)
  }
  const result = args.daily ? planDaily(args.vault, args.notes) : plan(args.vault, args.notes, args.project, new Date().toISOString())
  result.actions.forEach((a) => console.log(describe(a)))
  if (result.report.length) console.log(`\nreport:\n${result.report.map((r) => `  ${r}`).join('\n')}`)
  if (args.apply) {
    apply(result.actions)
    console.log(`\napplied ${result.actions.length} actions into ${path.join(args.notes, result.target)}`)
  } else {
    console.log(`\n${result.actions.length} actions planned for ${path.join(args.notes, result.target)}; rerun with --apply to execute`)
  }
}
