import { t } from '@/i18n'
import { stampModified } from './modified'
import type { Registered } from './registry'

// Collapses the frontmatter block of each document to a greyed "metadata" line.
// The block is Muya's `pre.mu-frontmatter`; its state is a class on that element
// and the +/− control floats over its corner from outside Muya's DOM, so the
// engine's re-rendering never meets a foreign child.

const COLLAPSED = 'cz-fm-collapsed'
const SEEN = 'czFmSeen'

export const attachFrontmatterFold = (registered: Registered): void => {
  const root = (registered.muya as unknown as { domNode?: HTMLElement }).domNode
  if (!root) return

  const toggle = document.createElement('button')
  toggle.type = 'button'
  toggle.className = 'cz-fm-toggle plain-button'
  document.body.appendChild(toggle)
  // Stamps `modified` with the current time; shown only while the block is expanded.
  const touch = document.createElement('button')
  touch.type = 'button'
  touch.className = 'cz-fm-toggle cz-fm-touch plain-button'
  touch.textContent = '↻'
  touch.setAttribute('aria-label', t('cazalla.frontmatter.touch'))
  touch.title = t('cazalla.frontmatter.touch')
  document.body.appendChild(touch)

  const block = (): HTMLElement | null => root.querySelector<HTMLElement>('pre.mu-frontmatter')

  const setCollapsed = (pre: HTMLElement, collapsed: boolean): void => {
    pre.classList.toggle(COLLAPSED, collapsed)
    pre.dataset.czLabel = t('cazalla.frontmatter.collapsed')
    toggle.textContent = collapsed ? '+' : '−'
    toggle.setAttribute('aria-label', t(collapsed ? 'cazalla.frontmatter.expand' : 'cazalla.frontmatter.collapse'))
  }

  const place = (): void => {
    const pre = block()
    if (!pre || !pre.isConnected || pre.getClientRects().length === 0) {
      toggle.style.display = 'none'
      touch.style.display = 'none'
      return
    }
    const rect = pre.getBoundingClientRect()
    toggle.style.display = ''
    toggle.style.top = `${rect.top + 4}px`
    toggle.style.left = `${rect.right - 26}px`
    touch.style.display = pre.classList.contains(COLLAPSED) ? 'none' : ''
    touch.style.top = toggle.style.top
    touch.style.left = `${rect.right - 50}px`
  }

  const sync = (): void => {
    const pre = block()
    if (pre) {
      // A block not seen before belongs to a freshly opened document: start collapsed.
      if (!pre.dataset[SEEN]) {
        pre.dataset[SEEN] = '1'
        setCollapsed(pre, true)
        pre.addEventListener('mousedown', () => {
          if (pre.classList.contains(COLLAPSED)) setCollapsed(pre, false)
        })
      }
      // Keyboard navigation into the block must not edit hidden text.
      if (pre.classList.contains('mu-active') && pre.classList.contains(COLLAPSED)) setCollapsed(pre, false)
    }
    place()
  }

  toggle.addEventListener('mousedown', (e) => {
    e.preventDefault()
    const pre = block()
    if (pre) setCollapsed(pre, !pre.classList.contains(COLLAPSED))
    place()
  })

  touch.addEventListener('mousedown', (e) => {
    e.preventDefault()
    stampModified(registered.muya)
  })

  const observer = new MutationObserver(sync)
  observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] })
  const onScroll = (): void => place()
  document.addEventListener('scroll', onScroll, { capture: true, passive: true })
  window.addEventListener('resize', onScroll)
  sync()

  // Muya removes its DOM on destroy; the control and listeners go with it.
  const detach = (): void => {
    observer.disconnect()
    document.removeEventListener('scroll', onScroll, { capture: true })
    window.removeEventListener('resize', onScroll)
    toggle.remove()
    touch.remove()
  }
  registered.muya.on('destroy', detach)
  const rootObserver = new MutationObserver(() => {
    if (!root.isConnected) {
      detach()
      rootObserver.disconnect()
    }
  })
  rootObserver.observe(document.body, { childList: true, subtree: true })
}
