/**
 * Muya's UI plugins are process-wide: `Muya.use` appends to a static list that
 * every `init()` instantiates. They must be registered before the first
 * instance is created, and that is not always the primary editor, which mounts
 * only while a file is open; the daily note and the file panes create their own
 * instances. So every creator calls `registerMuyaPlugins()` first. Options that
 * depend on the primary editor's current file are forwarded to hooks it sets
 * when it mounts; the link popover's jump needs no component.
 */
import {
  Muya,
  CodeBlockLanguageSelector,
  EmojiSelector,
  FootnoteTool,
  ImageEditTool,
  ImagePathPicker,
  ImageResizeBar,
  ImageToolBar,
  InlineFormatToolbar,
  LinkTools,
  ParagraphFrontButton,
  ParagraphFrontMenu,
  ParagraphQuickInsertMenu,
  PreviewToolBar,
  TableChessboard,
  TableColumnToolbar,
  TableDragBar,
  TableRowColumMenu,
  type IImagePathSuggestion
} from '@muyajs/core'
import { useEditorStore } from '@/store/editor'
import { linkToolsDir } from './registry'

export interface ImageHooks {
  imageAction: (state: { src: string; alt?: string; title?: string }) => Promise<string>
  imagePathPicker: () => Promise<string | string[]>
  imagePathAutoComplete: (src: string) => Promise<IImagePathSuggestion[]>
}

let hooks: Partial<ImageHooks> = {}

/** Set by the primary editor when it mounts; its image actions work on the current tab. */
export const setMuyaImageHooks = (next: Partial<ImageHooks>): void => {
  hooks = next
}

/** Follows the popover's link from the folder of the editor that showed it. */
const jumpClick = (linkInfo: { href?: string | null } | null): void => {
  if (!linkInfo) return
  useEditorStore().FORMAT_LINK_CLICK({ data: { href: linkInfo.href ?? null }, dirname: linkToolsDir() ?? window.DIRNAME })
}

let registered = false

export const registerMuyaPlugins = (): void => {
  if (registered) return
  registered = true
  Muya.use(TableChessboard)
  Muya.use(ParagraphQuickInsertMenu)
  Muya.use(CodeBlockLanguageSelector)
  Muya.use(EmojiSelector)
  Muya.use(ImagePathPicker)
  Muya.use(ImageEditTool, {
    imageAction: (state: { src: string; alt?: string; title?: string }) => hooks.imageAction?.(state) ?? Promise.resolve(state.src),
    imagePathPicker: () => hooks.imagePathPicker?.() ?? Promise.resolve(''),
    imagePathAutoComplete: (src: string) => hooks.imagePathAutoComplete?.(src) ?? Promise.resolve([])
  })
  Muya.use(ImageResizeBar)
  Muya.use(ImageToolBar)
  Muya.use(InlineFormatToolbar)
  Muya.use(ParagraphFrontButton)
  Muya.use(ParagraphFrontMenu)
  Muya.use(PreviewToolBar)
  Muya.use(LinkTools, { jumpClick })
  Muya.use(FootnoteTool)
  Muya.use(TableColumnToolbar)
  Muya.use(TableDragBar)
  Muya.use(TableRowColumMenu)
}
