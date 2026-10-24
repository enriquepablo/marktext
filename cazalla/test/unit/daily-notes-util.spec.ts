import { describe, it, expect } from 'vitest'
import {
  formatDateKey,
  formatTimestamp,
  dailyNoteSegments,
  monthDirSegments,
  newNoteContent,
  touchModified,
  monthGrid
} from '@cazalla/renderer/dailyNotes/util'

const d = new Date(2026, 9, 23, 9, 5, 7) // 2026-10-23 09:05:07 local

describe('dailyNotes helpers', () => {
  it('formats the date key and segments in local time', () => {
    expect(formatDateKey(d)).toBe('2026-10-23')
    expect(monthDirSegments(2026, 9)).toEqual(['_daily', '2026', '10'])
    expect(dailyNoteSegments(d)).toEqual(['_daily', '2026', '10', '2026-10-23.md'])
  })

  it('formats timestamps with a numeric offset', () => {
    expect(formatTimestamp(d)).toMatch(/^2026-10-23T09:05:07[+-]\d{2}:\d{2}$/)
  })

  it('builds a new note with frontmatter and empty body', () => {
    const stamp = formatTimestamp(d)
    expect(newNoteContent(d, d)).toBe(
      `---\ntitle: "2026-10-23"\nslug: 2026-10-23\ncreated: ${stamp}\nmodified: ${stamp}\ncategory: daily\ntags: []\n---\n`
    )
  })

  it('rewrites only the modified line of a leading YAML block', () => {
    const later = new Date(2026, 9, 24, 10, 0, 0)
    const note = newNoteContent(d, d) + '\nBody text\n'
    const out = touchModified(note, later)
    expect(out).toContain(`created: ${formatTimestamp(d)}`)
    expect(out).toContain(`modified: ${formatTimestamp(later)}`)
    expect(out.endsWith('---\n\nBody text\n')).toBe(true)
  })

  it('leaves notes without frontmatter or without modified untouched', () => {
    expect(touchModified('# Plain\n', d)).toBe('# Plain\n')
    expect(touchModified('---\ntitle: x\n---\n', d)).toBe('---\ntitle: x\n---\n')
  })

  it('lays out a month grid of 42 cells honouring the week start', () => {
    // October 2026 starts on a Thursday.
    const monday = monthGrid(2026, 9, 1)
    expect(monday).toHaveLength(42)
    expect(monday.slice(0, 3)).toEqual([null, null, null])
    expect(monday[3]?.getDate()).toBe(1)
    expect(monday[33]?.getDate()).toBe(31)
    expect(monday[34]).toBeNull()
    const sunday = monthGrid(2026, 9, 0)
    expect(sunday[4]?.getDate()).toBe(1)
  })
})
