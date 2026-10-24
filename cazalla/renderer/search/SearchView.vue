<template>
  <div class="cazalla-search">
    <div class="search-header">
      <button
        type="button"
        class="plain-button back-button"
        :aria-label="t('cazalla.events.back')"
        @click="emit('back')"
      >
        <ArrowLeft
          :size="16"
          aria-hidden="true"
        />
      </button>
      <el-input
        ref="input"
        v-model="query"
        clearable
        :placeholder="t('cazalla.search.placeholder')"
        @keyup.enter="run"
      />
      <button
        type="button"
        class="plain-button back-button"
        :title="t('cazalla.search.rebuild')"
        :disabled="search.indexing"
        @click="search.REFRESH(true)"
      >
        <RefreshCw
          :size="14"
          :class="{ spinning: search.indexing }"
          aria-hidden="true"
        />
      </button>
    </div>
    <div class="search-filters">
      <el-select
        v-model="category"
        size="small"
        clearable
        :placeholder="t('cazalla.search.allTypes')"
      >
        <el-option
          v-for="c in CATEGORIES"
          :key="c"
          :value="c"
          :label="t(`cazalla.search.types.${c}`)"
        />
      </el-select>
      <span class="search-count">{{ t('cazalla.search.indexed', { n: search.count }) }}</span>
    </div>
    <ul class="search-results">
      <li
        v-for="hit in hits"
        :key="hit.id"
        @click="open(hit)"
      >
        <div class="hit-title">
          <span>{{ hit.title }}</span>
          <span class="hit-category">{{ hit.category }}</span>
        </div>
        <div
          class="hit-excerpt"
          v-html="highlight(hit.excerpt, hit.terms)"
        />
        <div class="hit-path">{{ relative(hit.id) }}</div>
      </li>
      <li
        v-if="query && hits.length === 0 && search.ready"
        class="search-empty"
      >
        {{ t('cazalla.search.noResults') }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { ArrowLeft, RefreshCw } from 'lucide-vue-next'
import { useEditorStore } from '@/store/editor'
import { usePreferencesStore } from '@/store/preferences'
import { useContentFolder } from '../core/contentFolder'
import { paneKindFor } from '../panes/linkRouter'
import { usePaneStore } from '../panes/store'
import { useSearchStore, type SearchHit } from './store'

const emit = defineEmits<{ back: [] }>()
const { t } = useI18n()
const search = useSearchStore()
const editorStore = useEditorStore()
const preferencesStore = usePreferencesStore()
const { tabs, currentFile } = storeToRefs(editorStore)
const contentFolder = useContentFolder()

const CATEGORIES = ['note', 'task', 'webpage', 'daily', 'markdown', 'pdf', 'drawing']
const input = ref<{ focus: () => void } | null>(null)
const query = ref('')
const category = ref<string | null>(null)
const hits = ref<SearchHit[]>([])

let debounce: ReturnType<typeof setTimeout> | null = null
const run = (): void => {
  hits.value = search.SEARCH(query.value, category.value || null)
}
watch([query, category, () => search.count], () => {
  if (debounce) clearTimeout(debounce)
  debounce = setTimeout(run, 150)
})
onMounted(() => input.value?.focus())

const relative = computed(() => (file: string) => (contentFolder.value ? file.slice(contentFolder.value.length + 1) : file))

const escapeHtml = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)
const highlight = (text: string, terms: string[]): string => {
  let out = escapeHtml(text)
  for (const term of terms.filter((x) => x.length > 1)) {
    const re = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi')
    out = out.replace(re, '<mark>$1</mark>')
  }
  return out
}

const open = (hit: SearchHit): void => {
  const file = String(hit.id)
  const kind = paneKindFor(file)
  if (kind) return usePaneStore().OPEN_IN_PANE(kind, file)
  const opened = tabs.value.find((f) => window.fileUtils.isSamePathSync(f.pathname, file))
  if (opened) {
    editorStore.CANCEL_PENDING_SIDEBAR_OPEN()
    if (currentFile.value?.pathname !== opened.pathname) editorStore.UPDATE_CURRENT_FILE(opened)
    return
  }
  const preview = preferencesStore.openFilesInPreviewMode
  const requestId = editorStore.BEGIN_SIDEBAR_OPEN(file, preview)
  if (requestId == null) return
  window.electron.ipcRenderer.send('mt::open-file', file, { preview, requestId })
}
</script>

<style scoped>
.cazalla-search {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: var(--sideBarColor);
}
.search-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
}
.back-button {
  display: flex;
  padding: 4px;
  border-radius: 4px;
  color: var(--sideBarIconColor);
}
.back-button:hover {
  background: var(--sideBarItemHoverBgColor);
}
.spinning {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
.search-filters {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 8px 6px;
  font-size: 11px;
}
.search-filters .el-select {
  width: 140px;
}
.search-count {
  opacity: 0.6;
}
.search-results {
  flex: 1;
  min-height: 0;
  overflow: auto;
  list-style: none;
  margin: 0;
  padding: 0 4px;
}
.search-results li {
  padding: 6px 8px;
  border-radius: 4px;
  cursor: pointer;
}
.search-results li:hover {
  background: var(--sideBarItemHoverBgColor);
}
.hit-title {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
  color: var(--sideBarTitleColor);
}
.hit-category {
  font-size: 10px;
  text-transform: uppercase;
  opacity: 0.6;
}
.hit-excerpt {
  font-size: 12px;
  opacity: 0.85;
  margin-top: 2px;
}
.hit-excerpt :deep(mark) {
  background: var(--themeColor20);
  color: inherit;
}
.hit-path {
  font-size: 10px;
  opacity: 0.5;
  margin-top: 2px;
}
.search-empty {
  opacity: 0.6;
  cursor: default;
}
</style>
