import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, FlaskConical, BarChart3, Network, BookOpen } from 'lucide-react'
import { Badge } from '@/components/primitives/Badge'

export const metadata: Metadata = {
  title: 'StatLab',
  description: 'Research-grade interactive statistics platform',
}

// ── Module cards ──────────────────────────────────────────────────────────────

const MODULES = [
  {
    id: 'lab',
    label: 'Interactive Lab',
    href: '/lab',
    icon: <FlaskConical size={20} />,
    description: 'Estimation, hypothesis testing, asymptotics, and Bayesian inference — all interactive, all exact.',
    badge: 'Live',
    badgeVariant: 'accent' as const,
  },
  {
    id: 'distributions',
    label: 'Distribution Lab',
    href: '/distributions',
    icon: <BarChart3 size={20} />,
    description: 'Properties, moments, estimation, and inter-distribution relationships for 30+ families.',
    badge: null,
    badgeVariant: 'muted' as const,
  },
  {
    id: 'graph',
    label: 'Knowledge Graph',
    href: '/graph',
    icon: <Network size={20} />,
    description: 'Navigate theorems, estimators, tests, and concepts as a connected statistical universe.',
    badge: null,
    badgeVariant: 'muted' as const,
  },
  {
    id: 'topics',
    label: 'Topic Explorer',
    href: '/topics',
    icon: <BookOpen size={20} />,
    description: 'Structured paths through estimation theory, hypothesis testing, asymptotics, and Bayesian methods.',
    badge: null,
    badgeVariant: 'muted' as const,
  },
]

// ── Topic preview rows ────────────────────────────────────────────────────────

const TOPIC_PREVIEWS = [
  {
    id: 'estimation',
    label: 'Estimation Theory',
    href: '/topics/estimation',
    concepts: ['Fisher Information', 'Cramér-Rao Bound', 'Sufficiency', 'UMVUE', 'MLE'],
  },
  {
    id: 'testing',
    label: 'Hypothesis Testing',
    href: '/topics/testing',
    concepts: ['Neyman-Pearson Lemma', 'UMP Tests', 'UMPU Tests', 'Likelihood Ratio', 'Power Analysis'],
  },
  {
    id: 'asymptotics',
    label: 'Asymptotic Theory',
    href: '/topics/asymptotics',
    concepts: ['CLT Variants', 'Berry-Esseen', 'Delta Method', 'LAN', 'Contiguity'],
  },
  {
    id: 'bayesian',
    label: 'Bayesian Inference',
    href: '/topics/bayesian',
    concepts: ['Conjugate Priors', 'Bernstein-von Mises', 'Posterior Contraction', 'MCMC'],
  },
]

// ── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="min-h-full">

      {/* Hero */}
      <section className="border-b border-border bg-surface px-4 py-10 md:px-8 md:py-16">
        <div className="max-w-2xl">
          <p className="label-xs mb-4">Research-grade interactive statistics</p>
          <h1 className="font-serif text-3xl md:text-5xl text-text leading-tight">
            Statistics as it<br />
            <em>should</em> be studied.
          </h1>
          <p className="mt-5 text-base text-text-secondary leading-relaxed max-w-lg">
            Rigorous mathematics, exact computation, and deep interactivity.
            No simplification. No placeholders. Every theorem, every bound, every distribution — explorable.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/lab"
              className="inline-flex items-center gap-2 rounded bg-accent px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
            >
              Open Lab <ArrowRight size={14} />
            </Link>
            <Link
              href="/topics"
              className="inline-flex items-center gap-2 rounded border border-border bg-surface px-5 py-2.5 text-sm font-medium text-text-secondary transition-colors hover:bg-elevated hover:text-text"
            >
              Browse Topics
            </Link>
          </div>
        </div>
      </section>

      {/* Modules */}
      <section className="px-4 py-8 md:px-8 md:py-10">
        <p className="label-xs mb-5">Modules</p>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {MODULES.map(mod => (
            <Link
              key={mod.id}
              href={mod.href}
              className="group flex flex-col gap-3 rounded-md border border-border bg-surface p-5 transition-shadow hover:shadow-card-hover"
            >
              <div className="flex items-center justify-between">
                <span className="flex h-9 w-9 items-center justify-center rounded bg-accent-light text-accent">
                  {mod.icon}
                </span>
                {mod.badge && (
                  <Badge variant={mod.badgeVariant}>{mod.badge}</Badge>
                )}
              </div>
              <div>
                <h2 className="font-medium text-sm text-text group-hover:text-accent transition-colors">
                  {mod.label}
                </h2>
                <p className="mt-1 text-xs text-text-muted leading-relaxed">
                  {mod.description}
                </p>
              </div>
              <div className="mt-auto flex items-center gap-1 text-2xs font-medium text-accent opacity-0 transition-opacity group-hover:opacity-100">
                Open <ArrowRight size={10} />
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* Topic previews */}
      <section className="border-t border-border px-4 py-8 md:px-8 md:py-10">
        <p className="label-xs mb-5">Topics</p>
        <div className="grid gap-3 sm:grid-cols-2">
          {TOPIC_PREVIEWS.map(topic => (
            <Link
              key={topic.id}
              href={topic.href}
              className="group flex flex-col gap-3 rounded-md border border-border bg-surface p-5 transition-shadow hover:shadow-card-hover"
            >
              <div className="flex items-center justify-between">
                <h2 className="font-serif text-xl text-text group-hover:text-accent transition-colors">
                  {topic.label}
                </h2>
                <ArrowRight size={14} className="text-text-muted opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {topic.concepts.map(c => (
                  <span
                    key={c}
                    className="rounded bg-elevated px-2 py-0.5 text-xs text-text-muted"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </div>
      </section>

    </div>
  )
}
