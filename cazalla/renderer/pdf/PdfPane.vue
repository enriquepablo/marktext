<template>
  <div
    class="cazalla-pdf-pane"
    :class="{ focused }"
    @mousedown="panes.FOCUS(id)"
  >
    <div class="pane-header">
      <span
        class="pane-file"
        :title="file"
      >{{ name }}</span>
      <button
        type="button"
        class="plain-button pane-button"
        :aria-label="t('cazalla.pdf.zoomOut')"
        @click.stop="zoom(-0.1)"
      >
        <ZoomOut
          :size="14"
          aria-hidden="true"
        />
      </button>
      <span class="pane-zoom">{{ Math.round(scale * 100) }}%</span>
      <button
        type="button"
        class="plain-button pane-button"
        :aria-label="t('cazalla.pdf.zoomIn')"
        @click.stop="zoom(0.1)"
      >
        <ZoomIn
          :size="14"
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        class="plain-button pane-button pane-close"
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
      ref="scroller"
      class="pane-body"
    >
      <vue-pdf-embed
        v-if="source"
        :source="source"
        :width="pageWidth"
        text-layer
        @loading-failed="onError"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, shallowRef, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { X, ZoomIn, ZoomOut } from 'lucide-vue-next'
import VuePdfEmbed from 'vue-pdf-embed'
import 'vue-pdf-embed/dist/styles/textLayer.css'
import { basename, exists } from '../core/fs'
import { usePaneStore } from '../panes/store'

const props = defineProps<{ id: string; file: string }>()
const { t } = useI18n()
const panes = usePaneStore()

const focused = computed(() => panes.focusedId === props.id)
const name = computed(() => basename(props.file))
const source = shallowRef<Uint8Array | null>(null)
const error = ref('')
const scale = ref(1)
const scroller = ref<HTMLElement | null>(null)
const pageWidth = computed(() => Math.max(200, Math.round(((scroller.value?.clientWidth ?? 600) - 32) * scale.value)))

const zoom = (delta: number): void => {
  scale.value = Math.min(3, Math.max(0.3, Math.round((scale.value + delta) * 10) / 10))
}

const load = async(): Promise<void> => {
  error.value = ''
  source.value = null
  if (!(await exists(props.file))) {
    error.value = t('cazalla.pdf.missing', { file: props.file })
    return
  }
  const data = await window.fileUtils.readFile(props.file)
  // A fresh copy: pdf.js transfers the buffer to its worker and detaches it.
  source.value = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data)
}

const onError = (): void => {
  error.value = t('cazalla.pdf.loadError')
}

onMounted(load)
watch(() => props.file, load)
</script>

<style scoped>
.cazalla-pdf-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 0;
  min-height: 0;
  background: var(--editorBgColor);
  border-left: 2px solid transparent;
}
.cazalla-pdf-pane.focused {
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
.pane-zoom {
  min-width: 40px;
  text-align: center;
  opacity: 0.8;
}
.pane-button {
  display: flex;
  padding: 2px;
  border-radius: 4px;
  color: var(--iconColor);
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
  overflow: auto;
  padding: 16px;
  background: var(--sideBarBgColor);
}
.pane-body :deep(.vue-pdf-embed > div) {
  margin: 0 auto 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}
</style>
