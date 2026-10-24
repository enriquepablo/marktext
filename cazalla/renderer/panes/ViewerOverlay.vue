<template>
  <div class="cazalla-viewer-overlay">
    <drawing-pane
      v-if="viewer?.kind === 'drawing'"
      id="viewer-overlay"
      :file="viewer.file"
      overlay
      @close="layout.CLOSE_VIEWER()"
    />
    <pdf-pane
      v-else-if="viewer"
      id="viewer-overlay"
      :file="viewer.file"
      overlay
      @close="layout.CLOSE_VIEWER()"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted } from 'vue'
import { useCazallaLayoutStore } from '../core/layout'
import DrawingPane from '../drawings/DrawingPane.vue'
import PdfPane from '../pdf/PdfPane.vue'

const layout = useCazallaLayoutStore()
const viewer = computed(() => layout.viewer)

const onKey = (e: KeyboardEvent): void => {
  const target = e.target as HTMLElement | null
  if (e.key === 'Escape' && !target?.closest('.excalidraw')) layout.CLOSE_VIEWER()
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<style scoped>
/* Fills the editor column (`.editor-middle` is positioned) below the fixed title bar, whose
   drag region would swallow clicks on anything drawn under it; sidebar and calendar stay visible. */
.cazalla-viewer-overlay {
  position: absolute;
  inset: var(--titleBarHeight) 0 0 0;
  z-index: 5;
  display: flex;
  background: var(--editorBgColor);
}
.cazalla-viewer-overlay > * {
  flex: 1;
  min-width: 0;
}
</style>
