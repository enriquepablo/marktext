import { computed, type ComputedRef } from 'vue'
import { usePreferencesStore } from '@/store/preferences'

// Without trailing separators, so prefix tests and tree keys agree with joined paths.
const trim = (p: string): string => (p.length > 1 ? p.replace(/[\\/]+$/, '') : p)

/** The vault root: the startup default directory preference, or null when unset. */
export const useContentFolder = (): ComputedRef<string | null> => {
  const preferencesStore = usePreferencesStore()
  return computed(() => (preferencesStore.defaultDirectoryToOpen ? trim(preferencesStore.defaultDirectoryToOpen) : null))
}
