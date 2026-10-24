import { describe, it, expect } from 'vitest'
import { slug } from '@cazalla/renderer/core/slug'
import { addMonths, dateKey, isoNow } from '@cazalla/renderer/core/time'

describe('core helpers', () => {
  it('slugifies like the Obsidian vault', () => {
    expect(slug('cazalla.net')).toBe('cazalla-net')
    expect(slug('Some  Tásk: draft #2')).toBe('some-task-draft-2')
  })

  it('formats UTC ISO timestamps', () => {
    expect(isoNow(new Date(Date.UTC(2026, 9, 22, 15, 6, 42, 215)))).toBe('2026-10-22T15:06:42.215Z')
  })

  it('adds months and clamps to month end', () => {
    expect(dateKey(addMonths(new Date(2026, 0, 31), 1))).toBe('2026-02-28')
    expect(dateKey(addMonths(new Date(2026, 9, 22), 1))).toBe('2026-11-22')
    expect(dateKey(addMonths(new Date(2026, 11, 5), 1))).toBe('2027-01-05')
  })
})
