import fs from 'fs'
import path from 'path'
import matter from 'gray-matter'
import type { ConceptFrontmatter, LoadedConcept, TocEntry } from './types'

const CONCEPTS_DIR = path.join(process.cwd(), 'content', 'concepts')

// ── File resolution ───────────────────────────────────────────────────────────

function conceptPath(slug: string): string {
  return path.join(CONCEPTS_DIR, `${slug}.mdx`)
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Returns all available concept slugs derived from .mdx filenames.
 * Used by generateStaticParams in app/concepts/[slug]/page.tsx.
 */
export function getAllConceptSlugs(): string[] {
  if (!fs.existsSync(CONCEPTS_DIR)) return []
  return fs
    .readdirSync(CONCEPTS_DIR)
    .filter(f => f.endsWith('.mdx'))
    .map(f => f.replace(/\.mdx$/, ''))
}

/**
 * Loads and parses a single concept MDX file.
 * Returns null if the file does not exist (triggers notFound() in the page).
 */
export function getConceptBySlug(slug: string): LoadedConcept | null {
  const filePath = conceptPath(slug)
  if (!fs.existsSync(filePath)) return null

  const raw = fs.readFileSync(filePath, 'utf8')
  const { data, content } = matter(raw)

  // Validate required fields at load time — fail loudly during build
  const required: Array<keyof ConceptFrontmatter> = ['title', 'slug', 'topic', 'difficulty', 'description', 'tags', 'prerequisites', 'leadsTo', 'keyResults']
  for (const field of required) {
    if (data[field] === undefined) {
      throw new Error(`[content] Missing required frontmatter field "${field}" in ${slug}.mdx`)
    }
  }

  return {
    frontmatter: data as ConceptFrontmatter,
    source: content,
  }
}

/**
 * Extracts a flat Table of Contents from raw MDX source.
 * Matches ## and ### headings, stripping inline markdown syntax.
 */
export function extractToc(source: string): TocEntry[] {
  const lines = source.split('\n')
  const entries: TocEntry[] = []

  for (const line of lines) {
    const h2 = line.match(/^##\s+(.+)$/)
    const h3 = line.match(/^###\s+(.+)$/)
    const match = h2 ?? h3
    if (!match) continue

    const raw = match[1]
    // Strip inline code and bold markers for display text
    const text = raw.replace(/`([^`]+)`/g, '$1').replace(/\*\*([^*]+)\*\*/g, '$1').trim()
    // Generate a URL-safe id matching rehype-slug's algorithm
    const id = text
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')

    entries.push({ id, text, depth: h2 ? 2 : 3 })
  }

  return entries
}

/**
 * Returns all concepts as loaded objects, sorted by difficulty.
 * Used for the concepts index page.
 */
export function getAllConcepts(): LoadedConcept[] {
  return getAllConceptSlugs()
    .map(slug => getConceptBySlug(slug))
    .filter((c): c is LoadedConcept => c !== null)
    .sort((a, b) => a.frontmatter.difficulty - b.frontmatter.difficulty)
}
