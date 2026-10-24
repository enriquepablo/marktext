import { computed, type ComputedRef } from 'vue'
import { usePreferencesStore } from '@/store/preferences'

/** The vault root: the startup default directory preference, or null when unset. */
export const useContentFolder = (): ComputedRef<string | null> => {
  const preferencesStore = usePreferencesStore()
  return computed(() => preferencesStore.defaultDirectoryToOpen || null)
}
