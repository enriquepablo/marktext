<template>
  <div class="cazalla-activity-bar">
    <template
      v-for="entry in entries"
      :key="entry.key"
    >
      <hr
        v-if="entry.key === 'sep'"
        class="activity-separator"
      >
      <icon-tooltip
        v-else
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
    </template>
    <entity-dialog />
    <publish-dialog />
  </div>
</template>

<script setup lang="ts">
import { computed, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { Building2, CalendarPlus, ClipboardList, FilePlus, FolderPlus, GitBranch, Globe, Kanban, ListTodo, Newspaper, PanelLeft, PanelRight, PenTool, Receipt, Rocket, UserPlus } from 'lucide-vue-next'
import '../core/styles.css'
import IconTooltip from '@/components/iconTooltip/index.vue'
import EntityDialog from '../dialogs/EntityDialog.vue'
import { registerLocales } from '../core/i18n'
import { useMetadataStore } from '../metadata/store'
import { openOrganizationDialog, openPersonDialog, openProjectDialog } from '../metadata/dialogs'
import { useTaskStore } from '../tasks/store'
import { openNoteDialog, openTaskDialog } from '../tasks/dialogs'
import { useCazallaLayoutStore } from '../core/layout'
import bus from '@/bus'
import { useDailyNotesStore } from '../dailyNotes/store'
import { listenForSidebarKanban } from '../kanban/sidebarMenu'
import { listenForSubtaskMenu } from '../tasks/subtaskMenu'
import { openInvoiceDialog, openReportDialog } from '../billing/dialogs'
import { openDrawingDialog } from '../drawings/dialogs'
import { openPageDialog, openPublishDialog, openSiteDialog } from '../sites/dialogs'
import { listenForSubpageMenu } from '../sites/subpageMenu'
import PublishDialog from '../sites/PublishDialog.vue'
import { openDateDialog } from '../dates/dialog'
import { listenForDoubleBracket } from '../links/linkDialog'
import { useDocIndexStore } from '../links/docIndex'
import { useSearchStore } from '../search/store'
import { useContentFolder } from '../core/contentFolder'
import notice from '@/services/notification'
import { usePaneStore } from '../panes/store'
import { listenForSidebarOpenInSplit } from '../panes/sidebarMenu'
import en from '../core/locales/en.json'
import es from '../core/locales/es.json'

registerLocales({ en, es })
useMetadataStore().LISTEN()
useTaskStore().LISTEN()
listenForSidebarKanban()
listenForSubtaskMenu()
listenForSubpageMenu()
listenForDoubleBracket()
useDocIndexStore().LISTEN()
useSearchStore().LISTEN()
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

const dailyNotes = useDailyNotesStore()
const contentFolder = useContentFolder()
const openTerminal = (): void => {
  if (!contentFolder.value) {
    void notice.notify({ title: t('cazalla.terminal.title'), type: 'warning', message: t('cazalla.dialog.noContentFolder') })
    return
  }
  usePaneStore().OPEN_IN_PANE('terminal', contentFolder.value)
}
const entries = computed<Entry[]>(() => [
  { key: 'left', label: t('cazalla.activity.toggleLeft'), icon: PanelLeft, run: () => bus.emit('view:toggle-layout-entry', 'showSideBar') },
  { key: 'right', label: t('cazalla.activity.toggleRight'), icon: PanelRight, run: () => dailyNotes.TOGGLE() },
  { key: 'sep', label: '', icon: PanelLeft, run: () => {} },
  { key: 'person', label: t('cazalla.activity.newPerson'), icon: UserPlus, run: openPersonDialog },
  { key: 'organization', label: t('cazalla.activity.newOrganization'), icon: Building2, run: openOrganizationDialog },
  { key: 'project', label: t('cazalla.activity.newProject'), icon: FolderPlus, run: openProjectDialog },
  { key: 'note', label: t('cazalla.activity.newNote'), icon: FilePlus, run: openNoteDialog },
  { key: 'task', label: t('cazalla.activity.newTask'), icon: ListTodo, run: openTaskDialog },
  { key: 'drawing', label: t('cazalla.activity.newDrawing'), icon: PenTool, run: openDrawingDialog },
  { key: 'kanban', label: t('cazalla.activity.kanban'), icon: Kanban, run: () => layout.TOGGLE_KANBAN() },
  { key: 'site', label: t('cazalla.sites.newSite'), icon: Globe, run: openSiteDialog },
  { key: 'page', label: t('cazalla.sites.newPage'), icon: Newspaper, run: openPageDialog },
  { key: 'publish', label: t('cazalla.sites.publishTitle'), icon: Rocket, run: openPublishDialog },
  { key: 'date', label: t('cazalla.date.title'), icon: CalendarPlus, run: openDateDialog },
  { key: 'git', label: t('cazalla.terminal.title'), icon: GitBranch, run: openTerminal },
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
  /* The upstream title bar is fixed across the window; leave its row free. */
  padding-top: calc(var(--titleBarHeight) + 8px);
  box-sizing: border-box;
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
.activity-separator {
  width: 24px;
  border: none;
  border-top: 1px solid var(--itemBgColor);
  margin: 4px 0;
}
</style>
