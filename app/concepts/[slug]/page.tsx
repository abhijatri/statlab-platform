import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { getAllConceptSlugs, getConceptBySlug, extractToc } from '@/lib/content/loader'
import { DIFFICULTY_LABEL } from '@/lib/content/types'
import { MDXContent } from '@/components/content/MDXContent'
import { TableOfContents } from '@/components/content/TableOfContents'
import { InlineMath } from '@/components/content/InlineMath'
import { Badge } from '@/components/primitives/Badge'

// ── Static generation ─────────────────────────────────────────────────────────

export async function generateStaticParams() {
  return getAllConceptSlugs().map(slug => ({ slug }))
}

// Allow unknown slugs — they render a "coming soon" page rather than a hard 404.
// Pre-generated slugs are served as static HTML; unknown slugs are server-rendered.
export const dynamicParams = true

// ── Metadata ──────────────────────────────────────────────────────────────────

interface Props {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const concept = getConceptBySlug(slug)
  if (!concept) return { title: 'Not Found' }
  return {
    title: concept.frontmatter.title,
    description: concept.frontmatter.description,
  }
}

// ── Difficulty badge color map ────────────────────────────────────────────────

const DIFFICULTY_BADGE = {
  1: 'forest',
  2: 'forest',
  3: 'accent',
  4: 'muted',
  5: 'crimson',
} as const

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ConceptPage({ params }: Props) {
  const { slug } = await params
  const concept = getConceptBySlug(slug)
  if (!concept) notFound()

  const { frontmatter, source } = concept
  const toc = extractToc(source)

  return (
    <div className="min-h-full">
      {/* ── Page header ── */}
      <div className="border-b border-border bg-surface px-4 py-5 md:px-8 md:py-7">
        {/* Breadcrumb */}
        <div className="mb-3 flex items-center gap-1.5 text-xs text-text-muted">
          <Link href="/topics" className="hover:text-text transition-colors">Topics</Link>
          <span>/</span>
          <Link
            href={`/topics/${frontmatter.topic.toLowerCase().replace(/\s+/g, '-')}`}
            className="hover:text-text transition-colors"
          >
            {frontmatter.topic}
          </Link>
          {frontmatter.subtopic && (
            <>
              <span>/</span>
              <span>{frontmatter.subtopic}</span>
            </>
          )}
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-serif text-2xl md:text-3xl text-text">{frontmatter.title}</h1>
            <p className="mt-2 max-w-2xl text-sm text-text-secondary leading-relaxed">
              {frontmatter.description}
            </p>
            {/* Tags */}
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <Badge variant={DIFFICULTY_BADGE[frontmatter.difficulty]}>
                {DIFFICULTY_LABEL[frontmatter.difficulty]}
              </Badge>
              {frontmatter.tags.map(tag => (
                <Badge key={tag} variant="muted">{tag}</Badge>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Body: content + right rail ── */}
      <div className="flex gap-0">

        {/* Main content */}
        <article className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">

          {/* Prerequisites */}
          {frontmatter.prerequisites.length > 0 && (
            <div className="mb-8 flex flex-wrap items-center gap-2 rounded-md border border-border bg-elevated px-4 py-3 text-xs">
              <span className="text-text-muted mr-1">Prerequisites:</span>
              {frontmatter.prerequisites.map(pre => (
                <Link
                  key={pre}
                  href={`/concepts/${pre}`}
                  className="flex items-center gap-1 text-accent hover:underline"
                >
                  <ArrowLeft size={10} />
                  {pre.replace(/-/g, ' ')}
                </Link>
              ))}
            </div>
          )}

          {/* MDX body */}
          <div className="max-w-3xl">
            <MDXContent source={source} />
          </div>

          {/* Key results */}
          {frontmatter.keyResults.length > 0 && (
            <div className="mt-12 max-w-3xl">
              <h2 className="mb-4 font-serif text-xl text-text">Key Results</h2>
              <ol className="space-y-2">
                {frontmatter.keyResults.map((result, i) => (
                  <li
                    key={i}
                    className="flex gap-3 rounded-md bg-elevated border border-border px-4 py-3"
                  >
                    <span className="flex-shrink-0 font-mono text-xs text-text-muted mt-0.5 w-5">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span className="font-sans text-sm text-text-secondary leading-relaxed">
                      <InlineMath>{result}</InlineMath>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Leads to */}
          {frontmatter.leadsTo.length > 0 && (
            <div className="mt-10 max-w-3xl">
              <p className="label-xs mb-3">Builds toward</p>
              <div className="flex flex-wrap gap-2">
                {frontmatter.leadsTo.map(slug => (
                  <Link
                    key={slug}
                    href={`/concepts/${slug}`}
                    className="flex items-center gap-1.5 rounded border border-border bg-surface px-3 py-2 text-xs text-text-secondary transition-colors hover:border-accent hover:text-accent"
                  >
                    {slug.replace(/-/g, ' ')}
                    <ArrowRight size={10} />
                  </Link>
                ))}
              </div>
            </div>
          )}
        </article>

        {/* Right rail — sticky TOC */}
        {toc.length > 0 && (
          <aside className="hidden xl:block w-56 flex-shrink-0 px-4 py-8">
            <div className="sticky top-20">
              <TableOfContents entries={toc} />
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
