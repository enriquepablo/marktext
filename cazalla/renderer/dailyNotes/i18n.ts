import { registerLocales } from '../core/i18n'
import en from './locales/en.json'
import es from './locales/es.json'

/** Adds the daily-notes strings to vue-i18n. Other languages fall back to `en`. */
export const registerDailyNotesI18n = (): void => registerLocales({ en, es })
