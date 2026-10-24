import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { useEditorStore } from '@/store/editor'
import { useDailyNotesStore } from '../dailyNotes/store'
import { parse } from './frontmatter'

export const ACTIVITY_BAR_WIDTH = 40

export type MainView = 'editor' | 'kanban'

/** Horizontal space the cazalla panels take, and which view fills the main area. */
export const useCazallaLayoutStore = defineStore('cazallaLayout', () => {
  const dailyNotes = useDailyNotesStore()
  const reservedWidth = computed(() => ACTIVITY_BAR_WIDTH + dailyNotes.effectiveWidth)

  const mainView = ref<MainView>('editor')
  // Project slug the kanban shows; null shows all projects.
  const kanbanProject = ref<string | null>(null)

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

  return { reservedWidth, mainView, kanbanProject, OPEN_KANBAN, CLOSE_KANBAN, TOGGLE_KANBAN }
})
