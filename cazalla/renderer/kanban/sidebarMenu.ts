import bus from '@/bus'
import { t } from '@/i18n'
import { useProjectStore } from '@/store/project'
import { useContentFolder } from '../core/contentFolder'
import { join } from '../core/fs'
import { useCazallaLayoutStore } from '../core/layout'
import { useMetadataStore } from '../metadata/store'

const EVENT = 'cazalla:sidebar-kanban'

/** Sidebar context-menu entry; spread into the upstream item list. */
export const getKanbanMenuItem = (): { label: string; id: string; click: () => void } => ({
  label: t('cazalla.kanban.openForFolder'),
  id: 'cazallaKanbanMenuItem',
  click: () => bus.emit(EVENT)
})

// Resolves the project whose folder contains the right-clicked item, then opens the board on it.
const openForActiveItem = (): void => {
  const pathname = useProjectStore().activeItem?.pathname
  const folder = useContentFolder().value
  const layout = useCazallaLayoutStore()
  if (typeof pathname !== 'string' || !folder) return layout.OPEN_KANBAN()
  const sep = window.path.sep
  const project = useMetadataStore().projectsList.find((p) => {
    const root = join(folder, p.path)
    return pathname === root || pathname.startsWith(root + sep)
  })
  layout.OPEN_KANBAN(project?.slug ?? null)
}

let listening = false
export const listenForSidebarKanban = (): void => {
  if (listening) return
  listening = true
  bus.on(EVENT, openForActiveItem)
}
