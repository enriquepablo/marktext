import { computed, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import notice from '@/services/notification'
import { useContentFolder } from '../core/contentFolder'
import { parse, type Fields } from '../core/frontmatter'
import { basename, join, listDir, readText } from '../core/fs'
import type { MetadataKind, Organization, Person, Project, Site } from './types'

export const METADATA_DIR = '_metadata'
const KINDS: MetadataKind[] = ['people', 'organizations', 'projects', 'sites']

const str = (v: unknown): string | null => (v === null || v === undefined || v === '' ? null : String(v))
const num = (v: unknown): number | null => (typeof v === 'number' ? v : v ? Number(v) : null)
const list = (v: unknown): string[] =>
  Array.isArray(v) ? v.map(String) : typeof v === 'string' && v ? [v] : []

const toPerson = (f: Fields, slug: string, file: string): Person => ({
  name: str(f.name) ?? slug,
  slug,
  organization: str(f.organization),
  email: str(f.email),
  phone: str(f.phone),
  file
})

const toOrganization = (f: Fields, slug: string, file: string): Organization => ({
  name: str(f.name) ?? slug,
  slug,
  leader: str(f.leader),
  phone: str(f.phone),
  price_hour: num(f.price_hour),
  invoice_number: str(f.invoice_number),
  iban: str(f.iban),
  swift: str(f.swift),
  payment_details: str(f.payment_details),
  invoice_details: list(f.invoice_details),
  billing: list(f.billing),
  file
})

const toProject = (f: Fields, slug: string, file: string): Project => ({
  name: str(f.name) ?? slug,
  slug,
  organization: str(f.organization),
  leader: str(f.leader),
  path: (str(f.path) ?? `projects/${slug}`).replace(/\/+$/, ''),
  file
})

const toSite = (f: Fields, slug: string, file: string): Site => ({
  name: str(f.name) ?? slug,
  slug,
  siteUrl: str(f['site-url']),
  path: (str(f.path) ?? `sites/${slug}`).replace(/\/+$/, ''),
  sshHost: str(f['ssh-host']),
  sshPort: num(f['ssh-port']) ?? 22,
  sshUser: str(f['ssh-user']),
  sshTargetDir: str(f['ssh-target-dir']),
  file
})

const byName = <T extends { name: string }>(records: Record<string, T>): T[] =>
  Object.values(records).sort((a, b) => a.name.localeCompare(b.name))

export const useMetadataStore = defineStore('cazallaMetadata', () => {
  const contentFolder = useContentFolder()
  const metadataDir = computed(() => (contentFolder.value ? join(contentFolder.value, METADATA_DIR) : null))

  const people = ref<Record<string, Person>>({})
  const organizations = ref<Record<string, Organization>>({})
  const projects = ref<Record<string, Project>>({})
  const sites = ref<Record<string, Site>>({})
  const loaded = ref(false)
  const errors = ref<string[]>([])

  const peopleList = computed(() => byName(people.value))
  const organizationsList = computed(() => byName(organizations.value))
  const projectsList = computed(() => byName(projects.value))
  const sitesList = computed(() => byName(sites.value))

  async function readKind<T>(
    kind: MetadataKind,
    convert: (f: Fields, slug: string, file: string) => T,
    problems: string[]
  ): Promise<Record<string, T>> {
    const out: Record<string, T> = {}
    if (!metadataDir.value) return out
    const dir = join(metadataDir.value, kind)
    for (const name of await listDir(dir)) {
      if (!name.endsWith('.md')) continue
      const file = join(dir, name)
      const fields = parse(await readText(file))
      if (!fields) {
        problems.push(`${kind}/${name}: no frontmatter`)
        continue
      }
      const slug = str(fields.slug) ?? basename(name, '.md')
      if (out[slug]) {
        problems.push(`${kind}/${name}: duplicate slug ${slug}`)
        continue
      }
      out[slug] = convert(fields, slug, file)
    }
    return out
  }

  async function LOAD(): Promise<void> {
    const problems: string[] = []
    const [p, o, pr, si] = await Promise.all([
      readKind('people', toPerson, problems),
      readKind('organizations', toOrganization, problems),
      readKind('projects', toProject, problems),
      readKind('sites', toSite, problems)
    ])
    people.value = p
    organizations.value = o
    projects.value = pr
    sites.value = si
    errors.value = problems
    loaded.value = true
    if (problems.length) {
      notice.notify({ title: METADATA_DIR, type: 'warning', message: problems.join('\n') })
    }
  }

  // The main-process watcher reports changes under open sidebar roots. A change
  // below `_metadata/` reloads everything; the folder is small.
  let reloadTimer: ReturnType<typeof setTimeout> | null = null
  let listening = false
  function LISTEN(): void {
    if (listening) return
    listening = true
    window.electron.ipcRenderer.on('mt::update-object-tree', (_e, payload) => {
      const pathname = (payload as { change?: { pathname?: string } })?.change?.pathname
      const dir = metadataDir.value
      if (!pathname || !dir || !pathname.startsWith(dir + window.path.sep)) return
      if (reloadTimer) clearTimeout(reloadTimer)
      reloadTimer = setTimeout(() => void LOAD(), 200)
    })
  }

  watch(contentFolder, () => void LOAD(), { immediate: true })

  return {
    metadataDir,
    people,
    organizations,
    projects,
    sites,
    peopleList,
    organizationsList,
    projectsList,
    sitesList,
    loaded,
    errors,
    KINDS,
    LOAD,
    LISTEN
  }
})
