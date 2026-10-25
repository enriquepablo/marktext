/**
 * Wiki links of the project migration (plan-cazalla.net, item 27): `[[target]]`,
 * `[[target|alias]]`, `[[target#heading]]` and `![[embed]]` become markdown
 * links with hrefs relative to the document, as `links/linkDialog.ts` writes them.
 * Resolution of a target to a file is left to the caller through `resolve`.
 */
import path from 'node:path'

export type WikiLink = { embed: boolean; target: string; alias: string | null }

/** URI-encoded posix path of `toFile` relative to `fromDir`, both content-relative. */
export const hrefFor = (fromDir: string, toFile: string): string => encodeURI(path.posix.relative(fromDir, toFile))

const WIKI = /(!?)\[\[([^\]\n]+?)\]\]/g
const FENCE = /^(```|~~~)/

const parseInner = (inner: string): WikiLink & { heading: string | null } => {
  const [left, ...aliasParts] = inner.split('|')
  const [target, ...headingParts] = left.split('#')
  return {
    embed: false,
    target: target.trim(),
    heading: headingParts.length ? headingParts.join('#').trim() : null,
    alias: aliasParts.length ? aliasParts.join('|').trim() : null
  }
}

/** New content-relative path of the target's file, or null when it cannot be resolved. */
export type Resolve = (link: WikiLink) => string | null

/**
 * Rewrites every wiki link outside fenced code. The label is the alias, else the
 * target's base name. Unresolved links are left as written and listed.
 */
export const rewriteWikiLinks = (
  text: string,
  fromDir: string,
  resolve: Resolve
): { text: string; unresolved: string[] } => {
  const unresolved: string[] = []
  let inFence = false
  const lines = text.split('\n').map((line) => {
    if (FENCE.test(line)) inFence = !inFence
    if (inFence) return line
    return line.replace(WIKI, (raw: string, bang: string, inner: string) => {
      const link = { ...parseInner(inner), embed: bang === '!' }
      const file = resolve(link)
      if (!file) {
        unresolved.push(link.target)
        return raw
      }
      const label = link.alias ?? path.posix.basename(link.target)
      return `${bang}[${label}](${hrefFor(fromDir, file)})`
    })
  })
  return { text: lines.join('\n'), unresolved }
}

const rank = (rel: string, project: string): number =>
  rel.startsWith(project + '/') ? 0 : rel.startsWith('Files/') ? 1 : rel.startsWith('Daily/') ? 2 : 3

/** Obsidian's name match can be ambiguous: same project first, then Files/, Daily/, the rest; shallower paths win ties. */
export const pickCandidate = (candidates: string[], project: string): string | null =>
  [...candidates].sort((a, b) => rank(a, project) - rank(b, project) || a.split('/').length - b.split('/').length)[0] ?? null
