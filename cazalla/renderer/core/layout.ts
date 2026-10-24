import { computed } from 'vue'
import { defineStore } from 'pinia'
import { useDailyNotesStore } from '../dailyNotes/store'

export const ACTIVITY_BAR_WIDTH = 40

/** Horizontal space the cazalla panels take, subtracted from the editor's max width. */
export const useCazallaLayoutStore = defineStore('cazallaLayout', () => {
  const dailyNotes = useDailyNotesStore()
  const reservedWidth = computed(() => ACTIVITY_BAR_WIDTH + dailyNotes.effectiveWidth)
  return { reservedWidth }
})
