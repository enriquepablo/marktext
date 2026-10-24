<template>
  <div class="dn-calendar">
    <div class="dn-calendar-header">
      <button
        class="dn-nav"
        :title="t('dailyNotes.previousMonth')"
        @click="store.SHIFT_MONTH(-1)"
      >
        ‹
      </button>
      <span class="dn-month">{{ monthLabel }}</span>
      <button
        class="dn-nav"
        :title="t('dailyNotes.nextMonth')"
        @click="store.SHIFT_MONTH(1)"
      >
        ›
      </button>
    </div>
    <div class="dn-grid">
      <span
        v-for="name in weekdayNames"
        :key="name"
        class="dn-weekday"
      >{{ name }}</span>
      <button
        v-for="(cell, i) in cells"
        :key="i"
        class="dn-day"
        :class="{
          empty: !cell,
          today: cell && cell.key === todayKey,
          selected: cell && cell.key === store.selectedKey,
          'has-note': cell && store.existingDays.has(cell.key)
        }"
        :disabled="!cell"
        @click="cell && store.OPEN_DATE(cell.date)"
      >
        <span v-if="cell">{{ cell.date.getDate() }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDailyNotesStore } from './store'
import { formatDateKey, monthGrid, weekStartFor } from './util'

const { t, locale } = useI18n()
const store = useDailyNotesStore()

const todayKey = formatDateKey(new Date())
const weekStart = computed(() => weekStartFor(locale.value))

const monthLabel = computed(() => {
  const { year, month } = store.visibleMonth
  return new Intl.DateTimeFormat(locale.value, { month: 'long', year: 'numeric' }).format(
    new Date(year, month, 1)
  )
})

const weekdayNames = computed(() => {
  const fmt = new Intl.DateTimeFormat(locale.value, { weekday: 'short' })
  // 2024-01-07 is a Sunday; offset by the week start.
  return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(2024, 0, 7 + ((weekStart.value + i) % 7))))
})

const cells = computed(() => {
  const { year, month } = store.visibleMonth
  return monthGrid(year, month, weekStart.value).map((date) =>
    date ? { date, key: formatDateKey(date) } : null
  )
})

onMounted(() => void store.REFRESH_MONTH())
watch(() => store.contentFolder, () => void store.REFRESH_MONTH())
</script>

<style scoped>
.dn-calendar {
  padding: 8px 12px 12px;
  color: var(--sideBarColor);
  user-select: none;
}
.dn-calendar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}
.dn-month {
  font-weight: 600;
  color: var(--sideBarTitleColor);
  text-transform: capitalize;
}
.dn-nav,
.dn-day {
  background: transparent;
  border: none;
  color: inherit;
  cursor: pointer;
  border-radius: 4px;
  font: inherit;
}
.dn-nav {
  font-size: 18px;
  line-height: 1;
  padding: 2px 8px;
}
.dn-nav:hover,
.dn-day:not(.empty):hover {
  background: var(--sideBarItemHoverBgColor);
}
.dn-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}
.dn-weekday {
  text-align: center;
  font-size: 11px;
  opacity: 0.7;
  padding-bottom: 4px;
}
.dn-day {
  position: relative;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
}
.dn-day.empty {
  cursor: default;
}
.dn-day.today {
  font-weight: 700;
  color: var(--themeColor);
}
.dn-day.selected {
  background: var(--themeColor);
  color: var(--editorBgColor);
}
.dn-day.has-note::after {
  content: '';
  position: absolute;
  bottom: 3px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: currentColor;
}
</style>
