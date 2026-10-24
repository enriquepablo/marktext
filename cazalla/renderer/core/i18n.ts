import { i18n } from '@/i18n'
import bus from '@/bus'

type Bundle = Record<string, unknown>

// Bundles registered per locale. Several features contribute to the same locale.
const bundles: Record<string, Bundle[]> = {}
let listening = false

// The app installs a non-English locale lazily with `setLocaleMessage`, which
// drops anything merged before. Merge only once the locale is listed as
// available, polling briefly after a language switch because the install
// happens after the `language-changed` event fires.
const mergeWhenLoaded = (locale: string, attempts = 50): void => {
  const list = bundles[locale]
  if (!list) return
  if (i18n.global.availableLocales.includes(locale)) {
    for (const bundle of list) i18n.global.mergeLocaleMessage(locale, bundle)
    return
  }
  if (attempts > 0) setTimeout(() => mergeWhenLoaded(locale, attempts - 1), 100)
}

/** Adds translation bundles keyed by locale. Missing locales fall back to `en`. */
export const registerLocales = (byLocale: Record<string, Bundle>): void => {
  for (const [locale, bundle] of Object.entries(byLocale)) {
    ;(bundles[locale] ??= []).push(bundle)
    mergeWhenLoaded(locale)
  }
  if (!listening) {
    listening = true
    bus.on('language-changed', (locale) => mergeWhenLoaded(String(locale)))
  }
}
