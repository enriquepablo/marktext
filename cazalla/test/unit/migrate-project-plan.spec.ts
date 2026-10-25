import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { apply, plan } from '@cazalla/scripts/migrate-project/plan'

const P = 'Projects/Org/L/SA'
let root: string
let notes: string
const write = (rel: string, text: string): void => {
  const p = path.join(root, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, text)
}
const fm = (fields: string, body = ''): string => `---\n${fields}\n---\n${body}`
const read = (rel: string): string => fs.readFileSync(path.join(notes, rel), 'utf8')

beforeAll(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'vault-'))
  notes = fs.mkdtempSync(path.join(os.tmpdir(), 'notes-'))
  write('Metadata/projects/SA.md', `name: SA\nslug: sa\ncompany: org\nleader: lee\nservice: x\npath: ${P}/\n`)
  write(`${P}/kanban.md`, fm('kanban-plugin: board', '## wip\n\n- [ ] [[Child One]]\n'))
  write(`${P}/Tasks/Parent Task.md`, fm('title: Parent Task\nslug: parent-task\ntags:\ncategory: task\nproject: sa\npath: /\neffort:',
    'intro\n- [ ] [[Child One]]\n- [ ] [[Old Child]]\n![[img.png]]\nsee [[A Note|the note]] and [[2026-01-02]] and [[Missing]]\n'))
  write(`${P}/Tasks/parent-task/Child One.md`, fm('title: Child One\nslug: child-one\ncategory: task\nstatus: new\ndue: 2026-10-04T11:41:21.171Z\npath: /parent-task/'))
  write(`${P}/Tasks/parent-task/Child Two.md`, fm('title: Child Two\nslug: child-two\ncategory: task'))
  write(`${P}/Tasks/archived/Old Child.md`, fm('title: Old Child\nslug: old-child\ncategory: task\nstatus: archived\npath: /archived/\narchived-path: /parent-task/'))
  write(`${P}/Tasks/archived.md`, fm('title: archived\ncategory: note', '- 2026-10-17 [[Old Child]]\n'))
  write(`${P}/Notes/A Note.md`, fm('title: A Note\nslug: a-note\ncategory: note\nproject: sa', 'body\n'))
  write(`${P}/Assets/doc.pdf`, 'pdf')
  write(`${P}/Attic/old.md`, 'no frontmatter [[A Note]]\n')
  write('Files/img.png', 'png')
  write('Daily/2026-01-02.md', fm('category: daily'))
  write('Projects/Other/Notes/Elsewhere.md', fm('title: Elsewhere\nslug: elsewhere\ncategory: note'))
  write('Metadata/projects/Other.md', 'name: Other\nslug: other\npath: Projects/Other\n')
})
afterAll(() => {
  fs.rmSync(root, { recursive: true, force: true })
  fs.rmSync(notes, { recursive: true, force: true })
})

describe('plan + apply', () => {
  it('migrates one project', () => {
    const result = plan(root, notes, P, '2026-10-25T10:00:00.000Z')
    expect(result.target).toBe('projects/sa')
    apply(result.actions)

    expect(read('_metadata/projects/sa.md')).toBe('---\nname: SA\nslug: sa\norganization: org\nleader: lee\npath: projects/sa\n---\n')
    for (const d of ['tasks', 'notes', 'assets', 'archived']) expect(fs.statSync(path.join(notes, 'projects/sa', d)).isDirectory()).toBe(true)

    const parent = read('projects/sa/tasks/parent-task.md')
    expect(parent).toContain('path: /\nstatus: new\nkanban: false\ndue: 2026-10-25T10:00:00.000Z\neffort: []\nsubtasks:\n  - /parent-task/child-one\n  - /parent-task/child-two\n')
    expect(parent).toContain('tags: []\n')
    expect(parent.split('---\n')[2]).toBe(
      'intro\n- [ ] [Old Child](../archived/parent-task/old-child.md)\n![img.png](../assets/img.png)\nsee [the note](../notes/a-note.md) and [2026-01-02](../../../_daily/2026/01/2026-01-02.md) and [[Missing]]\n'
    )
    expect(read('projects/sa/tasks/parent-task/child-one.md')).toContain('path: /parent-task\nstatus: wip\nkanban: true\ndue: 2026-10-04T11:41:21.171Z\n')
    expect(read('projects/sa/tasks/parent-task/child-two.md')).toContain('status: new\nkanban: false\n')
    const old = read('projects/sa/archived/parent-task/old-child.md')
    expect(old).toContain('path: /parent-task\nstatus: archived\nkanban: false\n')
    expect(old).not.toContain('archived-path')

    expect(read('projects/sa/notes/archived.md')).toBe(fm('title: archived\ncategory: note', '- 2026-10-17 [Old Child](../archived/parent-task/old-child.md)\n'))
    expect(read('projects/sa/notes/a-note.md')).toBe(fm('title: A Note\nslug: a-note\ncategory: note\nproject: sa', 'body\n'))
    expect(read('projects/sa/assets/doc.pdf')).toBe('pdf')
    expect(read('projects/sa/assets/img.png')).toBe('png')
    expect(read('projects/sa/Attic/old.md')).toBe('no frontmatter [A Note](../notes/a-note.md)\n')

    expect([...result.report].sort()).toEqual([
      'no frontmatter, links converted only: Projects/Org/L/SA/Attic/old.md',
      'subtask not listed in parent, added: Projects/Org/L/SA/Tasks/parent-task/Child Two.md',
      'unresolved link [[Missing]] in Projects/Org/L/SA/Tasks/Parent Task.md'
    ])
  })

  it('leaves an existing record alone, maps links into other projects, reports duplicates and orphans', () => {
    write(`${P}/Notes/B.md`, fm('title: B\ncategory: note', '[[Elsewhere]]\n'))
    write(`${P}/Tasks/parent-task/Child One .md`, fm('title: Child One\nslug: child-one\ncategory: task'))
    write(`${P}/Tasks/orphan/Lost.md`, fm('title: Lost\nslug: lost\ncategory: task'))
    const result = plan(root, notes, P)
    expect(result.report).toContain(`name collision, renamed: ${P}/Tasks/parent-task/Child One .md → projects/sa/tasks/parent-task/child-one-2.md`)
    expect(result.report).toContain('subtask folder without parent task: projects/sa/tasks/orphan')
    expect(result.actions.find((a) => a.kind === 'write' && a.file.endsWith('_metadata/projects/sa.md'))).toBeUndefined()
    const b = result.actions.find((a) => a.kind === 'write' && a.file.endsWith('notes/b.md'))
    expect(b && b.kind === 'write' && b.content).toContain('[Elsewhere](../../other/notes/elsewhere.md)')
    expect(result.report).toContain('metadata record exists, left alone: ' + path.join(notes, '_metadata/projects/sa.md'))
    expect(result.report).toContain('link into another project (other): Projects/Other/Notes/Elsewhere.md')
  })
})
