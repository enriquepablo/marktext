<template>
  <div
    class="cazalla-terminal-pane"
    :class="{ focused }"
    @mousedown="panes.FOCUS(id)"
  >
    <div class="pane-header">
      <span
        class="pane-file"
        :title="file"
      >{{ t('cazalla.terminal.title') }} — {{ name }}</span>
      <button
        v-if="exited"
        type="button"
        class="plain-button pane-button"
        @click.stop="start"
      >
        {{ t('cazalla.terminal.restart') }}
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
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { X } from 'lucide-vue-next'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { storeToRefs } from 'pinia'
import { usePreferencesStore } from '@/store/preferences'
import { isDarkThemeId } from 'common/theme'
import { basename } from '../core/fs'
import { usePaneStore } from '../panes/store'

// Mirror cazalla/main/terminal.ts; main and renderer bundles do not share modules.
const TERM_OPEN = 'mt::cazalla-term-open'
const TERM_INPUT = 'mt::cazalla-term-input'
const TERM_RESIZE = 'mt::cazalla-term-resize'
const TERM_CLOSE = 'mt::cazalla-term-close'
const TERM_DATA = 'mt::cazalla-term-data'
const TERM_EXIT = 'mt::cazalla-term-exit'

// `file` is the working directory the program runs in. With `overlay`, closing is the host's business.
const props = defineProps<{ id: string; file: string; overlay?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const close = (): void => {
  if (props.overlay) emit('close')
  else panes.CLOSE(props.id)
}
const { t } = useI18n()
const panes = usePaneStore()
const { theme, codeFontFamily, codeFontSize } = storeToRefs(usePreferencesStore())

const host = ref<HTMLElement | null>(null)
const error = ref('')
const exited = ref(false)
const focused = computed(() => panes.focusedId === props.id)
const name = computed(() => basename(props.file))

let term: Terminal | null = null
let fit: FitAddon | null = null
let observer: ResizeObserver | null = null
const ipc = window.electron.ipcRenderer

const sendResize = (): void => {
  if (!term) return
  fit?.fit()
  ipc.send(TERM_RESIZE, props.id, term.cols, term.rows)
}

const start = async(): Promise<void> => {
  if (!term) return
  error.value = ''
  exited.value = false
  term.clear()
  fit?.fit()
  const result = (await ipc.invoke(TERM_OPEN, { id: props.id, cwd: props.file, cols: term.cols, rows: term.rows })) as { ok: boolean; error?: string }
  if (!result.ok) {
    error.value = t('cazalla.terminal.failed', { error: result.error ?? '' })
    exited.value = true
  }
}

const dark = (): boolean => isDarkThemeId(theme.value)

onMounted(() => {
  const el = host.value
  if (!el) return
  term = new Terminal({
    fontFamily: codeFontFamily.value || 'monospace',
    fontSize: codeFontSize.value || 13,
    cursorBlink: true,
    allowProposedApi: true,
    theme: dark() ? { background: '#1e1e1e', foreground: '#d4d4d4' } : { background: '#ffffff', foreground: '#1f1f1f', cursor: '#1f1f1f' }
  })
  fit = new FitAddon()
  term.loadAddon(fit)
  term.open(el)
  term.onData((data) => ipc.send(TERM_INPUT, props.id, data))
  observer = new ResizeObserver(sendResize)
  observer.observe(el)
  void start()
})

const stopData = ipc.on(TERM_DATA, (_e, payload) => {
  const p = payload as { id: string; data: string }
  if (p.id === props.id) term?.write(p.data)
})
const stopExit = ipc.on(TERM_EXIT, (_e, payload) => {
  const p = payload as { id: string; code: number }
  if (p.id !== props.id) return
  exited.value = true
  term?.write(`\r\n${t('cazalla.terminal.exited', { code: p.code })}\r\n`)
})

onBeforeUnmount(() => {
  stopData()
  stopExit()
  observer?.disconnect()
  ipc.send(TERM_CLOSE, props.id)
  term?.dispose()
  term = null
})
</script>

<style scoped>
.cazalla-terminal-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  min-height: 0;
  background: var(--editorBgColor);
  border-left: 2px solid transparent;
}
.cazalla-terminal-pane.focused {
  border-left-color: var(--themeColor);
}
.pane-header {
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
  padding: 4px;
}
.pane-body :deep(.xterm) {
  height: 100%;
}
</style>
