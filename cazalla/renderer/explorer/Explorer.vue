<template>
  <div class="cazalla-explorer">
    <el-tree
      ref="tree"
      lazy
      :data="roots"
      :load="load"
      :default-expanded-keys="expanded"
      :props="{ label: 'name', isLeaf: 'leaf' }"
      node-key="path"
      draggable
      highlight-current
      :expand-on-click-node="true"
      :allow-drag="(node: TreeNode) => !node.data.root"
      :allow-drop="(_drag: TreeNode, drop: TreeNode, type: string) => type === 'inner' && drop.data.isDir"
      @node-click="onClick"
      @node-contextmenu="onContextMenu"
      @node-drop="onDrop"
      @node-expand="(d: Entry) => remember(d.path, true)"
      @node-collapse="(d: Entry) => remember(d.path, false)"
    >
      <template #default="{ data }">
        <span
          class="entry"
          :class="{ dir: data.isDir, open: openFiles.has(data.path) }"
          :title="data.path"
        >
          <component
            :is="iconFor(data)"
            :size="14"
            class="entry-icon"
            aria-hidden="true"
          />
          <span class="entry-name">{{ data.name }}</span>
        </span>
      </template>
    </el-tree>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { BookOpen, File, FileText, Folder, FolderOpen, Image, PenTool } from 'lucide-vue-next'
import type Node from 'element-plus/es/components/tree/src/model/node'
import bus from '@/bus'
import notice from '@/services/notification'
import { popupContextMenu, type ContextMenuItem } from '@/contextMenu/popupMenu'
import { useEditorStore } from '@/store/editor'
import { usePreferencesStore } from '@/store/preferences'
import { useProjectStore } from '@/store/project'
import { useContentFolder } from '../core/contentFolder'
import { basename, dirname, ensureDir, exists, join, listDir, writeText } from '../core/fs'
import { DIALOG_EVENT, type Values } from '../dialogs/types'
import { useMetadataStore } from '../metadata/store'
import { useTaskStore } from '../tasks/store'
import { getKanbanMenuItem } from '../kanban/sidebarMenu'
import { getOpenInSplitMenuItem } from '../panes/sidebarMenu'
import { moveEntry, MoveError } from './move'
import { useCazallaLayoutStore } from '../core/layout'
import { paneKindFor } from '../panes/linkRouter'

interface Entry {
  path: string
  name: string
  isDir: boolean
  leaf: boolean
  root?: boolean
}
type TreeNode = Node & { data: Entry }

const { t } = useI18n()
const projectStore = useProjectStore()
const editorStore = useEditorStore()
const preferencesStore = usePreferencesStore()
const metadata = useMetadataStore()
const taskStore = useTaskStore()
const contentFolder = useContentFolder()
const { tabs, currentFile } = storeToRefs(editorStore)

const tree = ref<{ updateKeyChildren: (key: string, data: Entry[]) => void; getNode: (key: string) => Node | null } | null>(null)
const openFiles = computed(() => new Set(tabs.value.map((f) => f.pathname)))

const HIDDEN = new Set(['.git', 'node_modules', '.obsidian', '.trash'])
const IMAGE = /\.(png|jpe?g|gif|svg|webp|bmp)$/i
const isMarkdown = (name: string): boolean => window.fileUtils.hasMarkdownExtension(name)

const iconFor = (e: Entry): Component => {
  if (e.isDir) return tree.value?.getNode(e.path)?.expanded ? FolderOpen : Folder
  if (isMarkdown(e.name)) return FileText
  if (/\.pdf$/i.test(e.name)) return BookOpen
  if (/\.excalidraw$/i.test(e.name)) return PenTool
  if (IMAGE.test(e.name)) return Image
  return File
}

const readEntries = async(dir: string): Promise<Entry[]> => {
  const names = (await listDir(dir)).filter((n) => !HIDDEN.has(n) && !n.startsWith('.'))
  const entries: Entry[] = []
  for (const name of names) {
    const path = join(dir, name)
    const stat = await window.fileUtils.stat(path).catch(() => null)
    if (!stat) continue
    entries.push({ path, name, isDir: stat.isDirectory, leaf: !stat.isDirectory })
  }
  return entries.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name))
}

// Roots arrive over IPC after mount, so they are also reactive data. In lazy
// mode el-tree builds the root level from `load` when it is created and from
// `data` only when that prop changes later; serving the roots from both covers
// a first start (roots come late) and a remount (roots already known).
const roots = computed<Entry[]>(() =>
  projectStore.availableRoots.map((r) => ({ path: r.pathname, name: basename(r.pathname), isDir: true, leaf: false, root: true }))
)

const load = async(node: TreeNode, resolve: (data: Entry[]) => void): Promise<void> => {
  if (node.level === 0) return resolve(roots.value)
  resolve(await readEntries(node.data.path))
}

// Expanded folders survive restarts; roots start open the first time.
const EXPANDED_KEY = 'cazalla-explorer-expanded'
const readExpanded = (): string[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(EXPANDED_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}
const expanded = ref<string[]>(readExpanded())
const remember = (path: string, open: boolean): void => {
  const set = new Set(expanded.value)
  if (open) set.add(path)
  else for (const p of set) if (p === path || p.startsWith(path + window.path.sep)) set.delete(p)
  expanded.value = [...set]
  try {
    localStorage.setItem(EXPANDED_KEY, JSON.stringify(expanded.value))
  } catch {
    /* storage unavailable */
  }
}
watch(roots, (list) => {
  for (const r of list) if (expanded.value.length === 0 || !expanded.value.some((p) => p.startsWith(r.path))) remember(r.path, true)
}, { immediate: true })

const refresh = async(dir: string): Promise<void> => {
  const node = tree.value?.getNode(dir)
  if (!node || !node.loaded) return
  tree.value?.updateKeyChildren(dir, await readEntries(dir))
}

const select = (e: Entry): void =>
  projectStore.CHANGE_ACTIVE_ITEM({ pathname: e.path, isFile: !e.isDir, isDirectory: e.isDir, isMarkdown: !e.isDir && isMarkdown(e.name) })

const onClick = (e: Entry, _node: TreeNode, _comp: unknown, event?: MouseEvent): void => {
  select(e)
  if (e.isDir || event?.detail === 2) return
  if (!isMarkdown(e.name)) {
    const kind = paneKindFor(e.path)
    if (kind === 'pdf' || kind === 'drawing') useCazallaLayoutStore().OPEN_VIEWER(kind, e.path)
    else void window.electron.ipcRenderer.invoke('mt::shell::open-path', e.path)
    return
  }
  const opened = tabs.value.find((f) => window.fileUtils.isSamePathSync(f.pathname, e.path))
  if (opened) {
    editorStore.CANCEL_PENDING_SIDEBAR_OPEN()
    if (currentFile.value?.pathname !== opened.pathname) editorStore.UPDATE_CURRENT_FILE(opened)
    return
  }
  const preview = preferencesStore.openFilesInPreviewMode
  const requestId = editorStore.BEGIN_SIDEBAR_OPEN(e.path, preview)
  if (requestId == null) return
  window.electron.ipcRenderer.send('mt::open-file', e.path, { preview, requestId })
}

const warn = (message: string): void => {
  void notice.notify({ title: t('cazalla.explorer.title'), type: 'warning', message })
}

const askName = (title: string, initial: string, onSubmit: (name: string) => Promise<string | void>): void =>
  bus.emit(DIALOG_EVENT, {
    title,
    fields: [{ key: 'name', label: t('cazalla.explorer.name'), type: 'text', required: true, default: initial }],
    submit: (v: Values) => onSubmit(String(v.name).trim())
  })

const createIn = (dir: string, kind: 'file' | 'folder'): void =>
  askName(t(kind === 'file' ? 'cazalla.explorer.newFile' : 'cazalla.explorer.newFolder'), '', async(name) => {
    const final = kind === 'file' && !/\.[^.]+$/.test(name) ? `${name}.md` : name
    const path = join(dir, final)
    if (await exists(path)) return t('cazalla.dialog.exists', { file: path })
    if (kind === 'folder') await ensureDir(path)
    else await writeText(path, '')
    await refresh(dir)
  })

const doMove = async(from: string, to: string): Promise<boolean> => {
  try {
    const result = await moveEntry(from, to, { contentFolder: contentFolder.value, projects: metadata.projectsList })
    void notice.notify({
      title: t('cazalla.explorer.title'),
      type: 'primary',
      message: t('cazalla.explorer.moved', { name: basename(result.to), links: result.rewrittenLinks })
    })
    await Promise.all([metadata.LOAD(), taskStore.LOAD()])
    return true
  } catch (err) {
    warn(err instanceof MoveError ? t(`cazalla.explorer.${err.code}`, { path: err.detail }) : String(err))
    return false
  }
}

const rename = (e: Entry): void =>
  askName(t('cazalla.explorer.rename'), e.name, async(name) => {
    if (name === e.name) return
    const to = join(dirname(e.path), name)
    if (await doMove(e.path, to)) await refresh(dirname(e.path))
  })

const onDrop = async(drag: TreeNode, drop: TreeNode): Promise<void> => {
  const from = drag.data.path
  const targetDir = drop.data.path
  const to = join(targetDir, drag.data.name)
  if (from === to) return
  await doMove(from, to)
  // Reload both ends from disk so the tree matches the result, success or not.
  await Promise.all([refresh(dirname(from)), refresh(targetDir)])
}

const onContextMenu = (event: MouseEvent, e: Entry): void => {
  select(e)
  const dir = e.isDir ? e.path : dirname(e.path)
  const items: ContextMenuItem[] = [
    { label: t('cazalla.explorer.newFile'), click: () => createIn(dir, 'file') },
    { label: t('cazalla.explorer.newFolder'), click: () => createIn(dir, 'folder') },
    { type: 'separator' },
    { label: t('cazalla.explorer.rename'), enabled: !e.root, click: () => rename(e) },
    {
      label: t('cazalla.explorer.trash'),
      enabled: !e.root,
      click: () => {
        bus.emit('SIDEBAR::remove')
        setTimeout(() => void refresh(dirname(e.path)), 300)
      }
    },
    { type: 'separator' },
    { label: t('cazalla.explorer.copyPath'), click: () => bus.emit('SIDEBAR::copy-path') },
    { label: t('cazalla.explorer.showInFolder'), click: () => bus.emit('SIDEBAR::show-in-folder') },
    { type: 'separator' },
    { ...getOpenInSplitMenuItem(), enabled: !e.isDir && isMarkdown(e.name) },
    getKanbanMenuItem(),
    { type: 'separator' },
    { label: t('cazalla.explorer.refresh'), click: () => void refresh(dir) }
  ]
  popupContextMenu(items, { x: event.clientX, y: event.clientY })
}

// Markdown changes made elsewhere arrive through the upstream watcher; reload the affected folder.
const timers = new Map<string, ReturnType<typeof setTimeout>>()
const stopTreeEvents = window.electron.ipcRenderer.on('mt::update-object-tree', (_e, payload) => {
  const p = payload as { type?: string; change?: { pathname?: string } }
  const pathname = p?.change?.pathname
  if (!pathname) return
  const dir = p.type === 'addDir' || p.type === 'unlinkDir' ? dirname(pathname) : dirname(pathname)
  const pending = timers.get(dir)
  if (pending) clearTimeout(pending)
  timers.set(dir, setTimeout(() => void refresh(dir), 250))
})
onBeforeUnmount(() => {
  stopTreeEvents()
  timers.forEach((timer) => clearTimeout(timer))
})
</script>

<style scoped>
.cazalla-explorer {
  height: 100%;
  overflow: auto;
  padding: 4px 0;
}
.cazalla-explorer :deep(.el-tree) {
  background: transparent;
  color: var(--sideBarColor);
}
.cazalla-explorer :deep(.el-tree-node__content) {
  height: 26px;
}
.cazalla-explorer :deep(.el-tree-node__content:hover),
.cazalla-explorer :deep(.el-tree-node.is-current > .el-tree-node__content) {
  background: var(--sideBarItemHoverBgColor);
}
.cazalla-explorer :deep(.el-tree-node.is-drop-inner > .el-tree-node__content) {
  background: var(--themeColor20);
}
.entry {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  font-size: 13px;
}
.entry-icon {
  flex-shrink: 0;
  color: var(--sideBarIconColor);
}
.entry-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.entry.open .entry-name {
  color: var(--themeColor);
}
</style>
