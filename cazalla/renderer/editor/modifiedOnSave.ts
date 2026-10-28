// Keeps `modified` current when the upstream editor saves a tab. Called from
// three one-line hooks in `store/editor.ts`, see item 33 of the plan.

import { usePreferencesStore } from '@/store/preferences'
import { sameExceptModified, touchModified } from '../core/frontmatter'
import { isoNow } from '../core/time'
import { stampModified } from './modified'
import { primaryInstance } from './registry'

// Markdown last handed to the main process for each tab.
const lastWritten = new Map<string, string>()

/**
 * Whether a save should stamp: the document changed beyond its `modified` line
 * since the last write of the session, or it was never written and is dirty.
 */
export const shouldStamp = (markdown: string, previous: string | undefined, isSaved: boolean): boolean =>
  previous === undefined ? !isSaved : !sameExceptModified(markdown, previous)

interface SavedTab {
  id: string
  markdown: string
  isSaved: boolean
}

/**
 * Called by the upstream store right before it sends a tab's markdown to be
 * written. When the tab is the one shown in the rich editor the live block is
 * stamped and flushed, so `tab.markdown` is updated through the content-change
 * path; otherwise the string is stamped in place.
 */
export const touchModifiedBeforeSave = (tab: SavedTab, isCurrent: boolean): void => {
  if (shouldStamp(tab.markdown, lastWritten.get(tab.id), tab.isSaved)) {
    const live = isCurrent && !usePreferencesStore().sourceCode ? primaryInstance()?.muya : null
    if (!live || !stampModified(live)) tab.markdown = touchModified(tab.markdown, isoNow())
  }
  lastWritten.set(tab.id, tab.markdown)
}
