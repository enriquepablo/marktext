import MiniSearch, { type Options } from 'minisearch'
import type { SearchDoc } from './extract'

export const FIELDS = ['title', 'body', 'tags', 'category', 'project']
export const STORE_FIELDS = ['title', 'category', 'project', 'excerpt']

export const indexOptions: Options<SearchDoc> = {
  fields: FIELDS,
  storeFields: STORE_FIELDS,
  searchOptions: { boost: { title: 3, tags: 2 }, prefix: true, fuzzy: 0.2 }
}

export const newIndex = (): MiniSearch<SearchDoc> => new MiniSearch<SearchDoc>(indexOptions)
