// Rewrites relative markdown links after a file or folder moved. Wiki links
// (`[[name]]`) resolve by name, not by path, and are left alone.

// `[text](target "title")` and `![alt](target)`; the target is group 2.
const LINK = /(!?\[[^\]]*\]\()(<[^>]*>|[^)\s]+)((?:\s+"[^"]*")?\))/g

const isExternal = (target: string): boolean =>
  /^[a-z][a-z0-9+.-]*:/i.test(target) || target.startsWith('#') || target.startsWith('/') || target === ''

const sep = (): string => window.path.sep

/** Maps an absolute path from before the move to after it. */
export const remapper = (from: string, to: string) => (abs: string): string =>
  abs === from ? to : abs.startsWith(from + sep()) ? to + abs.slice(from.length) : abs

const toPosix = (p: string): string => p.split(sep()).join('/')

/**
 * Rewrites the relative links of one document whose directory was `oldDir`
 * before the move and is `newDir` after it, so every target still resolves.
 * Returns the new text and how many targets changed.
 */
export const rewriteLinks = (
  text: string,
  oldDir: string,
  newDir: string,
  remap: (abs: string) => string
): { text: string; count: number } => {
  let count = 0
  const out = text.replace(LINK, (whole, open: string, rawTarget: string, close: string) => {
    const angled = rawTarget.startsWith('<')
    const target = angled ? rawTarget.slice(1, -1) : rawTarget
    if (isExternal(target)) return whole
    const hash = target.indexOf('#')
    const pathPart = hash >= 0 ? target.slice(0, hash) : target
    const anchor = hash >= 0 ? target.slice(hash) : ''
    if (!pathPart) return whole
    let decoded: string
    try {
      decoded = decodeURI(pathPart)
    } catch {
      return whole
    }
    const oldAbs = window.path.resolve(oldDir, decoded)
    const newAbs = remap(oldAbs)
    let rel = toPosix(window.path.relative(newDir, newAbs))
    if (!rel.startsWith('.') && !rel.startsWith('/')) rel = rel || '.'
    if (rel === toPosix(decoded)) return whole
    count++
    const encoded = decoded === pathPart ? rel : encodeURI(rel)
    const next = angled ? `<${encoded}${anchor}>` : `${encoded}${anchor}`
    return `${open}${next}${close}`
  })
  return { text: out, count }
}
