<template>
  <div class="cazalla-events">
    <div class="events-header">
      <button
        type="button"
        class="plain-button back-button"
        :aria-label="t('cazalla.events.back')"
        @click="emit('back')"
      >
        <ArrowLeft
          :size="16"
          aria-hidden="true"
        />
      </button>
      <span class="events-title">{{ t('cazalla.events.title') }}</span>
    </div>
    <div class="events-body">
      <section
        v-for="section in EVENT_SECTIONS"
        :key="section"
        class="events-section"
      >
        <h3>{{ t(`cazalla.events.${section}`) }}</h3>
        <p
          v-if="groups[section].length === 0"
          class="events-empty"
        >
          –
        </p>
        <ul v-else>
          <li
            v-for="item in groups[section]"
            :key="item.task.file"
            :class="{ overdue: item.overdue }"
          >
            <a
              href="#"
              :title="item.task.file"
              @click.prevent="open(item.task)"
            >{{ item.task.title }}</a>
            <span class="meta">
              <span v-if="item.task.project">{{ item.task.project }}</span>
              <span>{{ format(item.due, section) }}</span>
            </span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ArrowLeft } from 'lucide-vue-next'
import { useTaskStore } from '../tasks/store'
import type { TaskRecord } from '../tasks/types'
import { weekStartFor } from '../dailyNotes/util'
import { EVENT_SECTIONS, groupEvents, type EventSection } from './group'

const emit = defineEmits<{ back: [] }>()
const { t, locale } = useI18n()
const tasks = useTaskStore()

// Re-evaluated every minute so midnight moves tasks between sections.
const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(() => (now.value = new Date()), 60_000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})

const groups = computed(() => groupEvents(tasks.list, now.value, weekStartFor(locale.value)))

const format = (due: Date, section: EventSection): string => {
  const opts: Intl.DateTimeFormatOptions =
    section === 'today' || section === 'tomorrow'
      ? { hour: '2-digit', minute: '2-digit' }
      : section === 'week'
        ? { weekday: 'short', hour: '2-digit', minute: '2-digit' }
        : { year: 'numeric', month: 'short', day: 'numeric' }
  return new Intl.DateTimeFormat(locale.value, opts).format(due)
}

const open = (task: TaskRecord): void => {
  window.electron.ipcRenderer.send('mt::open-file', task.file)
}
</script>

<style scoped>
.cazalla-events {
  display: flex;
  flex-direction: column;
  height: 100%;
  color: var(--sideBarColor);
}
.events-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
}
.back-button {
  display: flex;
  padding: 4px;
  border-radius: 4px;
  color: var(--sideBarIconColor);
}
.back-button:hover {
  background: var(--sideBarItemHoverBgColor);
}
.events-title {
  font-weight: 600;
  color: var(--sideBarTitleColor);
}
.events-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 0 12px 12px;
}
.events-section h3 {
  margin: 12px 0 4px;
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  opacity: 0.7;
}
.events-section ul {
  list-style: none;
  margin: 0;
  padding: 0;
}
.events-section li {
  display: flex;
  flex-direction: column;
  padding: 4px 6px;
  border-radius: 4px;
}
.events-section li:hover {
  background: var(--sideBarItemHoverBgColor);
}
.events-section a {
  color: inherit;
  text-decoration: none;
  font-size: 13px;
}
.events-section li.overdue a {
  color: var(--el-color-danger);
}
.meta {
  display: flex;
  gap: 8px;
  font-size: 11px;
  opacity: 0.7;
}
.events-empty {
  margin: 0 6px;
  opacity: 0.5;
}
</style>
