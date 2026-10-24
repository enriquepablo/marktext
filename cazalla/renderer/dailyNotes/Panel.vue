<template>
  <div
    v-show="store.visible"
    class="daily-notes-panel"
    :style="{ width: `${viewWidth}px` }"
  >
    <div
      ref="dragBar"
      class="dn-drag-bar"
    />
    <div class="dn-header">
      <span class="dn-title">{{ t('dailyNotes.title') }}</span>
      <button
        class="dn-today"
        :disabled="!store.contentFolder"
        @click="store.GO_TODAY()"
      >
        {{ t('dailyNotes.today') }}
      </button>
    </div>
    <div
      v-if="!store.contentFolder"
      class="dn-hint"
    >
      <p>{{ t('dailyNotes.noContentFolder') }}</p>
      <button
        class="dn-today"
        @click="openPreferences"
      >
        {{ t('dailyNotes.openPreferences') }}
      </button>
    </div>
    <template v-else>
      <div
        class="dn-top"
        :style="{ flexBasis: `${splitRatio * 100}%` }"
      >
        <calendar />
      </div>
      <div
        class="dn-split"
        @mousedown="startSplit"
      />
      <div class="dn-bottom">
        <note-editor v-if="store.notePath" />
        <p
          v-else
          class="dn-hint"
        >
          {{ t('dailyNotes.selectDay') }}
        </p>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDailyNotesStore } from './store'
import { registerDailyNotesI18n } from './i18n'
import Calendar from './Calendar.vue'
import NoteEditor from './NoteEditor.vue'

registerDailyNotesI18n()
const { t } = useI18n()
const store = useDailyNotesStore()
store.LISTEN()

const SPLIT_KEY = 'daily-notes-split'
const readSplit = (): number => {
  try {
    const n = Number(localStorage.getItem(SPLIT_KEY))
    return n > 0.1 && n < 0.9 ? n : 0.4
  } catch {
    return 0.4
  }
}

const dragBar = ref<HTMLElement | null>(null)
const viewWidth = ref(store.width)
const splitRatio = ref(readSplit())
watch(() => store.width, (w) => (viewWidth.value = w))

const openPreferences = (): void => window.electron.ipcRenderer.send('mt::open-setting-window')

// Width drag on the left edge: the panel grows when the pointer moves left.
let stopDragging: (() => void) | null = null
onMounted(() => {
  const el = dragBar.value
  if (!el) return
  let startX = 0
  let startWidth = 0
  let current = 0
  const move = (e: MouseEvent): void => {
    current = startWidth + (startX - e.clientX)
    viewWidth.value = Math.max(current, 280)
  }
  const up = (): void => {
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
    store.SET_WIDTH(current)
  }
  const down = (e: MouseEvent): void => {
    startX = e.clientX
    startWidth = store.width
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup', up)
  }
  el.addEventListener('mousedown', down)
  stopDragging = () => {
    el.removeEventListener('mousedown', down)
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
  }
})
onUnmounted(() => stopDragging?.())

const startSplit = (e: MouseEvent): void => {
  const panel = (e.currentTarget as HTMLElement).parentElement
  if (!panel) return
  const rect = panel.getBoundingClientRect()
  const header = panel.querySelector('.dn-header')?.getBoundingClientRect().height ?? 0
  const move = (ev: MouseEvent): void => {
    const ratio = (ev.clientY - rect.top - header) / (rect.height - header)
    splitRatio.value = Math.min(0.9, Math.max(0.1, ratio))
  }
  const up = (): void => {
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
    try {
      localStorage.setItem(SPLIT_KEY, String(splitRatio.value))
    } catch {
      /* storage unavailable */
    }
  }
  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
}
</script>

<style scoped>
.daily-notes-panel {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100vh;
  box-sizing: border-box;
  /* The upstream title bar is fixed across the window; its controls sit above this panel. */
  padding-top: var(--titleBarHeight);
  flex-shrink: 0;
  background: var(--sideBarBgColor);
  color: var(--sideBarColor);
  border-left: 1px solid var(--itemBgColor);
  overflow: hidden;
}
.dn-drag-bar {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 3px;
  cursor: col-resize;
  -webkit-app-region: no-drag;
  z-index: 1;
}
.dn-drag-bar:hover {
  border-left: 2px solid var(--iconColor);
}
.dn-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px 4px;
}
.dn-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--sideBarTitleColor);
}
.dn-today {
  background: transparent;
  border: 1px solid var(--itemBgColor);
  border-radius: 4px;
  color: inherit;
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  padding: 2px 8px;
}
.dn-today:hover:not(:disabled) {
  background: var(--sideBarItemHoverBgColor);
}
.dn-today:disabled {
  opacity: 0.5;
  cursor: default;
}
.dn-hint {
  padding: 12px;
  font-size: 13px;
  line-height: 1.5;
  opacity: 0.8;
}
.dn-top {
  flex: 0 0 40%;
  min-height: 120px;
  overflow: auto;
}
.dn-split {
  height: 5px;
  cursor: row-resize;
  background: var(--itemBgColor);
}
.dn-split:hover {
  background: var(--iconColor);
}
.dn-bottom {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
</style>
