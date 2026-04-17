import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { PageHeader } from '@/components/primitives/PageHeader'
import { Badge } from '@/components/primitives/Badge'
import { NAV_SECTIONS, ROUTE_METADATA } from '@/lib/navigation'
import { getAllConceptSlugs } from '@/lib/content/loader'

// ── Static params ─────────────────────────────────────────────────────────────

const TOPIC_IDS = ['estimation', 'testing', 'asymptotics', 'bayesian', 'advanced'] as const
type TopicId = typeof TOPIC_IDS[number]

export function generateStaticParams() {
  return TOPIC_IDS.map(topic => ({ topic }))
}

// ── Metadata ──────────────────────────────────────────────────────────────────

interface Props { params: Promise<{ topic: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { topic } = await params
  const meta = ROUTE_METADATA[`/topics/${topic}`]
  if (!meta) return { title: 'Topics' }
  return { title: meta.title, description: meta.description }
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TopicPage({ params }: Props) {
  const { topic } = await params

  if (!TOPIC_IDS.includes(topic as TopicId)) notFound()

  // Pull the matching NavBranch out of navigation config
  const topicsSection = NAV_SECTIONS.find(s => s.id === 'topics')
  const branch = topicsSection?.items.find(
    item => item.kind === 'branch' && item.id === topic
  )
  if (!branch || branch.kind !== 'branch') notFound()

  const meta = ROUTE_METADATA[`/topics/${topic}`]

  // Check which concept slugs actually have content
  const existingSlugs = new Set(getAllConceptSlugs())

  return (
    <div className="min-h-full">
      <PageHeader
        title={meta?.title ?? branch.label}
        eyebrow="Topics"
        description={meta?.description}
      />

      <div className="px-6 py-8 max-w-3xl space-y-8">

        {/* Concept list */}
        <section>
          <p className="label-xs mb-4">Concepts</p>
          <div className="space-y-2">
            {branch.children.map(child => {
              // Extract slug from href "/concepts/{slug}"
              const slug = child.href.replace('/concepts/', '')
              const hasContent = existingSlugs.has(slug)

              return hasContent ? (
                // Navigable: concept has MDX content
                <Link
                  key={child.id}
                  href={child.href}
                  className="group flex items-center justify-between rounded-md border border-border bg-surface px-4 py-3 transition-shadow hover:shadow-card-hover"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium text-text group-hover:text-accent transition-colors">
                      {child.label}
                    </span>
                    <Badge variant="forest">Available</Badge>
                  </div>
                  <ArrowRight size={14} className="text-text-muted group-hover:text-accent transition-colors" />
                </Link>
              ) : (
                // Not yet available: show placeholder card (not a link)
                <div
                  key={child.id}
                  className="flex items-center justify-between rounded-md border border-dashed border-border bg-elevated px-4 py-3"
                >
                  <span className="text-sm text-text-muted">{child.label}</span>
                  <Badge variant="muted">Coming soon</Badge>
                </div>
              )
            })}
          </div>
        </section>

        {/* Back link */}
        <div>
          <Link
            href="/topics"
            className="text-xs text-text-muted hover:text-accent transition-colors"
          >
            ← All topics
          </Link>
        </div>

      </div>
    </div>
  )
}
