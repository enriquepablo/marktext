# Daily notes and calendar panel

## Purpose

MarkText has a left sidebar and a document outline. It has no right-hand panel and no notion of a daily note. This document describes a right side panel that holds a month calendar and the note for the selected day. It applies to the desktop app in `packages/desktop` only.

## Content folder

Notes live in one configurable folder, similar to an Obsidian vault. That folder is the existing preference `defaultDirectoryToOpen`. The startup action `folder` opens it when MarkText starts. The preference UI calls it the content folder.

Daily notes are stored under the content folder as

```
<content folder>/_daily/YYYY/MM/YYYY-MM-DD.md
```

When no content folder is set, the panel shows a hint and a button that opens Preferences. The panel never falls back to the folder currently opened in the sidebar.

## Note format

A new note is a YAML frontmatter block followed by an empty body:

```
---
title: "YYYY-MM-DD"
slug: YYYY-MM-DD
created: 2026-10-23T09:12:00+02:00
modified: 2026-10-23T09:12:00+02:00
category: daily
tags: []
---
```

Timestamps are local time with a numeric offset. `created` is written once. `modified` is rewritten on every save by replacing the `modified:` line inside the leading `---` block. A note without a leading YAML block is written unchanged.

## Panel

The panel sits to the right of the editor. It is toggled by the View menu item "Daily Notes", by the command `view.toggle-daily-notes` (default `Ctrl+Shift+A`, `Command+Shift+A` on macOS), and by the command palette. Visibility is stored in `localStorage['daily-notes-visible']` and width in `localStorage['daily-notes-width']`; both are restored when a window opens.

The panel is split vertically. The top pane is a month grid with previous, next and today controls. A day that has a note shows a dot. The bottom pane edits the selected note. The split ratio is stored in `localStorage['daily-notes-split']`.

The calendar is a hand-written grid. Element Plus is pinned to the `en` locale, so `el-calendar` would not follow the app language, and the grid needs per-day markers. Weekday names come from `Intl.DateTimeFormat`. The first day of the week comes from `Intl.Locale.getWeekInfo` when available and is Monday otherwise.

## Editing and saving

Clicking a day creates the note if it is missing and loads it into the bottom pane. The pane owns a second Muya instance. Muya is not a singleton, so a second instance is possible. The instance receives the same typography and markdown options as the main editor, plus `frontmatterType: '-'` so the YAML block renders as frontmatter regardless of the user's frontmatter preference.

The note is not a tab. The tab save pipeline requires a document id, so the panel writes the file directly through `window.fileUtils.writeFile`. Saving is debounced by one second and flushed on blur, on date change, when the panel is hidden, and when it is unmounted. The `autoSave` preference does not apply. There is no dirty indicator.

## Limitations

- Muya UI plugins are registered process-wide. Image paste and image edit inside the panel note resolve paths relative to the active editor tab, not the note.
- The note file is not watched. External edits appear when the day is selected again.
- Menu shortcuts routed through the renderer bus (bold, undo, find, and so on) act on the main editor even while the panel has focus. Muya's own key handling works inside the panel.

## Follow-ups

- When the panel opens a note while the content folder is not a sidebar root, add the folder as a root.
- Watch the open note file and reload it on external change.
- A template file for new notes.

## Code layout

All code for this feature lives under `cazalla/` at the repository root, so that upstream MarkText updates merge with few conflicts. The alias `@cazalla` points at that directory in the Vite, Vitest and TypeScript configurations.

```
cazalla/
  README.md                 this document
  renderer/dailyNotes/      util.ts, store.ts, i18n.ts, commands.ts, locales/, Panel.vue, Calendar.vue, NoteEditor.vue
  renderer/core/            frontmatter.ts, slug.ts, time.ts, fs.ts, contentFolder.ts (shared by every item)
  renderer/metadata/        types.ts, store.ts, create.ts, dialogs.ts (items 2, 3 and 6)
  renderer/tasks/           types.ts, create.ts (notes and tasks), store.ts (task index), dialogs.ts (item 4), archive.ts (items 5 and 8),
                            subtasks.ts and subtaskMenu.ts (item 8)
  renderer/kanban/          KanbanView.vue (six-column board over the task index, vue-draggable-plus), sidebarMenu.ts (item 5)
  renderer/billing/         data.ts, reportPdf.ts, invoicePdf.ts (ported from cazalla-net.plugin, pdf-lib), dialogs.ts (item 9); output under _invoices/YYYY/MM
  renderer/panes/           tree.ts (pure layout tree), store.ts, PaneLayout.vue, FilePane.vue (second Muya instance per pane), sidebarMenu.ts (item 7)
  renderer/core/i18n.ts     registerLocales(): runtime merge of cazalla locale bundles
  renderer/core/layout.ts   reservedWidth = activity bar + daily notes panel
  renderer/dialogs/         EntityDialog.vue, a field-spec driven el-dialog opened by the bus event cazalla:dialog
  renderer/activityBar/     ActivityBar.vue, the 40 px icon strip left of the sidebar (lucide icons)
  scripts/migrate-vault.ts  one-time Obsidian vault migration (tsx cazalla/scripts/migrate-vault.ts <vault> [--apply])
  main/dailyNotes.ts        menu item, command, default shortcut, menu check state
  main/contextMenu.ts       editor right-click entries (Add subtask, split and close panel), labels from renderer/core/locales
  test/unit/                Vitest specs
  test/e2e/                 Playwright specs
```

Translations for this feature are kept in `cazalla/renderer/dailyNotes/locales/` and merged into vue-i18n at runtime, so the upstream locale files stay untouched. The main process reads the same files for the menu label.

Upstream files are changed only where a hook is unavoidable, each by one to three lines:

- `packages/desktop/electron.vite.config.ts`, `vitest.config.ts`, `tsconfig.base.json`, `tsconfig.json`, `eslint.config.js`: the `@cazalla` alias and include paths.
- `packages/desktop/src/renderer/src/pages/app.vue`: mount the activity bar, the kanban overlay and the panel; wrap the recent view and the editor in the pane layout.
- `packages/desktop/src/renderer/src/contextMenu/sideBar/index.ts`: the "Open in split panel" and "Kanban board" entries at the end of the file-tree context menu.
- `packages/desktop/src/main/contextMenu/editor/index.ts`: cazalla entries spread at the end of the editor context menu; `src/shared/types/ipc.ts` gains their channels.
- `packages/desktop/src/renderer/src/components/editorWithTabs/index.vue`: subtract the panel width.
- `packages/desktop/src/main/menu/templates/view.ts`, `src/main/menu/actions/view.ts`: menu item, command registration, check-state sync.
- `packages/desktop/src/main/keyboard/keybindings{Linux,Windows,Darwin}.ts`: default shortcut.
- `packages/desktop/src/renderer/src/commands/index.ts`, `commands/descriptions.ts`: command palette entry.
- `packages/desktop/test/e2e/cazalla-daily-notes.spec.ts`: a one-line import of the Playwright suite in `cazalla/test/e2e/`, because Playwright collects specs only under its `testDir`.

Panel visibility and width are stored in `localStorage`, not in the preferences schema, so no preference files change. Unit specs under `cazalla/test/unit/` run with `pnpm -C packages/desktop exec vitest run ../../cazalla/test/unit/` and are also included in `pnpm test:unit`. The preference labels for the content folder are not reworded; the panel's hint text explains that the content folder is the startup default directory.

## Split panels (item 7)

The upstream editor stays the primary pane. Secondary panes are `FilePane` components, each with its own Muya instance bound to a file path, autosaving one second after the last change and reloading on external change when nothing is pending. The layout tree is kept in `localStorage['cazalla-panes']`. Secondary panes have no tabs, no source-code mode, and menu shortcuts (formatting, find) act on the primary pane. The daily-notes editor is still its own component; folding it into `FilePane` is a follow-up.
