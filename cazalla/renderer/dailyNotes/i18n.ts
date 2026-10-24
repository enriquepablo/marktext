import { i18n } from '@/i18n'
import bus from '@/bus'
import en from './locales/en.json'
import es from './locales/es.json'

const messages: Record<string, Record<string, unknown>> = { en, es }

// The app loads a non-English locale lazily and installs it with
// `setLocaleMessage`, which would drop anything merged earlier. Merge only once
// the locale is listed as available, and poll briefly after a language switch
// because the install happens after the `language-changed` event fires.
const mergeWhenLoaded = (locale: string, attempts = 50): void => {
  const bundle = messages[locale]
  if (!bundle) return
  if (i18n.global.availableLocales.includes(locale)) {
    i18n.global.mergeLocaleMessage(locale, bundle)
    return
  }
  if (attempts > 0) setTimeout(() => mergeWhenLoaded(locale, attempts - 1), 100)
}

let registered = false

/** Adds the daily-notes strings to vue-i18n. Other languages fall back to `en`. */
export const registerDailyNotesI18n = (): void => {
  if (registered) return
  registered = true
  mergeWhenLoaded('en')
  mergeWhenLoaded(i18n.global.locale.value)
  bus.on('language-changed', (locale) => mergeWhenLoaded(String(locale)))
}
