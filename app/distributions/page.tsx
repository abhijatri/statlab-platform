import type { Metadata } from 'next'
import Link from 'next/link'
import { PageHeader } from '@/components/primitives/PageHeader'
import { Badge } from '@/components/primitives/Badge'
import { DistributionEngineLoader } from '@/components/content/widgets/distributions/DistributionEngineLoader'

export const metadata: Metadata = {
  title: 'Distribution Lab',
  description: 'Properties, estimation, and relationships of probability distributions',
}

// ── Distribution manifest ─────────────────────────────────────────────────────
// This will eventually be generated from the plugin registry.
// Kept here as static data until the plugin system is implemented.

type SupportType = 'real' | 'positive' | 'bounded' | 'integer' | 'non-negative-integer'
type FamilyType = 'exponential' | 'location-scale' | 'shape-scale' | 'bounded' | 'other'

interface DistributionEntry {
  id: string
  name: string
  notation: string
  support: SupportType
  family: FamilyType
  tags: string[]
}

const DISTRIBUTIONS: DistributionEntry[] = [
  // Continuous
  { id: 'normal', name: 'Normal', notation: 'N(μ, σ²)', support: 'real', family: 'location-scale', tags: ['continuous', 'symmetric', 'conjugate'] },
  { id: 'student-t', name: 'Student-t', notation: 't(ν)', support: 'real', family: 'location-scale', tags: ['continuous', 'symmetric', 'heavy-tail'] },
  { id: 'cauchy', name: 'Cauchy', notation: 'Cauchy(x₀, γ)', support: 'real', family: 'location-scale', tags: ['continuous', 'heavy-tail', 'no-moments'] },
  { id: 'laplace', name: 'Laplace', notation: 'Laplace(μ, b)', support: 'real', family: 'location-scale', tags: ['continuous', 'symmetric'] },
  { id: 'logistic', name: 'Logistic', notation: 'Logistic(μ, s)', support: 'real', family: 'location-scale', tags: ['continuous', 'symmetric'] },
  { id: 'exponential', name: 'Exponential', notation: 'Exp(λ)', support: 'positive', family: 'exponential', tags: ['continuous', 'memoryless', 'conjugate'] },
  { id: 'gamma', name: 'Gamma', notation: 'Gamma(α, β)', support: 'positive', family: 'shape-scale', tags: ['continuous', 'conjugate'] },
  { id: 'inverse-gamma', name: 'Inverse-Gamma', notation: 'IG(α, β)', support: 'positive', family: 'shape-scale', tags: ['continuous', 'conjugate'] },
  { id: 'chi-squared', name: 'Chi-Squared', notation: 'χ²(k)', support: 'positive', family: 'shape-scale', tags: ['continuous', 'sampling'] },
  { id: 'f-dist', name: 'F Distribution', notation: 'F(d₁, d₂)', support: 'positive', family: 'other', tags: ['continuous', 'sampling'] },
  { id: 'beta', name: 'Beta', notation: 'Beta(α, β)', support: 'bounded', family: 'bounded', tags: ['continuous', 'conjugate'] },
  { id: 'weibull', name: 'Weibull', notation: 'Weibull(k, λ)', support: 'positive', family: 'shape-scale', tags: ['continuous', 'reliability'] },
  { id: 'pareto', name: 'Pareto', notation: 'Pareto(α, xₘ)', support: 'positive', family: 'shape-scale', tags: ['continuous', 'heavy-tail', 'power-law'] },
  { id: 'lognormal', name: 'Log-Normal', notation: 'LN(μ, σ²)', support: 'positive', family: 'location-scale', tags: ['continuous', 'skewed'] },
  { id: 'uniform', name: 'Uniform', notation: 'U(a, b)', support: 'bounded', family: 'location-scale', tags: ['continuous', 'bounded', 'non-regular'] },
  { id: 'gumbel', name: 'Gumbel', notation: 'Gumbel(μ, β)', support: 'real', family: 'location-scale', tags: ['continuous', 'extreme-value'] },
  // Discrete
  { id: 'bernoulli', name: 'Bernoulli', notation: 'Bern(p)', support: 'integer', family: 'exponential', tags: ['discrete', 'conjugate'] },
  { id: 'binomial', name: 'Binomial', notation: 'Bin(n, p)', support: 'non-negative-integer', family: 'exponential', tags: ['discrete', 'conjugate'] },
  { id: 'poisson', name: 'Poisson', notation: 'Pois(λ)', support: 'non-negative-integer', family: 'exponential', tags: ['discrete', 'conjugate'] },
  { id: 'negative-binomial', name: 'Negative Binomial', notation: 'NB(r, p)', support: 'non-negative-integer', family: 'exponential', tags: ['discrete', 'over-dispersed'] },
  { id: 'geometric', name: 'Geometric', notation: 'Geom(p)', support: 'non-negative-integer', family: 'exponential', tags: ['discrete', 'memoryless'] },
  { id: 'hypergeometric', name: 'Hypergeometric', notation: 'HG(N, K, n)', support: 'non-negative-integer', family: 'other', tags: ['discrete', 'sampling'] },
]

const SUPPORT_LABELS: Record<SupportType, string> = {
  real: 'ℝ',
  positive: 'ℝ₊',
  bounded: '[0,1]',
  integer: '{0,1}',
  'non-negative-integer': 'ℕ₀',
}

const SUPPORT_BADGE: Record<SupportType, 'accent' | 'forest' | 'muted'> = {
  real: 'accent',
  positive: 'forest',
  bounded: 'muted',
  integer: 'muted',
  'non-negative-integer': 'muted',
}

export default function DistributionsPage() {
  const continuous = DISTRIBUTIONS.filter(d => d.tags.includes('continuous'))
  const discrete = DISTRIBUTIONS.filter(d => d.tags.includes('discrete'))

  return (
    <div className="min-h-full">
      <PageHeader
        title="Distribution Lab"
        eyebrow="Modules"
        description="Properties, moments, Fisher information, MLE, and inter-distribution relationships for every major probability family."
      />

      {/* ── Interactive engine ── */}
      <div className="px-4 pt-6 pb-2 md:px-8 md:pt-8">
        <div
          className="overflow-hidden rounded-md border border-border bg-surface"
          style={{ height: 560 }}
        >
          <DistributionEngineLoader />
        </div>
        <p className="mt-2 text-[11px] text-text-muted text-center">
          Select any distribution in the left panel · Adjust parameters · Explore Density, Sampling, Tails, Moments, and Compare tabs
        </p>
      </div>

      <div className="px-4 py-6 md:px-8 md:py-8 space-y-10">

        {[
          { label: 'Continuous Distributions', items: continuous },
          { label: 'Discrete Distributions', items: discrete },
        ].map(group => (
          <section key={group.label}>
            <p className="label-xs mb-4">{group.label}</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {group.items.map(dist => (
                <Link
                  key={dist.id}
                  href={`/distributions/${dist.id}`}
                  className="group flex flex-col gap-2 rounded-md border border-border bg-surface px-4 py-3.5 transition-shadow hover:shadow-card-hover"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-medium text-text group-hover:text-accent transition-colors truncate">
                      {dist.name}
                    </h3>
                    <Badge variant={SUPPORT_BADGE[dist.support]}>
                      {SUPPORT_LABELS[dist.support]}
                    </Badge>
                  </div>
                  <code className="font-mono text-xs text-text-muted">{dist.notation}</code>
                  <div className="flex flex-wrap gap-1">
                    {dist.tags.filter(t => !['continuous','discrete'].includes(t)).map(tag => (
                      <span key={tag} className="rounded bg-elevated px-1.5 py-0.5 text-2xs text-text-muted">
                        {tag}
                      </span>
                    ))}
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}

      </div>
    </div>
  )
}
