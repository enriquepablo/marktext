// Thin typed layer over the preload bridge, so feature code reads as file operations.

export const join = (...parts: string[]): string => window.path.join(...parts)
export const dirname = (p: string): string => window.path.dirname(p)
export const basename = (p: string, ext?: string): string => window.path.basename(p, ext)

export const exists = (p: string): Promise<boolean> => window.fileUtils.pathExists(p)
export const ensureDir = (p: string): Promise<void> => window.fileUtils.ensureDir(p)
export const move = (from: string, to: string): Promise<void> => window.fileUtils.move(from, to)
export const remove = (p: string): Promise<void> => window.fileUtils.unlink(p)

export const readText = async(p: string): Promise<string> =>
  String(await window.fileUtils.readFile(p, 'utf8'))

/** Writes a file, creating missing parent directories. */
export const writeText = (p: string, text: string): Promise<void> =>
  window.fileUtils.outputFile(p, text)

export const writeBytes = (p: string, bytes: Uint8Array): Promise<void> =>
  window.fileUtils.outputFile(p, bytes)

/** Names in a directory, or an empty list when it does not exist. */
export const listDir = async(dir: string): Promise<string[]> => {
  try {
    return await window.fileUtils.readdir(dir)
  } catch {
    return []
  }
}

/** Absolute paths of `.md` files under `dir`, descending into subdirectories. */
export const listMarkdownFiles = async(dir: string): Promise<string[]> => {
  const out: string[] = []
  for (const name of await listDir(dir)) {
    const p = join(dir, name)
    const stat = await window.fileUtils.stat(p).catch(() => null)
    if (!stat) continue
    if (stat.isDirectory) out.push(...(await listMarkdownFiles(p)))
    else if (stat.isFile && name.endsWith('.md')) out.push(p)
  }
  return out
}
