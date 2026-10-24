<template>
  <div class="cazalla-kanban">
    <header class="kanban-header">
      <Kanban
        :size="18"
        aria-hidden="true"
      />
      <span class="kanban-title">{{ t('cazalla.kanban.title') }}</span>
      <el-select
        v-model="projectSlug"
        class="kanban-project"
        size="small"
        clearable
        filterable
        :placeholder="t('cazalla.kanban.allProjects')"
      >
        <el-option
          v-for="p in metadata.projectsList"
          :key="p.slug"
          :value="p.slug"
          :label="p.name"
        />
      </el-select>
      <button
        type="button"
        class="plain-button kanban-close"
        :aria-label="t('cazalla.kanban.close')"
        @click="layout.CLOSE_KANBAN()"
      >
        <X
          :size="18"
          aria-hidden="true"
        />
      </button>
    </header>
    <div class="kanban-columns">
      <section
        v-for="status in TASK_STATUSES"
        :key="status"
        class="kanban-column"
        :class="status"
      >
        <h3>
          {{ t(`cazalla.kanban.columns.${status}`) }}
          <span class="count">{{ lists[status].length }}</span>
        </h3>
        <VueDraggable
          v-model="lists[status]"
          class="kanban-cards"
          group="cazalla-kanban"
          :animation="150"
          ghost-class="ghost"
          @add="onAdd($event, status)"
        >
          <article
            v-for="card in lists[status]"
            :key="card.file"
            class="kanban-card"
            :data-file="card.file"
            :title="card.file"
            @dblclick="openTask(card)"
          >
            <div class="card-title">
              {{ card.title }}
            </div>
            <div class="card-meta">
              <span v-if="!projectSlug && card.project">{{ card.project }}</span>
              <span v-if="card.path !== '/'">{{ card.path }}</span>
              <span v-if="card.due">{{ card.due.slice(0, 10) }}</span>
              <span v-if="card.subtasks.length">{{ t('cazalla.kanban.subtasks', { n: card.subtasks.length }) }}</span>
            </div>
          </article>
        </VueDraggable>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Kanban, X } from 'lucide-vue-next'
import { VueDraggable } from 'vue-draggable-plus'
import notice from '@/services/notification'
import { useContentFolder } from '../core/contentFolder'
import { useCazallaLayoutStore } from '../core/layout'
import { useMetadataStore } from '../metadata/store'
import { useTaskStore } from '../tasks/store'
import { archiveTask, HasSubtasksError } from '../tasks/archive'
import { TASK_STATUSES, type TaskRecord, type TaskStatus } from '../tasks/types'

const { t } = useI18n()
const layout = useCazallaLayoutStore()
const metadata = useMetadataStore()
const tasks = useTaskStore()
const contentFolder = useContentFolder()

const projectSlug = computed({
  get: () => layout.kanbanProject,
  set: (v: string | null) => (layout.kanbanProject = v || null)
})

const byDue = (a: TaskRecord, b: TaskRecord): number => (a.due ?? '9999').localeCompare(b.due ?? '9999')

// Column contents are copies: SortableJS mutates them on drop, and the store
// remains the source of truth once the frontmatter write has gone through.
const lists = reactive<Record<TaskStatus, TaskRecord[]>>({
  continuous: [],
  new: [],
  pending: [],
  wip: [],
  done: [],
  archived: []
})

const rebuild = (): void => {
  const visible = tasks.list.filter((task) => !projectSlug.value || task.project === projectSlug.value)
  for (const status of TASK_STATUSES) {
    lists[status] = visible.filter((task) => task.status === status).sort(byDue)
  }
}
watch([() => tasks.tasks, projectSlug], rebuild, { immediate: true, deep: true })

const onAdd = async(event: { item: HTMLElement }, status: TaskStatus): Promise<void> => {
  const file = event.item.dataset.file
  const task = file ? tasks.tasks[file] : undefined
  if (!task) return rebuild()
  try {
    if (status === 'archived') {
      const project = task.project ? metadata.projects[task.project] : undefined
      if (!contentFolder.value || !project) throw new Error(t('cazalla.kanban.noProject'))
      await archiveTask(contentFolder.value, project, task)
      await tasks.LOAD()
    } else {
      await tasks.UPDATE(task.file, { status })
    }
  } catch (err) {
    const message = err instanceof HasSubtasksError ? t('cazalla.kanban.hasSubtasks', { slug: err.slug }) : String(err)
    notice.notify({ title: t('cazalla.kanban.title'), type: 'warning', message })
  }
  rebuild()
}

const openTask = (task: TaskRecord): void => {
  window.electron.ipcRenderer.send('mt::open-file', task.file)
  layout.CLOSE_KANBAN()
}
</script>

<style scoped>
.cazalla-kanban {
  position: absolute;
  inset: 0;
  z-index: 5;
  display: flex;
  flex-direction: column;
  background: var(--editorBgColor);
  color: var(--editorColor);
}
.kanban-header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--itemBgColor);
  -webkit-app-region: drag;
}
.kanban-title {
  font-weight: 600;
}
.kanban-project {
  width: 220px;
  -webkit-app-region: no-drag;
}
.kanban-close {
  margin-left: auto;
  -webkit-app-region: no-drag;
  display: flex;
  align-items: center;
  padding: 4px;
  border-radius: 4px;
  color: var(--iconColor);
}
.kanban-close:hover {
  background: var(--sideBarItemHoverBgColor);
}
.kanban-columns {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(6, minmax(160px, 1fr));
  gap: 10px;
  padding: 12px 16px;
  overflow: auto;
}
.kanban-column {
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: var(--sideBarBgColor);
  border-radius: 6px;
  padding: 8px;
}
.kanban-column h3 {
  margin: 0 0 8px;
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--sideBarTitleColor);
  display: flex;
  justify-content: space-between;
}
.kanban-column.archived {
  border: 1px dashed var(--itemBgColor);
}
.count {
  opacity: 0.6;
}
.kanban-cards {
  flex: 1;
  min-height: 60px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.kanban-card {
  background: var(--editorBgColor);
  border: 1px solid var(--itemBgColor);
  border-radius: 4px;
  padding: 8px;
  cursor: grab;
  user-select: none;
}
.kanban-card.ghost {
  opacity: 0.4;
}
.card-title {
  font-size: 13px;
}
.card-meta {
  margin-top: 4px;
  font-size: 11px;
  opacity: 0.7;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
