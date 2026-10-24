<template>
  <div
    class="cazalla-drawing-pane"
    :class="{ focused }"
    @mousedown="panes.FOCUS(id)"
  >
    <div class="pane-header">
      <span
        class="pane-file"
        :title="file"
      >{{ name }}</span>
      <span
        v-if="dirty"
        class="pane-dirty"
      >●</span>
      <button
        type="button"
        class="plain-button pane-button"
        :title="t('cazalla.drawing.exportPng')"
        @click.stop="exportPng"
      >
        PNG
      </button>
      <button
        type="button"
        class="plain-button pane-button"
        :title="t('cazalla.drawing.exportSvg')"
        @click.stop="exportSvg"
      >
        SVG
      </button>
      <button
        type="button"
        class="plain-button pane-button"
        :aria-label="t('cazalla.panes.close')"
        @click.stop="close"
      >
        <X
          :size="14"
          aria-hidden="true"
        />
      </button>
    </div>
    <p
      v-if="error"
      class="pane-error"
    >
      {{ error }}
    </p>
    <div
      ref="host"
      class="pane-body"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { X } from 'lucide-vue-next'
import { createElement } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { Excalidraw, exportToBlob, exportToSvg, restore, serializeAsJSON } from '@excalidraw/excalidraw'
import type { ExcalidrawImperativeAPI, BinaryFiles, AppState } from '@excalidraw/excalidraw/types'
import type { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types'
import '@excalidraw/excalidraw/index.css'
import notice from '@/services/notification'
import { usePreferencesStore } from '@/store/preferences'
import { isDarkThemeId } from 'common/theme'
import { basename, exists, readText, writeBytes, writeText } from '../core/fs'
import { usePaneStore } from '../panes/store'

const props = defineProps<{ id: string; file: string; overlay?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const close = (): void => {
  if (props.overlay) emit('close')
  else panes.CLOSE(props.id)
}
const { t } = useI18n()
const panes = usePaneStore()
const { theme, language } = storeToRefs(usePreferencesStore())

const SAVE_DELAY_MS = 1000
const host = ref<HTMLElement | null>(null)
const error = ref('')
const dirty = ref(false)
const focused = computed(() => panes.focusedId === props.id)
const name = computed(() => basename(props.file))

let root: Root | null = null
let api: ExcalidrawImperativeAPI | null = null
let saveTimer: ReturnType<typeof setTimeout> | null = null
let lastSaved = ''

const langCode = (): string => (language.value === 'es' ? 'es-ES' : 'en')
const themeName = (): 'dark' | 'light' => (isDarkThemeId(theme.value) ? 'dark' : 'light')

const snapshot = (): string | null => {
  if (!api) return null
  return serializeAsJSON(api.getSceneElements(), api.getAppState(), api.getFiles(), 'local')
}

const flush = async(): Promise<void> => {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  const json = snapshot()
  if (json === null || json === lastSaved) {
    dirty.value = false
    return
  }
  await writeText(props.file, json + '\n')
  lastSaved = json
  dirty.value = false
}

const onChange = (): void => {
  const json = snapshot()
  if (json === null || json === lastSaved) return
  dirty.value = true
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void flush(), SAVE_DELAY_MS)
}

const loadScene = async(): Promise<{ elements: OrderedExcalidrawElement[]; appState: Partial<AppState>; files: BinaryFiles }> => {
  error.value = ''
  if (!(await exists(props.file))) {
    error.value = t('cazalla.drawing.missing', { file: props.file })
    return { elements: [], appState: {}, files: {} }
  }
  try {
    const raw = JSON.parse(await readText(props.file))
    const restored = restore({ elements: raw.elements ?? [], appState: raw.appState ?? {}, files: raw.files ?? {} }, null, null)
    return { elements: restored.elements, appState: restored.appState, files: restored.files }
  } catch {
    error.value = t('cazalla.drawing.loadError')
    return { elements: [], appState: {}, files: {} }
  }
}

const render = async(): Promise<void> => {
  const el = host.value
  if (!el) return
  const scene = await loadScene()
  root?.unmount()
  api = null
  root = createRoot(el)
  root.render(
    createElement(Excalidraw, {
      initialData: { elements: scene.elements, appState: { ...scene.appState, collaborators: new Map() }, files: scene.files },
      theme: themeName(),
      langCode: langCode(),
      excalidrawAPI: (instance: ExcalidrawImperativeAPI) => {
        api = instance
        lastSaved = snapshot() ?? ''
      },
      onChange
    })
  )
}

const exportName = (ext: string): string => props.file.replace(/\.excalidraw$/i, '') + ext

const exportPng = async(): Promise<void> => {
  if (!api) return
  const blob = await exportToBlob({ elements: api.getSceneElements(), appState: api.getAppState(), files: api.getFiles(), mimeType: 'image/png' })
  const target = exportName('.png')
  await writeBytes(target, new Uint8Array(await blob.arrayBuffer()))
  notice.notify({ title: t('cazalla.drawing.title'), type: 'primary', message: t('cazalla.billing.written', { file: target }) })
}

const exportSvg = async(): Promise<void> => {
  if (!api) return
  const svg = await exportToSvg({ elements: api.getSceneElements(), appState: api.getAppState(), files: api.getFiles() })
  const target = exportName('.svg')
  await writeText(target, svg.outerHTML)
  notice.notify({ title: t('cazalla.drawing.title'), type: 'primary', message: t('cazalla.billing.written', { file: target }) })
}

onMounted(render)
watch(() => props.file, async() => {
  await flush()
  await render()
})
watch([theme, language], () => void render())

onBeforeUnmount(() => {
  void flush()
  root?.unmount()
  root = null
  api = null
})
</script>

<style scoped>
.cazalla-drawing-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  min-height: 0;
  background: var(--editorBgColor);
  border-left: 2px solid transparent;
}
.cazalla-drawing-pane.focused {
  border-left-color: var(--themeColor);
}
.pane-header {
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  font-size: 12px;
  color: var(--sideBarColor);
  background: var(--sideBarBgColor);
  border-bottom: 1px solid var(--itemBgColor);
}
.pane-file {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pane-dirty {
  color: var(--themeColor);
}
.pane-button {
  display: flex;
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--iconColor);
  font-size: 11px;
}
.pane-button:hover {
  background: var(--sideBarItemHoverBgColor);
}
.pane-error {
  margin: 0;
  padding: 8px;
  font-size: 13px;
  color: var(--el-color-danger);
}
.pane-body {
  flex: 1;
  min-height: 0;
}
</style>
