<template>
  <div
    v-if="node.kind === 'split'"
    class="cazalla-split"
    :class="node.direction"
  >
    <div
      class="split-child"
      :style="childStyle(node.ratio)"
    >
      <pane-layout :node="node.children[0]">
        <slot />
      </pane-layout>
    </div>
    <div
      class="split-divider"
      @mousedown.prevent="startDrag($event, node)"
    />
    <div
      class="split-child"
      :style="childStyle(1 - node.ratio)"
    >
      <pane-layout :node="node.children[1]">
        <slot />
      </pane-layout>
    </div>
  </div>
  <div
    v-else-if="node.kind === 'primary'"
    class="cazalla-primary"
    @mousedown="panes.FOCUS('primary')"
  >
    <slot />
  </div>
  <file-pane
    v-else
    :id="node.id"
    :file="node.file"
  />
</template>

<script setup lang="ts">
import FilePane from './FilePane.vue'
import { usePaneStore } from './store'
import type { PaneNode, Split } from './tree'

defineOptions({ name: 'PaneLayout' })
defineProps<{ node: PaneNode }>()
const panes = usePaneStore()

const childStyle = (share: number): Record<string, string> => ({ flexBasis: `${share * 100}%` })

const startDrag = (event: MouseEvent, split: Split): void => {
  const container = (event.currentTarget as HTMLElement).parentElement
  if (!container) return
  const rect = container.getBoundingClientRect()
  const move = (e: MouseEvent): void => {
    const ratio =
      split.direction === 'vertical' ? (e.clientX - rect.left) / rect.width : (e.clientY - rect.top) / rect.height
    panes.SET_RATIO(split.id, ratio)
  }
  const up = (): void => {
    document.removeEventListener('mousemove', move)
    document.removeEventListener('mouseup', up)
  }
  document.addEventListener('mousemove', move)
  document.addEventListener('mouseup', up)
}
</script>

<style scoped>
.cazalla-split {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
  width: 100%;
}
.cazalla-split.vertical {
  flex-direction: row;
}
.cazalla-split.horizontal {
  flex-direction: column;
}
.split-child {
  flex: 0 1 50%;
  min-width: 0;
  min-height: 0;
  display: flex;
}
.split-child > * {
  flex: 1;
  min-width: 0;
  min-height: 0;
}
.split-divider {
  flex: 0 0 5px;
  background: var(--itemBgColor);
}
.split-divider:hover {
  background: var(--iconColor);
}
.vertical > .split-divider {
  cursor: col-resize;
}
.horizontal > .split-divider {
  cursor: row-resize;
}
.cazalla-primary {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
}
</style>
