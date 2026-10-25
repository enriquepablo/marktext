import { describe, it, expect } from 'vitest'
import { hrefFor, pickCandidate, rewriteWikiLinks, type WikiLink } from '@cazalla/scripts/migrate-project/links'

const files: Record<string, string> = {
  'Allow SPs': 'projects/sa/tasks/allow-sps.md',
  'Pasted image 1.png': 'projects/sa/assets/Pasted image 1.png',
  'Configure eduGain': 'projects/sa/archived/configure-edu-gain.md',
  'Projects/X/Tasks/Docs': 'projects/x/tasks/docs.md'
}
const resolve = (l: WikiLink): string | null => files[l.target] ?? null
const DIR = 'projects/sa/tasks'

describe('rewriteWikiLinks', () => {
  it('plain, alias, heading and embed forms', () => {
    const text = 'see [[Allow SPs]] and [[Allow SPs#Notes|the SPs]]\n![[Pasted image 1.png]]\n[[Projects/X/Tasks/Docs|Docs]]'
    expect(rewriteWikiLinks(text, DIR, resolve)).toEqual({
      text: 'see [Allow SPs](allow-sps.md) and [the SPs](allow-sps.md)\n![Pasted image 1.png](../assets/Pasted%20image%201.png)\n[Docs](../../x/tasks/docs.md)',
      unresolved: []
    })
  })

  it('trims trailing spaces in targets and keeps unresolved links as written', () => {
    const out = rewriteWikiLinks('[[Configure eduGain ]] [[Nowhere]]', DIR, resolve)
    expect(out.text).toBe('[Configure eduGain](../archived/configure-edu-gain.md) [[Nowhere]]')
    expect(out.unresolved).toEqual(['Nowhere'])
  })

  it('leaves fenced code alone', () => {
    const text = '```\n[[Allow SPs]]\n```\n[[Allow SPs]]'
    expect(rewriteWikiLinks(text, DIR, resolve).text).toBe('```\n[[Allow SPs]]\n```\n[Allow SPs](allow-sps.md)')
  })

  it('hrefFor encodes and relativises like the link dialog', () => {
    expect(hrefFor('_daily/2026/10', 'projects/sa/notes/My Note.md')).toBe('../../../projects/sa/notes/My%20Note.md')
  })
})

describe('pickCandidate', () => {
  const P = 'Projects/SUNET/Stefan/EduSign'
  it('prefers the project, then Files, Daily and the rest; shallower first', () => {
    expect(pickCandidate([`${P}/Attic/Tasks/2025/m.md`, `${P}/Tasks/m.md`], P)).toBe(`${P}/Tasks/m.md`)
    expect(pickCandidate(['Daily/x.md', 'Files/x.md', 'Projects/Other/x.md'], P)).toBe('Files/x.md')
    expect(pickCandidate(['Projects/Other/x.md', 'Daily/x.md'], P)).toBe('Daily/x.md')
    expect(pickCandidate([`${P}/Tasks/m .md`, `${P}/Tasks/m.md`], P)).toBe(`${P}/Tasks/m.md`)
    expect(pickCandidate([], P)).toBeNull()
  })
})
