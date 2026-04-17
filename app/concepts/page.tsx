import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/primitives/PageHeader'
import { Badge } from '@/components/primitives/Badge'

export const metadata: Metadata = {
  title: 'All Concepts',
  description: 'Complete index of statistical concepts',
}

// Concept manifest — will be replaced by MDX content layer
const CONCEPTS = [
  // Estimation
  { id: 'fisher-information', title: 'Fisher Information', topic: 'Estimation Theory', difficulty: 2, href: '/concepts/fisher-information' },
  { id: 'cramer-rao-bound', title: 'Cramér-Rao Lower Bound', topic: 'Estimation Theory', difficulty: 2, href: '/concepts/cramer-rao-bound' },
  { id: 'sufficiency', title: 'Sufficiency & Completeness', topic: 'Estimation Theory', difficulty: 3, href: '/concepts/sufficiency' },
  { id: 'mle', title: 'Maximum Likelihood Estimation', topic: 'Estimation Theory', difficulty: 2, href: '/concepts/mle' },
  { id: 'umvue', title: 'UMVUE & Rao-Blackwell', topic: 'Estimation Theory', difficulty: 3, href: '/concepts/umvue' },
  { id: 'exponential-family', title: 'Exponential Families', topic: 'Estimation Theory', difficulty: 3, href: '/concepts/exponential-family' },
  // Testing
  { id: 'neyman-pearson', title: 'Neyman-Pearson Lemma', topic: 'Hypothesis Testing', difficulty: 2, href: '/concepts/neyman-pearson' },
  { id: 'ump-tests', title: 'UMP & UMPU Tests', topic: 'Hypothesis Testing', difficulty: 3, href: '/concepts/ump-tests' },
  { id: 'likelihood-ratio', title: 'Likelihood Ratio Tests', topic: 'Hypothesis Testing', difficulty: 3, href: '/concepts/likelihood-ratio' },
  { id: 'power-analysis', title: 'Power Analysis', topic: 'Hypothesis Testing', difficulty: 2, href: '/concepts/power-analysis' },
  // Asymptotics
  { id: 'clt-variants', title: 'CLT Variants', topic: 'Asymptotic Theory', difficulty: 3, href: '/concepts/clt-variants' },
  { id: 'berry-esseen', title: 'Berry-Esseen Theorem', topic: 'Asymptotic Theory', difficulty: 3, href: '/concepts/berry-esseen' },
  { id: 'delta-method', title: 'Delta Method', topic: 'Asymptotic Theory', difficulty: 2, href: '/concepts/delta-method' },
  { id: 'lan', title: 'Local Asymptotic Normality', topic: 'Asymptotic Theory', difficulty: 5, href: '/concepts/lan' },
  { id: 'contiguity', title: 'Contiguity', topic: 'Asymptotic Theory', difficulty: 5, href: '/concepts/contiguity' },
  // Bayesian
  { id: 'conjugate-priors', title: 'Conjugate Priors', topic: 'Bayesian Inference', difficulty: 2, href: '/concepts/conjugate-priors' },
  { id: 'bernstein-von-mises', title: 'Bernstein-von Mises Theorem', topic: 'Bayesian Inference', difficulty: 4, href: '/concepts/bernstein-von-mises' },
  { id: 'posterior-contraction', title: 'Posterior Contraction Rates', topic: 'Bayesian Inference', difficulty: 5, href: '/concepts/posterior-contraction' },
  { id: 'mcmc', title: 'MCMC Methods', topic: 'Bayesian Inference', difficulty: 4, href: '/concepts/mcmc' },
]

const DIFFICULTY_LABEL: Record<number, string> = {
  1: 'Intro', 2: 'Intermediate', 3: 'Advanced', 4: 'Graduate', 5: 'Research',
}

const DIFFICULTY_VARIANT: Record<number, 'forest' | 'accent' | 'muted' | 'crimson'> = {
  1: 'forest', 2: 'forest', 3: 'accent', 4: 'muted', 5: 'crimson',
}

// Group by topic
const grouped = CONCEPTS.reduce<Record<string, typeof CONCEPTS>>((acc, c) => {
  if (!acc[c.topic]) acc[c.topic] = []
  acc[c.topic].push(c)
  return acc
}, {})

export default function ConceptsPage() {
  return (
    <div className="min-h-full">
      <PageHeader
        title="All Concepts"
        eyebrow="Explore"
        description={`${CONCEPTS.length} concepts across 4 topics. Each concept will have exact definitions, theorems, proofs, and interactive widgets.`}
      />

      <div className="px-8 py-8 space-y-8">
        {Object.entries(grouped).map(([topic, concepts]) => (
          <section key={topic}>
            <p className="label-xs mb-3">{topic}</p>
            <div className="divide-y divide-border rounded-md border border-border overflow-hidden">
              {concepts.map(c => (
                <Link
                  key={c.id}
                  href={c.href}
                  className="flex items-center justify-between gap-4 bg-surface px-5 py-3.5 transition-colors hover:bg-elevated group"
                >
                  <span className="text-sm text-text-secondary group-hover:text-text transition-colors">
                    {c.title}
                  </span>
                  <Badge variant={DIFFICULTY_VARIANT[c.difficulty]}>
                    {DIFFICULTY_LABEL[c.difficulty]}
                  </Badge>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
