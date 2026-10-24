import { exists, join, writeText } from '../core/fs'
import { slug as toSlug } from '../core/slug'
import type { Project } from '../metadata/types'
import { ExistsError } from '../tasks/create'

export const DRAWINGS_DIR = 'drawings'
export const DRAWING_EXT = '.excalidraw'

const pad = (n: number): string => String(n).padStart(2, '0')

/** `assets/drawings/YYYY/MM` below the project folder. */
export const drawingSegments = (now: Date): string[] => ['assets', DRAWINGS_DIR, String(now.getFullYear()), pad(now.getMonth() + 1)]

/** An empty scene in the `.excalidraw` file format. */
export const emptyScene = (): string =>
  JSON.stringify({ type: 'excalidraw', version: 2, source: 'marktext-cazalla', elements: [], appState: { viewBackgroundColor: '#ffffff' }, files: {} }, null, 2) + '\n'

export const createDrawing = async(contentFolder: string, project: Project, name: string, now: Date = new Date()): Promise<string> => {
  const file = join(contentFolder, project.path, ...drawingSegments(now), `${toSlug(name)}${DRAWING_EXT}`)
  if (await exists(file)) throw new ExistsError(file)
  await writeText(file, emptyScene())
  return file
}
