// ── Frontmatter schema ────────────────────────────────────────────────────────
// Every .mdx file in content/concepts/ must supply this shape.
// The loader validates required fields at build time.

export type Difficulty = 1 | 2 | 3 | 4 | 5

export const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  1: 'Introductory',
  2: 'Intermediate',
  3: 'Advanced',
  4: 'Graduate',
  5: 'Research',
}

export type TopicArea =
  | 'Estimation Theory'
  | 'Hypothesis Testing'
  | 'Asymptotic Theory'
  | 'Bayesian Inference'
  | 'Probability Theory'
  | 'Linear Algebra'
  | 'Measure Theory'

export interface ConceptFrontmatter {
  // Identity
  title: string
  slug: string
  topic: TopicArea
  subtopic?: string

  // Pedagogy
  difficulty: Difficulty
  tags: string[]
  prerequisites: string[]   // concept slugs
  leadsTo: string[]         // concept slugs

  // Display
  description: string
  keyResults: string[]      // terse strings, rendered verbatim (may contain LaTeX)

  // Widget references — IDs that map to WidgetRegistry entries
  relatedWidgets?: string[]

  // Metadata
  authors?: string[]
  lastUpdated?: string      // ISO date string
}

// ── Loaded concept — frontmatter + compiled source ───────────────────────────

export interface LoadedConcept {
  frontmatter: ConceptFrontmatter
  source: string            // raw MDX source (gray-matter strips frontmatter)
}

// ── Heading extracted for Table of Contents ───────────────────────────────────

export interface TocEntry {
  id: string
  text: string
  depth: 2 | 3
}
