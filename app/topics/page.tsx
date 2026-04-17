import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { PageHeader } from '@/components/primitives/PageHeader'
import { Badge } from '@/components/primitives/Badge'

export const metadata: Metadata = {
  title: 'Topic Explorer',
  description: 'Browse statistical theory by subject area',
}

const TOPICS = [
  {
    id: 'estimation',
    href: '/topics/estimation',
    title: 'Estimation Theory',
    description: 'Point estimation, Fisher information, the Cramér-Rao bound, sufficiency, completeness, and the UMVUE. The foundational theory of what it means to estimate a parameter optimally.',
    concepts: [
      { label: 'Fisher Information', difficulty: 2 },
      { label: 'Cramér-Rao Lower Bound', difficulty: 2 },
      { label: 'Sufficiency & Completeness', difficulty: 3 },
      { label: 'Rao-Blackwell Theorem', difficulty: 3 },
      { label: 'UMVUE', difficulty: 3 },
      { label: 'Maximum Likelihood', difficulty: 2 },
      { label: 'Exponential Families', difficulty: 3 },
      { label: 'James-Stein Estimator', difficulty: 4 },
    ],
    count: 8,
    badge: 'Core',
    badgeVariant: 'accent' as const,
  },
  {
    id: 'testing',
    href: '/topics/testing',
    title: 'Hypothesis Testing',
    description: 'The Neyman-Pearson framework, uniformly most powerful tests, unbiasedness, the likelihood ratio principle, and exact power function computation.',
    concepts: [
      { label: 'Neyman-Pearson Lemma', difficulty: 2 },
      { label: 'UMP Tests', difficulty: 3 },
      { label: 'UMPU Tests', difficulty: 4 },
      { label: 'Likelihood Ratio Tests', difficulty: 3 },
      { label: 'Wilks\' Theorem', difficulty: 3 },
      { label: 'Power Analysis', difficulty: 2 },
      { label: 'p-values: Theory', difficulty: 2 },
      { label: 'Composite Hypotheses', difficulty: 3 },
    ],
    count: 8,
    badge: 'Core',
    badgeVariant: 'accent' as const,
  },
  {
    id: 'asymptotics',
    href: '/topics/asymptotics',
    title: 'Asymptotic Theory',
    description: 'Convergence in distribution, the central limit theorem and its variants, Berry-Esseen bounds, the delta method, local asymptotic normality, and contiguity.',
    concepts: [
      { label: 'Modes of Convergence', difficulty: 2 },
      { label: 'CLT Variants', difficulty: 3 },
      { label: 'Berry-Esseen Theorem', difficulty: 3 },
      { label: 'Delta Method', difficulty: 2 },
      { label: 'LAN Framework', difficulty: 5 },
      { label: 'Contiguity', difficulty: 5 },
      { label: 'Asymptotic Efficiency', difficulty: 4 },
      { label: 'U-Statistics', difficulty: 4 },
    ],
    count: 8,
    badge: 'Advanced',
    badgeVariant: 'muted' as const,
  },
  {
    id: 'bayesian',
    href: '/topics/bayesian',
    title: 'Bayesian Inference',
    description: 'Prior specification, conjugate families, exact posterior computation, the Bernstein-von Mises theorem, posterior contraction rates, and nonparametric Bayes.',
    concepts: [
      { label: 'Bayes\' Theorem', difficulty: 1 },
      { label: 'Conjugate Families', difficulty: 2 },
      { label: 'Posterior Predictive', difficulty: 2 },
      { label: 'Jeffreys Prior', difficulty: 3 },
      { label: 'Bernstein-von Mises', difficulty: 4 },
      { label: 'Posterior Contraction', difficulty: 5 },
      { label: 'MCMC Theory', difficulty: 4 },
      { label: 'Bayesian Nonparametrics', difficulty: 5 },
    ],
    count: 8,
    badge: 'Core',
    badgeVariant: 'accent' as const,
  },
]

const DIFFICULTY_LABELS: Record<number, string> = {
  1: 'Intro',
  2: 'Intermediate',
  3: 'Advanced',
  4: 'Graduate',
  5: 'Research',
}

const DIFFICULTY_COLORS: Record<number, 'muted' | 'default' | 'accent' | 'crimson' | 'forest'> = {
  1: 'forest',
  2: 'forest',
  3: 'accent',
  4: 'muted',
  5: 'crimson',
}

export default function TopicsPage() {
  return (
    <div className="min-h-full">
      <PageHeader
        title="Topic Explorer"
        eyebrow="Explore"
        description="Statistical theory organized by subject. Each topic contains rigorous definitions, theorems, and interactive explorations."
      />

      <div className="px-8 py-8 space-y-5">
        {TOPICS.map(topic => (
          <Link
            key={topic.id}
            href={topic.href}
            className="group block rounded-md border border-border bg-surface p-6 transition-shadow hover:shadow-card-hover"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="font-serif text-2xl text-text group-hover:text-accent transition-colors">
                    {topic.title}
                  </h2>
                  <Badge variant={topic.badgeVariant}>{topic.badge}</Badge>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed max-w-2xl">
                  {topic.description}
                </p>

                {/* Concept chips */}
                <div className="mt-4 flex flex-wrap gap-2">
                  {topic.concepts.map(c => (
                    <span
                      key={c.label}
                      className="flex items-center gap-1.5 rounded bg-elevated border border-border px-2.5 py-1 text-xs text-text-secondary"
                    >
                      {c.label}
                      <Badge variant={DIFFICULTY_COLORS[c.difficulty]} className="scale-90">
                        {DIFFICULTY_LABELS[c.difficulty]}
                      </Badge>
                    </span>
                  ))}
                </div>
              </div>

              <ArrowRight
                size={16}
                className="mt-1 flex-shrink-0 text-text-muted opacity-0 transition-opacity group-hover:opacity-100"
              />
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
