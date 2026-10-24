export type GitState = 'modified' | 'untracked'

/**
 * Parses `git status --porcelain=v1 -z` into relative path → state. Renames
 * carry two paths; the new one is marked. Posix separators as git prints them.
 */
export const parsePorcelain = (output: string): Map<string, GitState> => {
  const out = new Map<string, GitState>()
  const parts = output.split('\0')
  for (let i = 0; i < parts.length; i++) {
    const entry = parts[i]
    if (entry.length < 4) continue
    const code = entry.slice(0, 2)
    const path = entry.slice(3)
    if (code[0] === 'R' || code[0] === 'C') i++ // the original path follows as its own record
    if (code === '!!') continue
    out.set(path, code === '??' ? 'untracked' : 'modified')
  }
  return out
}

/** State of a folder: the mix of its descendants' states. */
export const folderState = (states: Map<string, GitState>, folder: string): Set<GitState> => {
  const prefix = folder ? folder.replace(/\/+$/, '') + '/' : ''
  const set = new Set<GitState>()
  for (const [path, state] of states) if (!prefix || path.startsWith(prefix)) set.add(state)
  return set
}
