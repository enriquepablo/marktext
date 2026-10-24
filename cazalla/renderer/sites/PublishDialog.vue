<template>
  <el-dialog
    v-model="visible"
    :show-close="false"
    :modal="true"
    class="cazalla-publish-dialog"
    width="640px"
    center
    dir="ltr"
  >
    <template #title>
      <div class="dialog-title">
        {{ t('cazalla.sites.publishTitle') }}
      </div>
    </template>
    <el-form label-position="top">
      <el-form-item :label="t('cazalla.sites.site')">
        <el-select
          v-model="siteSlug"
          filterable
          :disabled="running"
        >
          <el-option
            v-for="s in metadata.sitesList"
            :key="s.slug"
            :value="s.slug"
            :label="s.name"
          />
        </el-select>
      </el-form-item>
    </el-form>
    <pre
      ref="logEl"
      class="publish-log"
    >{{ log.join('\n') }}</pre>
    <template #footer>
      <div class="dialog-footer">
        <el-button
          :disabled="running"
          @click="visible = false"
        >
          {{ t('cazalla.dialog.cancel') }}
        </el-button>
        <el-button
          :disabled="!site || running"
          @click="buildDraft"
        >
          {{ t('cazalla.sites.buildDraft') }}
        </el-button>
        <el-button
          type="primary"
          :loading="running"
          :disabled="!site"
          @click="publish"
        >
          {{ t('cazalla.sites.publish') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import bus from '@/bus'
import notice from '@/services/notification'
import { useContentFolder } from '../core/contentFolder'
import { join } from '../core/fs'
import { useMetadataStore } from '../metadata/store'
import { listenForSiteLog, log, runEnv, running, runSteps } from './publish'
import { PUBLISH_DIALOG_EVENT } from './dialogs'

const { t } = useI18n()
const metadata = useMetadataStore()
const contentFolder = useContentFolder()

const visible = ref(false)
const siteSlug = ref<string | null>(null)
const logEl = ref<HTMLElement | null>(null)
const site = computed(() => (siteSlug.value ? metadata.sites[siteSlug.value] : undefined))

listenForSiteLog()

const open = (): void => {
  if (!contentFolder.value) {
    notice.notify({ title: t('cazalla.sites.publishTitle'), type: 'warning', message: t('cazalla.dialog.noContentFolder') })
    return
  }
  if (metadata.sitesList.length === 0) {
    notice.notify({ title: t('cazalla.sites.publishTitle'), type: 'warning', message: t('cazalla.sites.noSites') })
    return
  }
  siteSlug.value ??= metadata.sitesList[0].slug
  log.value = []
  visible.value = true
}

watch(log, () => nextTick(() => logEl.value?.scrollTo({ top: logEl.value.scrollHeight })), { deep: true })

const buildDraft = async(): Promise<void> => {
  if (!site.value || !contentFolder.value) return
  const result = await runSteps(site.value.slug, ['ensure', 'draft'], runEnv(contentFolder.value, site.value))
  if (result.code === 0) {
    const index = join(result.dir, 'output', 'index.html')
    log.value.push(t('cazalla.sites.draftReady', { file: index }))
    void window.electron.ipcRenderer.invoke('mt::shell::open-path', index)
  }
}

const publish = async(): Promise<void> => {
  if (!site.value || !contentFolder.value) return
  const result = await runSteps(site.value.slug, ['ensure', 'publish', 'upload'], runEnv(contentFolder.value, site.value))
  if (result.code === 0) log.value.push(t('cazalla.sites.published', { url: site.value.siteUrl ?? '' }))
}

bus.on(PUBLISH_DIALOG_EVENT, open)
onBeforeUnmount(() => bus.off(PUBLISH_DIALOG_EVENT, open))
</script>

<style scoped>
.dialog-title {
  font-weight: 600;
}
.publish-log {
  height: 260px;
  overflow: auto;
  margin: 0;
  padding: 8px;
  font-size: 12px;
  background: var(--sideBarBgColor);
  color: var(--sideBarColor);
  border: 1px solid var(--itemBgColor);
  border-radius: 4px;
  white-space: pre-wrap;
}
</style>
