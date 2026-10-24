import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import notice from '@/services/notification'
import { t } from '@/i18n'
import { useEditorStore } from '@/store/editor'
import {
  PRIMARY,
  findNode,
  isValidTree,
  leaves,
  nextId,
  removeLeaf,
  setFile,
  setRatio,
  splitLeaf,
  type Direction,
  type Leaf,
  type PaneNode
} from './tree'

const STORAGE_KEY = 'cazalla-panes'
export const PANE_CHANNEL = 'mt::cm-cazalla-pane'
export type PaneAction = 'split-horizontal' | 'split-vertical' | 'close'

const readTree = (): PaneNode => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')
    return isValidTree(parsed) ? parsed : PRIMARY
  } catch {
    return PRIMARY
  }
}

export const usePaneStore = defineStore('cazallaPanes', () => {
  const tree = ref<PaneNode>(readTree())
  const focusedId = ref<string>('primary')

  const isSplit = computed(() => tree.value.kind === 'split')

  watch(
    tree,
    (value) => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(value))
      } catch {
        /* storage unavailable */
      }
    },
    { deep: true }
  )

  const focusedLeaf = (): Leaf | null => {
    const node = findNode(tree.value, focusedId.value)
    return node && node.kind !== 'split' ? node : leaves(tree.value)[0]
  }

  // The file a new pane shows: the focused pane's file, or the editor's current document.
  const fileForNewPane = (): string | null => {
    const leaf = focusedLeaf()
    if (leaf?.kind === 'file') return leaf.file
    return useEditorStore().currentFile?.pathname ?? null
  }

  function FOCUS(id: string): void {
    focusedId.value = id
  }

  function SPLIT(direction: Direction, file: string | null = fileForNewPane()): void {
    if (!file) {
      notice.notify({ title: t('cazalla.panes.title'), type: 'warning', message: t('cazalla.panes.noFile') })
      return
    }
    const leaf = focusedLeaf()
    if (!leaf) return
    const created: Leaf = { kind: 'file', id: nextId(), file }
    tree.value = splitLeaf(tree.value, leaf.id, direction, created)
    focusedId.value = created.id
  }

  function CLOSE(id: string = focusedId.value): void {
    if (id === 'primary') return
    tree.value = removeLeaf(tree.value, id)
    if (focusedId.value === id) focusedId.value = 'primary'
  }

  /** Shows `file` in the focused file pane, or opens a new pane beside the primary editor. */
  function OPEN_IN_SPLIT(file: string): void {
    const leaf = focusedLeaf()
    if (leaf?.kind === 'file') tree.value = setFile(tree.value, leaf.id, file)
    else SPLIT('vertical', file)
  }

  function SET_RATIO(id: string, ratio: number): void {
    tree.value = setRatio(tree.value, id, ratio)
  }

  function RESET(): void {
    tree.value = PRIMARY
    focusedId.value = 'primary'
  }

  let listening = false
  function LISTEN(): void {
    if (listening) return
    listening = true
    window.electron.ipcRenderer.on(PANE_CHANNEL, (_e, action) => {
      if (action === 'split-horizontal') SPLIT('horizontal')
      else if (action === 'split-vertical') SPLIT('vertical')
      else if (action === 'close') CLOSE()
    })
  }

  return { tree, focusedId, isSplit, FOCUS, SPLIT, CLOSE, OPEN_IN_SPLIT, SET_RATIO, RESET, LISTEN }
})
