import type { FileLeafKind } from './tree'

/** The pane kind that shows a file of this type, or null when the editor or the system should. */
export const paneKindFor = (file: string): FileLeafKind | null => {
  if (/\.pdf$/i.test(file)) return 'pdf'
  if (/\.excalidraw$/i.test(file)) return 'drawing'
  return null
}

const isExternal = (href: string): boolean => /^[a-z][a-z0-9+.-]*:/i.test(href) && !/^file:/i.test(href)

/**
 * Opens `.pdf` and `.excalidraw` link targets in a pane instead of handing them
 * to the system. Returns true when the link was taken.
 */
export const routeLinkToPane = (href: string | null | undefined, dirname: string | null | undefined): boolean => {
  if (!href || isExternal(href) || href.startsWith('#')) return false
  let target = href.replace(/^file:\/\//i, '').split('#')[0]
  try {
    target = decodeURI(target)
  } catch {
    /* keep as written */
  }
  const kind = paneKindFor(target)
  if (!kind) return false
  const file = window.path.isAbsolute(target) ? target : window.path.resolve(dirname ?? '', target)
  if (kind !== 'pdf' && kind !== 'drawing') return false
  // Loaded on use: the editor store imports this module, and its specs run without pinia globals.
  void import('../core/layout').then(({ useCazallaLayoutStore }) => useCazallaLayoutStore().OPEN_VIEWER(kind, file))
  return true
}
