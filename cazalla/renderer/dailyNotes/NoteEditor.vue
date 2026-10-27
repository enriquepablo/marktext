<template>
  <div class="dn-note">
    <h2 class="dn-note-title">
      {{ store.selectedKey }}
    </h2>
    <div
      ref="container"
      class="dn-note-editor"
    />
  </div>
</template>

<script setup lang="ts">
import { markRaw, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { Muya, type IMuyaOptions } from '@muyajs/core'
import { usePreferencesStore } from '@/store/preferences'
import { useEditorStore } from '@/store/editor'
import { getMuyaLocale } from '@/util/muyaLocale'
import { DEFAULT_CODE_FONT_FAMILY, DEFAULT_EDITOR_FONT_FAMILY } from '@/config'
import { isDarkThemeId } from 'common/theme'
import { useDailyNotesStore } from './store'
import { registerPaneMuya, unregisterPaneMuya } from '../editor/registry'
import { registerMuyaPlugins } from '../editor/plugins'

const store = useDailyNotesStore()
const preferencesStore = usePreferencesStore()
const {
  language,
  fontSize,
  lineHeight,
  editorFontFamily,
  codeFontSize,
  codeFontFamily,
  tabSize,
  theme,
  spellcheckerEnabled
} = storeToRefs(preferencesStore)

const container = ref<HTMLElement | null>(null)
const editor = shallowRef<Muya | null>(null)

const resolveEditorFont = (family: string): string =>
  family ? `${family}, ${DEFAULT_EDITOR_FONT_FAMILY}` : DEFAULT_EDITOR_FONT_FAMILY
const resolveCodeFont = (family: string): string => `${family}, ${DEFAULT_CODE_FONT_FAMILY}`

const themeOptions = (): Partial<IMuyaOptions> =>
  isDarkThemeId(theme.value)
    ? { mermaidTheme: 'dark', vegaTheme: 'dark' }
    : { mermaidTheme: 'default', vegaTheme: 'latimes' }

onMounted(() => {
  const el = container.value
  if (!el) return
  const options: Partial<IMuyaOptions> = {
    markdown: store.markdown,
    // Daily notes always carry YAML frontmatter, whatever the user's default style.
    frontmatterType: '-',
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
  muya.on('json-change', () => store.SAVE_NOTE(muya.getMarkdown()))
  muya.on('blur', () => void store.FLUSH_SAVE())
  muya.on('format-click', ({ event, formatType, data }: { event: MouseEvent; formatType: string; data: { href: string } }) => {
    if (formatType === 'link' && (event.ctrlKey || event.metaKey) && store.notePath) {
      useEditorStore().FORMAT_LINK_CLICK({ data, dirname: window.path.dirname(store.notePath) })
    }
  })
  editor.value = muya
  // Registered so `[[` and the date dialog work here; the directory follows the selected day.
  registerPaneMuya('daily-notes', muya, () => (store.notePath ? window.path.dirname(store.notePath) : null))
})

// Reload only when another file is selected; `markdown` itself is not watched so saves do not re-render.
watch(
  () => store.notePath,
  () => {
    editor.value?.setContent(store.markdown)
  }
)

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
watch(spellcheckerEnabled, (value) => editor.value?.setOptions({ spellcheckEnabled: value }))

onBeforeUnmount(() => {
  void store.FLUSH_SAVE()
  unregisterPaneMuya('daily-notes')
  editor.value?.destroy()
  editor.value = null
})
</script>

<style scoped>
.dn-note {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--editorBgColor);
}
.dn-note-title {
  margin: 0;
  padding: 8px 16px 0;
  font-size: 15px;
  font-weight: 600;
  color: var(--editorColor);
}
.dn-note-editor {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
/* The frontmatter never changes by hand here; the heading above carries the date. */
.dn-note-editor :deep(pre.mu-frontmatter) {
  display: none;
}
/* The engine's default page width and margins are sized for the main editor. */
.dn-note-editor :deep(.mu-container) {
  --editor-area-width: 100%;
  max-width: 100%;
  padding: 8px 16px 48px;
}
</style>
