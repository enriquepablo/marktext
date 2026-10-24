<template>
  <el-dialog
    v-model="visible"
    :show-close="false"
    :modal="true"
    class="cazalla-entity-dialog"
    width="480px"
    center
    dir="ltr"
    @closed="reset"
  >
    <template #title>
      <div class="dialog-title">
        {{ spec?.title }}
      </div>
    </template>
    <el-form
      v-if="spec"
      label-position="top"
      @submit.prevent="save"
    >
      <template
        v-for="field in visibleFields"
        :key="field.key"
      >
        <el-form-item
          :label="field.type === 'checkbox' ? '' : field.label"
          :error="errors[field.key]"
        >
          <el-input
            v-if="field.type === 'text'"
            v-model="values[field.key]"
            :placeholder="field.placeholder"
            @keyup.enter="save"
          />
          <el-input
            v-else-if="field.type === 'textarea'"
            v-model="values[field.key]"
            type="textarea"
            :rows="3"
            :placeholder="field.placeholder"
          />
          <el-input-number
            v-else-if="field.type === 'number'"
            v-model="values[field.key]"
            :min="0"
            controls-position="right"
          />
          <el-date-picker
            v-else-if="field.type === 'date'"
            v-model="values[field.key]"
            type="date"
            value-format="YYYY-MM-DD"
          />
          <el-select
            v-else-if="field.type === 'select'"
            v-model="values[field.key]"
            clearable
            filterable
          >
            <el-option
              v-for="o in options[field.key]"
              :key="o.value"
              :value="o.value"
              :label="o.label"
            />
          </el-select>
          <el-select
            v-else-if="field.type === 'multiselect'"
            v-model="values[field.key]"
            multiple
            filterable
          >
            <el-option
              v-for="o in options[field.key]"
              :key="o.value"
              :value="o.value"
              :label="o.label"
            />
          </el-select>
          <el-checkbox
            v-else-if="field.type === 'checkbox'"
            v-model="values[field.key]"
            :label="field.label"
          />
        </el-form-item>
      </template>
      <p
        v-if="formError"
        class="form-error"
      >
        {{ formError }}
      </p>
    </el-form>
    <template #footer>
      <div class="dialog-footer">
        <el-button @click="visible = false">
          {{ t('cazalla.dialog.cancel') }}
        </el-button>
        <el-button
          type="primary"
          :loading="busy"
          @click="save"
        >
          {{ t('cazalla.dialog.save') }}
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import bus from '@/bus'
import { DIALOG_EVENT, type DialogSpec, type Option, type Values } from './types'

const { t } = useI18n()

const visible = ref(false)
const busy = ref(false)
const spec = ref<DialogSpec | null>(null)
const values = reactive<Values>({})
const errors = reactive<Record<string, string>>({})
const options = reactive<Record<string, Option[]>>({})
const formError = ref('')

const visibleFields = computed(() =>
  (spec.value?.fields ?? []).filter((f) => !f.when || f.when(values))
)

const open = (next: unknown): void => {
  const s = next as DialogSpec
  reset()
  spec.value = s
  for (const f of s.fields) {
    values[f.key] = f.default ?? (f.type === 'multiselect' ? [] : f.type === 'checkbox' ? false : null)
    if (f.options) options[f.key] = f.options()
  }
  visible.value = true
}

const reset = (): void => {
  spec.value = null
  busy.value = false
  formError.value = ''
  for (const k of Object.keys(values)) delete values[k]
  for (const k of Object.keys(errors)) delete errors[k]
  for (const k of Object.keys(options)) delete options[k]
}

const isEmpty = (v: unknown): boolean =>
  v === null || v === undefined || v === '' || (Array.isArray(v) && v.length === 0)

const save = async(): Promise<void> => {
  if (!spec.value || busy.value) return
  for (const k of Object.keys(errors)) delete errors[k]
  formError.value = ''
  let ok = true
  for (const f of visibleFields.value) {
    if (f.required && isEmpty(values[f.key])) {
      errors[f.key] = t('cazalla.dialog.required')
      ok = false
    }
  }
  if (!ok) return
  busy.value = true
  try {
    // Hidden fields are not submitted.
    const submitted: Values = {}
    for (const f of visibleFields.value) submitted[f.key] = values[f.key]
    const message = await spec.value.submit(submitted)
    if (message) formError.value = message
    else visible.value = false
  } catch (err) {
    formError.value = err instanceof Error ? err.message : String(err)
  } finally {
    busy.value = false
  }
}

bus.on(DIALOG_EVENT, open)
onBeforeUnmount(() => bus.off(DIALOG_EVENT, open))
</script>

<style scoped>
.dialog-title {
  font-weight: 600;
}
.form-error {
  color: var(--el-color-danger);
  font-size: 13px;
  margin: 0;
}
</style>
