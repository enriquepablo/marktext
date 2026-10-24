<template>
  <div class="cazalla-terminal-overlay">
    <terminal-pane
      v-if="contentFolder"
      id="terminal-overlay"
      :file="contentFolder"
      overlay
      @close="layout.TOGGLE_TERMINAL()"
    />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted } from 'vue'
import { useContentFolder } from '../core/contentFolder'
import { useCazallaLayoutStore } from '../core/layout'
import TerminalPane from './TerminalPane.vue'

const layout = useCazallaLayoutStore()
const contentFolder = useContentFolder()

// Escape closes the overlay unless lazygit itself has the keyboard (xterm swallows keys it handles).
const onKey = (e: KeyboardEvent): void => {
  if (e.key === 'Escape' && (e.target as HTMLElement | null)?.closest('.xterm') === null) layout.TOGGLE_TERMINAL()
}
onMounted(() => document.addEventListener('keydown', onKey))
onBeforeUnmount(() => document.removeEventListener('keydown', onKey))
</script>

<style scoped>
.cazalla-terminal-overlay {
  position: fixed;
  top: var(--titleBarHeight);
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  display: flex;
  background: var(--editorBgColor);
}
.cazalla-terminal-overlay > * {
  flex: 1;
  min-width: 0;
}
</style>
