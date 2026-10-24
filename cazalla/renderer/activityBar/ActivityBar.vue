<template>
  <div class="cazalla-activity-bar">
    <icon-tooltip
      v-for="entry in entries"
      :key="entry.key"
      :content="entry.label"
      placement="right"
    >
      <button
        type="button"
        class="plain-button activity-button"
        :aria-label="entry.label"
        @click="entry.run"
      >
        <component
          :is="entry.icon"
          :size="20"
          aria-hidden="true"
        />
      </button>
    </icon-tooltip>
    <entity-dialog />
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { Building2, FilePlus, FolderPlus, ListTodo, UserPlus } from 'lucide-vue-next'
import IconTooltip from '@/components/iconTooltip/index.vue'
import EntityDialog from '../dialogs/EntityDialog.vue'
import { registerLocales } from '../core/i18n'
import { useMetadataStore } from '../metadata/store'
import { openOrganizationDialog, openPersonDialog, openProjectDialog } from '../metadata/dialogs'
import { useTaskStore } from '../tasks/store'
import { openNoteDialog, openTaskDialog } from '../tasks/dialogs'
import en from '../core/locales/en.json'
import es from '../core/locales/es.json'

registerLocales({ en, es })
useMetadataStore().LISTEN()
useTaskStore().LISTEN()
const { t } = useI18n()

interface Entry {
  key: string
  label: string
  icon: Component
  run: () => void
}

// Later roadmap items append entries here: kanban, report, invoice.
const entries = computed<Entry[]>(() => [
  { key: 'person', label: t('cazalla.activity.newPerson'), icon: UserPlus, run: openPersonDialog },
  { key: 'organization', label: t('cazalla.activity.newOrganization'), icon: Building2, run: openOrganizationDialog },
  { key: 'project', label: t('cazalla.activity.newProject'), icon: FolderPlus, run: openProjectDialog },
  { key: 'note', label: t('cazalla.activity.newNote'), icon: FilePlus, run: openNoteDialog },
  { key: 'task', label: t('cazalla.activity.newTask'), icon: ListTodo, run: openTaskDialog }
])
</script>

<style scoped>
.cazalla-activity-bar {
  width: 40px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding-top: 8px;
  height: 100vh;
  background: var(--sideBarBgColor);
  border-right: 1px solid var(--itemBgColor);
  -webkit-app-region: no-drag;
}
.activity-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  color: var(--sideBarIconColor);
}
.activity-button:hover {
  background: var(--sideBarItemHoverBgColor);
}
</style>
