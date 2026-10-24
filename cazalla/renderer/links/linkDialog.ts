import bus from '@/bus'
import { t } from '@/i18n'
import { DIALOG_EVENT, type Option, type Values } from '../dialogs/types'
import { basename } from '../core/fs'
import { onTyped, replaceRange, type CursorPosition, type Registered } from '../editor/registry'
import { useDocIndexStore } from './docIndex'

const toPosix = (p: string): string => p.split(window.path.sep).join('/')

/** Href for `target` as written in a document that lives in `dir`; absolute when there is no dir. */
export const hrefFor = (dir: string | null, target: string): string => {
  if (!dir) return toPosix(target)
  const rel = toPosix(window.path.relative(dir, target))
  return encodeURI(rel.startsWith('.') ? rel : rel)
}

const openDialog = (registered: Registered, position: CursorPosition): void => {
  const docs = useDocIndexStore()
  const chosenTitle = (href: string): string | null => docs.docs.find((d) => d.file === href)?.title ?? null
  bus.emit(DIALOG_EVENT, {
    title: t('cazalla.link.title'),
    fields: [
      { key: 'label', label: t('cazalla.link.label'), type: 'text' },
      {
        key: 'href',
        label: t('cazalla.link.href'),
        type: 'combo',
        required: true,
        options: (): Option[] => docs.recent.map((d) => ({ value: d.file, label: `${d.title}  —  ${basename(d.file)}` }))
      }
    ],
    submit: async(v: Values) => {
      const raw = String(v.href).trim()
      const isDoc = docs.docs.some((d) => d.file === raw)
      const href = isDoc ? hrefFor(registered.dir(), raw) : raw
      const label = String(v.label ?? '').trim() || (isDoc ? chosenTitle(raw) : null) || href
      replaceRange(position, `[${label}](${href})`)
      registered.muya.focus()
    }
  })
}

/**
 * Watches typed input for `[[` right before the caret and opens the link
 * dialog in its place. With bracket auto-pairing the text reads `[[]` at the
 * caret; the stray `]` is removed too.
 */
export const listenForDoubleBracket = (): void => {
  onTyped(({ registered, position, text }) => {
    const { start, end } = position
    if (start !== end || start < 2 || text.slice(start - 2, start) !== '[[') return
    if (start >= 3 && text[start - 3] === '[') return
    const trailing = text[start] === ']' ? 1 : 0
    openDialog(registered, { block: position.block, start: start - 2, end: start + trailing })
  })
}
