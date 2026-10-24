import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useEditorStore } from '@/store/editor'
import { useDailyNotesStore } from '../dailyNotes/store'
import { parse } from './frontmatter'

export const ACTIVITY_BAR_WIDTH = 40

export type MainView = 'editor' | 'kanban' | 'terminal' | 'viewer'
export type ViewerKind = 'pdf' | 'drawing'

/** Horizontal space the cazalla panels take, and which view fills the main area. */
export const useCazallaLayoutStore = defineStore('cazallaLayout', () => {
  const dailyNotes = useDailyNotesStore()
  const reservedWidth = computed(() => ACTIVITY_BAR_WIDTH + dailyNotes.effectiveWidth)

  const mainView = ref<MainView>('editor')
  // Project slug the kanban shows; null shows all projects.
  const kanbanProject = ref<string | null>(null)
  // File shown by the full-area viewer (PDFs and drawings opened from the explorer or a link).
  const viewer = ref<{ kind: ViewerKind; file: string } | null>(null)

  const currentFileProject = (): string | null => {
    const markdown = useEditorStore().currentFile?.markdown
    const project = markdown ? parse(markdown)?.project : null
    return typeof project === 'string' && project ? project : null
  }

  function OPEN_KANBAN(project?: string | null): void {
    kanbanProject.value = project ?? currentFileProject() ?? kanbanProject.value
    mainView.value = 'kanban'
  }

  function CLOSE_KANBAN(): void {
    mainView.value = 'editor'
  }

  function TOGGLE_KANBAN(): void {
    if (mainView.value === 'kanban') CLOSE_KANBAN()
    else OPEN_KANBAN()
  }

  function OPEN_VIEWER(kind: ViewerKind, file: string): void {
    viewer.value = { kind, file }
    mainView.value = 'viewer'
  }

  function CLOSE_VIEWER(): void {
    if (mainView.value === 'viewer') mainView.value = 'editor'
  }

  /** The terminal covers the whole window below the title bar; closing returns to the editor. */
  function TOGGLE_TERMINAL(): void {
    mainView.value = mainView.value === 'terminal' ? 'editor' : 'terminal'
  }

  return { reservedWidth, mainView, kanbanProject, viewer, OPEN_KANBAN, CLOSE_KANBAN, TOGGLE_KANBAN, TOGGLE_TERMINAL, OPEN_VIEWER, CLOSE_VIEWER }
})
