import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { PageHeader } from '@/components/primitives/PageHeader'
import { Badge } from '@/components/primitives/Badge'
import { DistributionEngineLoader } from '@/components/content/widgets/distributions/DistributionEngineLoader'

// ── Minimal registry for page metadata ───────────────────────────────────────
const REGISTRY: Record<string, { name: string; notation: string; params: string[] }> = {
  normal:            { name: 'Normal Distribution',          notation: 'N(μ, σ²)',         params: ['μ (location)', 'σ² (scale)'] },
  exponential:       { name: 'Exponential Distribution',     notation: 'Exp(λ)',            params: ['λ (rate)'] },
  poisson:           { name: 'Poisson Distribution',         notation: 'Pois(λ)',           params: ['λ (rate)'] },
  beta:              { name: 'Beta Distribution',            notation: 'Beta(α, β)',        params: ['α (shape)', 'β (shape)'] },
  gamma:             { name: 'Gamma Distribution',           notation: 'Gamma(α, β)',       params: ['α (shape)', 'β (rate)'] },
  bernoulli:         { name: 'Bernoulli Distribution',       notation: 'Bern(p)',           params: ['p (success probability)'] },
  binomial:          { name: 'Binomial Distribution',        notation: 'Bin(n, p)',         params: ['n (trials)', 'p (success probability)'] },
  'student-t':       { name: 'Student-t Distribution',       notation: 't(ν)',              params: ['ν (degrees of freedom)'] },
  'chi-squared':     { name: 'Chi-Squared Distribution',     notation: 'χ²(k)',             params: ['k (degrees of freedom)'] },
  uniform:           { name: 'Uniform Distribution',         notation: 'U(a, b)',           params: ['a (lower)', 'b (upper)'] },
  pareto:            { name: 'Pareto Distribution',          notation: 'Pareto(α, xₘ)',     params: ['α (shape)', 'xₘ (scale)'] },
  lognormal:         { name: 'Log-Normal Distribution',      notation: 'LN(μ, σ²)',         params: ['μ (log-mean)', 'σ² (log-variance)'] },
  weibull:           { name: 'Weibull Distribution',         notation: 'Weibull(k, λ)',     params: ['k (shape)', 'λ (scale)'] },
  cauchy:            { name: 'Cauchy Distribution',          notation: 'Cauchy(x₀, γ)',     params: ['x₀ (location)', 'γ (scale)'] },
  laplace:           { name: 'Laplace Distribution',         notation: 'Laplace(μ, b)',     params: ['μ (location)', 'b (scale)'] },
  logistic:          { name: 'Logistic Distribution',        notation: 'Logistic(μ, s)',    params: ['μ (location)', 's (scale)'] },
  'inverse-gamma':   { name: 'Inverse-Gamma Distribution',   notation: 'IG(α, β)',          params: ['α (shape)', 'β (scale)'] },
  'f-dist':          { name: 'F Distribution',               notation: 'F(d₁, d₂)',         params: ['d₁ (df numerator)', 'd₂ (df denominator)'] },
  gumbel:            { name: 'Gumbel Distribution',          notation: 'Gumbel(μ, β)',      params: ['μ (location)', 'β (scale)'] },
  'negative-binomial': { name: 'Negative Binomial Distribution', notation: 'NB(r, p)',     params: ['r (successes)', 'p (probability)'] },
  geometric:         { name: 'Geometric Distribution',       notation: 'Geom(p)',           params: ['p (success probability)'] },
  hypergeometric:    { name: 'Hypergeometric Distribution',  notation: 'HG(N, K, n)',       params: ['N (population)', 'K (successes in pop)', 'n (draws)'] },
}

// ── Map page ID → engine distribution ID ─────────────────────────────────────
// The URL IDs on this site may differ from the engine's internal IDs.
const ENGINE_ID: Record<string, string> = {
  normal:              'normal',
  exponential:         'exponential',
  poisson:             'poisson',
  beta:                'beta',
  gamma:               'gamma',
  binomial:            'binomial',
  'student-t':         'student-t',
  'chi-squared':       'chi-squared',
  uniform:             'uniform',
  pareto:              'pareto',
  lognormal:           'log-normal',
  weibull:             'weibull',
  cauchy:              'cauchy',
  laplace:             'laplace',
  'negative-binomial': 'neg-binomial',
  geometric:           'geometric',
  // No engine equivalent — fall back to normal
  bernoulli:           'binomial',   // closest discrete
  logistic:            'normal',
  'inverse-gamma':     'gamma',
  'f-dist':            'chi-squared',
  gumbel:              'gev',
  hypergeometric:      'binomial',
}

interface Props {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const dist = REGISTRY[id]
  if (!dist) return { title: 'Distribution Not Found' }
  return {
    title: dist.name,
    description: `Properties, estimation, and relationships for the ${dist.name}`,
  }
}

export default async function DistributionPage({ params }: Props) {
  const { id } = await params
  const dist = REGISTRY[id]

  if (!dist) notFound()

  const engineId = ENGINE_ID[id] ?? 'normal'

  return (
    <div className="min-h-full">
      <PageHeader
        title={dist.name}
        eyebrow="Distribution Lab"
        description={dist.notation}
        actions={
          <div className="flex flex-wrap gap-1.5">
            {dist.params.map(p => (
              <Badge key={p} variant="muted">{p}</Badge>
            ))}
          </div>
        }
      />

      <div className="px-8 py-8">
        <div
          className="overflow-hidden rounded-md border border-border bg-surface"
          style={{ height: 560 }}
          data-widget="distribution-engine"
        >
          <DistributionEngineLoader initialDist={engineId} />
        </div>
        <p className="mt-2 text-[11px] text-text-muted text-center">
          Adjust parameters in the left panel · Switch tabs for Density, Sampling, Tails, Moments, and Compare
        </p>
      </div>
    </div>
  )
}
