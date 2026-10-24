import bus from '@/bus'
import { t } from '@/i18n'

const EVENT = 'cazalla:sidebar-open-in-split'

/** Sidebar context-menu entry; spread into the upstream item list. */
export const getOpenInSplitMenuItem = (): { label: string; id: string; click: () => void } => ({
  label: t('cazalla.panes.openInSplit'),
  id: 'cazallaOpenInSplitMenuItem',
  click: () => bus.emit(EVENT)
})

// Stores are imported on use; see kanban/sidebarMenu.ts for the reason.
const openActiveItem = async(): Promise<void> => {
  const [{ useProjectStore }, { usePaneStore }] = await Promise.all([import('@/store/project'), import('./store')])
  const item = useProjectStore().activeItem
  if (item?.isFile && typeof item.pathname === 'string') usePaneStore().OPEN_IN_SPLIT(item.pathname)
}

let listening = false
export const listenForSidebarOpenInSplit = (): void => {
  if (listening) return
  listening = true
  bus.on(EVENT, () => void openActiveItem())
}
