<template>
  <div
    class="cazalla-file-pane"
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
        class="plain-button pane-close"
        :aria-label="t('cazalla.panes.close')"
        @click.stop="panes.CLOSE(id)"
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
      ref="container"
      class="pane-editor"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, markRaw, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { storeToRefs } from 'pinia'
import { X } from 'lucide-vue-next'
import { Muya, type IMuyaOptions } from '@muyajs/core'
import { usePreferencesStore } from '@/store/preferences'
import { useEditorStore } from '@/store/editor'
import { getMuyaLocale } from '@/util/muyaLocale'
import { DEFAULT_CODE_FONT_FAMILY, DEFAULT_EDITOR_FONT_FAMILY } from '@/config'
import { isDarkThemeId } from 'common/theme'
import { basename, exists, readText, writeText } from '../core/fs'
import { usePaneStore } from './store'
import { registerPaneMuya, unregisterPaneMuya } from '../editor/registry'
import { registerMuyaPlugins } from '../editor/plugins'

const props = defineProps<{ id: string; file: string }>()
const { t } = useI18n()
const panes = usePaneStore()
const preferencesStore = usePreferencesStore()
const { language, fontSize, lineHeight, editorFontFamily, codeFontSize, codeFontFamily, tabSize, theme, spellcheckerEnabled } =
  storeToRefs(preferencesStore)

const SAVE_DELAY_MS = 1000
const container = ref<HTMLElement | null>(null)
const editor = shallowRef<Muya | null>(null)
const error = ref('')
const dirty = ref(false)
const focused = computed(() => panes.focusedId === props.id)
const name = computed(() => basename(props.file))

let saveTimer: ReturnType<typeof setTimeout> | null = null
let lastSaved = ''

const resolveEditorFont = (family: string): string =>
  family ? `${family}, ${DEFAULT_EDITOR_FONT_FAMILY}` : DEFAULT_EDITOR_FONT_FAMILY
const resolveCodeFont = (family: string): string => `${family}, ${DEFAULT_CODE_FONT_FAMILY}`
const themeOptions = (): Partial<IMuyaOptions> =>
  isDarkThemeId(theme.value) ? { mermaidTheme: 'dark', vegaTheme: 'dark' } : { mermaidTheme: 'default', vegaTheme: 'latimes' }

const flush = async(): Promise<void> => {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  }
  if (!dirty.value || !editor.value) return
  const markdown = editor.value.getMarkdown()
  await writeText(props.file, markdown)
  lastSaved = markdown
  dirty.value = false
}

const scheduleSave = (): void => {
  dirty.value = true
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void flush(), SAVE_DELAY_MS)
}

const load = async(): Promise<string> => {
  error.value = ''
  if (!(await exists(props.file))) {
    error.value = t('cazalla.panes.missing', { file: props.file })
    return ''
  }
  return readText(props.file)
}

onMounted(async() => {
  const el = container.value
  if (!el) return
  lastSaved = await load()
  const options: Partial<IMuyaOptions> = {
    markdown: lastSaved,
    locale: getMuyaLocale(language.value),
    fontSize: fontSize.value,
    lineHeight: lineHeight.value,
    editorFontFamily: resolveEditorFont(editorFontFamily.value),
    codeFontSize: codeFontSize.value,
    codeFontFamily: resolveCodeFont(codeFontFamily.value),
    tabSize: tabSize.value,
    spellcheckEnabled: spellcheckerEnabled.value,
    clipboardText: () => window.electron.clipboard.readText(),
    clipboardWriteText: window.electron.clipboard.writeText,
    ...themeOptions()
  }
  registerMuyaPlugins()
  const muya = markRaw(new Muya(el, options))
  muya.init({ focus: false })
  muya.on('json-change', () => {
    if (muya.getMarkdown() !== lastSaved) scheduleSave()
  })
  muya.on('focus', () => panes.FOCUS(props.id))
  muya.on('blur', () => void flush())
  muya.on('format-click', ({ event, formatType, data }: { event: MouseEvent; formatType: string; data: { href: string } }) => {
    if (formatType === 'link' && (event.ctrlKey || event.metaKey)) {
      useEditorStore().FORMAT_LINK_CLICK({ data, dirname: window.path.dirname(props.file) })
    }
  })
  editor.value = muya
  registerPaneMuya(props.id, muya, () => window.path.dirname(props.file))
})

// Another file assigned to this pane: save the old one, show the new one.
watch(
  () => props.file,
  async() => {
    await flush()
    lastSaved = await load()
    editor.value?.setContent(lastSaved)
  }
)

// External change to the file on disk, reported by the main watcher; only applied when nothing is pending.
const onTreeEvent = (_e: unknown, payload: unknown): void => {
  const p = payload as { type?: string; change?: { pathname?: string } }
  if (p?.type !== 'change' || p.change?.pathname !== props.file || dirty.value) return
  void load().then((text) => {
    if (text !== lastSaved) {
      lastSaved = text
      editor.value?.setContent(text)
    }
  })
}
const stopTreeEvents = window.electron.ipcRenderer.on('mt::update-object-tree', onTreeEvent)

watch([fontSize, lineHeight, editorFontFamily, codeFontSize, codeFontFamily], () => {
  editor.value?.setOptions({
    fontSize: fontSize.value,
    lineHeight: lineHeight.value,
    editorFontFamily: resolveEditorFont(editorFontFamily.value),
    codeFontSize: codeFontSize.value,
    codeFontFamily: resolveCodeFont(codeFontFamily.value)
  })
})
watch(theme, () => editor.value?.setOptions(themeOptions(), true))
watch(language, (value) => editor.value?.locale(getMuyaLocale(value)))

onBeforeUnmount(() => {
  stopTreeEvents()
  unregisterPaneMuya(props.id)
  void flush()
  editor.value?.destroy()
  editor.value = null
})
</script>

<style scoped>
.cazalla-file-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  min-height: 0;
  background: var(--editorBgColor);
  border-left: 2px solid transparent;
}
.cazalla-file-pane.focused {
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
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.pane-dirty {
  color: var(--themeColor);
}
.pane-close {
  margin-left: auto;
  display: flex;
  padding: 2px;
  border-radius: 4px;
  color: var(--iconColor);
}
.pane-close:hover {
  background: var(--sideBarItemHoverBgColor);
}
.pane-error {
  margin: 0;
  padding: 8px;
  font-size: 13px;
  color: var(--el-color-danger);
}
.pane-editor {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.pane-editor :deep(.mu-container) {
  --editor-area-width: 100%;
  max-width: 100%;
  padding: 8px 24px 48px;
}
</style>
