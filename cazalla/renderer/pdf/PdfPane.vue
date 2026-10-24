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
      <span
        v-if="pageCount"
        class="pane-zoom"
      >{{ pageCount }} p.</span>
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
      ref="scroller"
      class="pane-body"
    >
      <canvas
        v-for="n in pageCount"
        :key="n"
        :ref="(el) => setCanvas(n, el as HTMLCanvasElement | null)"
        class="pdf-page"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { X, ZoomIn, ZoomOut } from 'lucide-vue-next'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { basename, exists } from '../core/fs'
import { usePaneStore } from '../panes/store'
import { openPdf, readPdfBytes } from './pdfjs'

// With `overlay`, closing is the host's business.
const props = defineProps<{ id: string; file: string; overlay?: boolean }>()
const emit = defineEmits<{ close: [] }>()
const { t } = useI18n()
const panes = usePaneStore()

const focused = computed(() => panes.focusedId === props.id)
const name = computed(() => basename(props.file))
const error = ref('')
const scale = ref(1)
const pageCount = ref(0)
const scroller = ref<HTMLElement | null>(null)
const canvases = new Map<number, HTMLCanvasElement>()
const setCanvas = (n: number, el: HTMLCanvasElement | null): void => {
  if (el) canvases.set(n, el)
  else canvases.delete(n)
}

let task: ReturnType<typeof openPdf>['task'] | null = null
let doc: PDFDocumentProxy | null = null
let renderToken = 0

const close = (): void => {
  if (props.overlay) emit('close')
  else panes.CLOSE(props.id)
}

const zoom = (delta: number): void => {
  scale.value = Math.min(3, Math.max(0.3, Math.round((scale.value + delta) * 10) / 10))
}

// Pages are fitted to the pane width, then scaled by the zoom factor; pixel density follows the screen.
const renderPages = async(): Promise<void> => {
  if (!doc) return
  const token = ++renderToken
  const width = Math.max(200, (scroller.value?.clientWidth ?? 600) - 32) * scale.value
  const ratio = window.devicePixelRatio || 1
  for (let n = 1; n <= doc.numPages; n++) {
    if (token !== renderToken) return
    const canvas = canvases.get(n)
    if (!canvas) continue
    const page = await doc.getPage(n)
    const base = page.getViewport({ scale: 1 })
    // The pixel ratio goes into the viewport scale; pdf.js owns the context's
    // transform, so setting one here would compound with its own and flip the page.
    const cssScale = width / base.width
    const viewport = page.getViewport({ scale: cssScale * ratio })
    canvas.width = Math.floor(viewport.width)
    canvas.height = Math.floor(viewport.height)
    canvas.style.width = `${Math.floor(viewport.width / ratio)}px`
    canvas.style.height = `${Math.floor(viewport.height / ratio)}px`
    const ctx = canvas.getContext('2d')
    if (!ctx) continue
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    await page.render({ canvasContext: ctx, viewport }).promise
  }
}

const unload = async(): Promise<void> => {
  renderToken++
  doc = null
  pageCount.value = 0
  if (task) {
    const old = task
    task = null
    await old.destroy().catch(() => undefined)
  }
}

const load = async(): Promise<void> => {
  await unload()
  error.value = ''
  if (!(await exists(props.file))) {
    error.value = t('cazalla.pdf.missing', { file: props.file })
    return
  }
  try {
    const opened = openPdf(await readPdfBytes(props.file))
    task = opened.task
    doc = await opened.promise
    pageCount.value = doc.numPages
    await nextTick()
    await renderPages()
  } catch (err) {
    error.value = t('cazalla.pdf.loadError', { error: err instanceof Error ? err.message : String(err) })
  }
}

let observer: ResizeObserver | null = null
onMounted(() => {
  observer = new ResizeObserver(() => void renderPages())
  if (scroller.value) observer.observe(scroller.value)
  void load()
})
watch(() => props.file, () => void load())
watch(scale, () => void renderPages())
onBeforeUnmount(() => {
  observer?.disconnect()
  void unload()
})
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
  white-space: pre-wrap;
}
.pane-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 16px;
  background: var(--sideBarBgColor);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.pdf-page {
  display: block;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.3);
}
</style>
