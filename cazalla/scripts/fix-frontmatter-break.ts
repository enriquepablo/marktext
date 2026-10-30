// One shot: `pnpm fix-frontmatter-break <root>`. For every .md under root whose
// closing frontmatter fence is not followed by an empty line, inserts one.
import fs from 'node:fs'
import path from 'node:path'

const FENCE = /^(---\r?\n[\s\S]*?\r?\n---)(\r?\n|$)([\s\S]*)$/

const fix = (text: string): string | null => {
  const m = FENCE.exec(text)
  if (!m) return null
  const [, block, eol, rest] = m
  if (eol === '' && rest === '') return `${block}\n`
  if (rest !== '' && !/^\r?\n/.test(rest)) return `${block}${eol}\n${rest}`
  return null
}

const walk = (dir: string, out: string[] = []): string[] => {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'node_modules') continue
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (e.isFile() && p.endsWith('.md')) out.push(p)
  }
  return out
}

const root = process.argv[2]
if (!root) {
  console.error('usage: pnpm fix-frontmatter-break <root>')
  process.exit(1)
}
let n = 0
for (const file of walk(path.resolve(root))) {
  const fixed = fix(fs.readFileSync(file, 'utf8'))
  if (fixed === null) continue
  fs.writeFileSync(file, fixed)
  console.log(file)
  n++
}
console.log(`${n} file(s) changed`)
