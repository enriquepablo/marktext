import bus from '@/bus'
import { t } from '@/i18n'

const EVENT = 'cazalla:sidebar-kanban'

/** Sidebar context-menu entry; spread into the upstream item list. */
export const getKanbanMenuItem = (): { label: string; id: string; click: () => void } => ({
  label: t('cazalla.kanban.openForFolder'),
  id: 'cazallaKanbanMenuItem',
  click: () => bus.emit(EVENT)
})

// Stores are imported on use: this module is loaded by the upstream sidebar
// menu, whose unit specs run without the preload globals the stores read.
const openForActiveItem = async(): Promise<void> => {
  const [{ useProjectStore }, { useContentFolder }, { join }, { useCazallaLayoutStore }, { useMetadataStore }] = await Promise.all([
    import('@/store/project'),
    import('../core/contentFolder'),
    import('../core/fs'),
    import('../core/layout'),
    import('../metadata/store')
  ])
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
  bus.on(EVENT, () => void openForActiveItem())
}
