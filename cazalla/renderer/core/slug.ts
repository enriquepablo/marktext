import slugify from '@sindresorhus/slugify'

/** Same algorithm as the Obsidian vault, so new slugs match existing files. */
export const slug = (text: string): string => slugify(text)
