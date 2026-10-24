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
import { Building2, ClipboardList, FilePlus, FolderPlus, Kanban, ListTodo, Receipt, UserPlus } from 'lucide-vue-next'
import IconTooltip from '@/components/iconTooltip/index.vue'
import EntityDialog from '../dialogs/EntityDialog.vue'
import { registerLocales } from '../core/i18n'
import { useMetadataStore } from '../metadata/store'
import { openOrganizationDialog, openPersonDialog, openProjectDialog } from '../metadata/dialogs'
import { useTaskStore } from '../tasks/store'
import { openNoteDialog, openTaskDialog } from '../tasks/dialogs'
import { useCazallaLayoutStore } from '../core/layout'
import { listenForSidebarKanban } from '../kanban/sidebarMenu'
import { listenForSubtaskMenu } from '../tasks/subtaskMenu'
import { openInvoiceDialog, openReportDialog } from '../billing/dialogs'
import { usePaneStore } from '../panes/store'
import { listenForSidebarOpenInSplit } from '../panes/sidebarMenu'
import en from '../core/locales/en.json'
import es from '../core/locales/es.json'

registerLocales({ en, es })
useMetadataStore().LISTEN()
useTaskStore().LISTEN()
listenForSidebarKanban()
listenForSubtaskMenu()
usePaneStore().LISTEN()
listenForSidebarOpenInSplit()
const layout = useCazallaLayoutStore()
const { t } = useI18n()

interface Entry {
  key: string
  label: string
  icon: Component
  run: () => void
}

const entries = computed<Entry[]>(() => [
  { key: 'person', label: t('cazalla.activity.newPerson'), icon: UserPlus, run: openPersonDialog },
  { key: 'organization', label: t('cazalla.activity.newOrganization'), icon: Building2, run: openOrganizationDialog },
  { key: 'project', label: t('cazalla.activity.newProject'), icon: FolderPlus, run: openProjectDialog },
  { key: 'note', label: t('cazalla.activity.newNote'), icon: FilePlus, run: openNoteDialog },
  { key: 'task', label: t('cazalla.activity.newTask'), icon: ListTodo, run: openTaskDialog },
  { key: 'kanban', label: t('cazalla.activity.kanban'), icon: Kanban, run: () => layout.TOGGLE_KANBAN() },
  { key: 'report', label: t('cazalla.activity.effortReport'), icon: ClipboardList, run: openReportDialog },
  { key: 'invoice', label: t('cazalla.activity.invoice'), icon: Receipt, run: openInvoiceDialog }
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
