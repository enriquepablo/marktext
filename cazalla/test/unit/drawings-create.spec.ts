import { describe, it, expect, vi, beforeEach } from 'vitest'

const files = vi.hoisted(() => new Map<string, string>())
vi.hoisted(() => {
  const w = globalThis as unknown as Record<string, unknown>
  const win = (w.window ??= {}) as Record<string, unknown>
  win.path = { join: (...p: string[]) => p.join('/'), sep: '/' }
  win.fileUtils = { pathExists: async(p: string) => files.has(p), outputFile: async(p: string, d: string) => void files.set(p, d) }
})

import { createDrawing, drawingSegments, emptyScene } from '@cazalla/renderer/drawings/create'
import { ExistsError } from '@cazalla/renderer/tasks/create'
import type { Project } from '@cazalla/renderer/metadata/types'

const project: Project = { name: 'Site', slug: 'site', organization: null, leader: null, path: 'projects/site', file: '' }
const now = new Date(2026, 9, 24)

describe('drawings', () => {
  beforeEach(() => files.clear())

  it('writes an empty scene under assets/drawings/YYYY/MM', async() => {
    expect(drawingSegments(now)).toEqual(['assets', 'drawings', '2026', '10'])
    const file = await createDrawing('/vault', project, 'Site Map', now)
    expect(file).toBe('/vault/projects/site/assets/drawings/2026/10/site-map.excalidraw')
    const scene = JSON.parse(files.get(file)!)
    expect(scene.type).toBe('excalidraw')
    expect(scene.elements).toEqual([])
    expect(emptyScene().endsWith('\n')).toBe(true)
  })

  it('refuses to overwrite', async() => {
    await createDrawing('/vault', project, 'Twice', now)
    await expect(createDrawing('/vault', project, 'Twice', now)).rejects.toBeInstanceOf(ExistsError)
  })
})
