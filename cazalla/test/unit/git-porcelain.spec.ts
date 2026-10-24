import { describe, it, expect } from 'vitest'
import { folderState, parsePorcelain } from '@cazalla/renderer/git/porcelain'

describe('git porcelain', () => {
  it('maps modified, added, untracked and renamed entries', () => {
    const out = ['M  a/one.md', ' M a/two.md', '?? b/new.md', 'R  a/renamed.md', 'a/old.md', '!! ignored.md', 'A  c/added.md', ''].join('\0')
    const states = parsePorcelain(out)
    expect([...states.entries()].sort()).toEqual([
      ['a/one.md', 'modified'],
      ['a/renamed.md', 'modified'],
      ['a/two.md', 'modified'],
      ['b/new.md', 'untracked'],
      ['c/added.md', 'modified']
    ])
  })

  it('mixes states for folders', () => {
    const states = parsePorcelain(['M  p/tasks/x.md', '?? p/notes/y.md', '?? q/z.md', ''].join('\0'))
    expect([...folderState(states, 'p')].sort()).toEqual(['modified', 'untracked'])
    expect([...folderState(states, 'p/tasks')]).toEqual(['modified'])
    expect([...folderState(states, 'q')]).toEqual(['untracked'])
    expect([...folderState(states, 'r')]).toEqual([])
    expect([...folderState(states, '')].sort()).toEqual(['modified', 'untracked'])
  })
})
