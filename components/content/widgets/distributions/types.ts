// ── Distribution type system ──────────────────────────────────────────────────

export type Params = Record<string, number>

export interface ParamSpec {
  key: string
  label: string
  min: number
  max: number
  step: number
  default: number
  description?: string
}

/** A single statistical distribution, fully self-contained. */
export interface DistributionDef {
  id: string
  name: string
  category: DistCategory
  description: string
  /** LaTeX/Unicode formula snippet shown in UI */
  pdfFormula: string

  params: ParamSpec[]

  /** True if this is a discrete (integer-valued) distribution. */
  isDiscrete?: boolean

  /** True if this is a 2D distribution (copula or multivariate). */
  is2D?: boolean

  // ── Domain ────────────────────────────────────────────────────────────────
  /** True mathematical support (may include ±Infinity). */
  support: (p: Params) => [number, number]
  /** Practical x-range for smooth PDF/CDF plots. */
  plotDomain: (p: Params) => [number, number]

  // ── Density / PMF ─────────────────────────────────────────────────────────
  /** For continuous: PDF f(x). For discrete: PMF P(X=k). */
  pdf: (x: number, p: Params) => number
  cdf: (x: number, p: Params) => number
  /** Inverse CDF — may use bisection internally. */
  quantile: (u: number, p: Params) => number

  // ── Sampling ──────────────────────────────────────────────────────────────
  sample: (n: number, p: Params) => number[]

  // ── Moments (null = undefined/infinite) ──────────────────────────────────
  mean:     (p: Params) => number | null
  variance: (p: Params) => number | null
  skewness: (p: Params) => number | null
  kurtosis: (p: Params) => number | null   // excess kurtosis
  entropy?:  (p: Params) => number | null

  // ── 2D extensions (for copulas and multivariate) ──────────────────────────
  density2d?:    (x: number, y: number, p: Params) => number
  sample2d?:     (n: number, p: Params) => [number, number][]
  plotDomain2d?: (p: Params) => { x: [number, number]; y: [number, number] }
}

export type DistCategory =
  | 'classical'
  | 'heavy-tail'
  | 'extreme-value'
  | 'multivariate'
  | 'advanced'
  | 'discrete'
  | 'copula'

export const CATEGORY_LABEL: Record<DistCategory, string> = {
  'classical':     'Classical',
  'heavy-tail':    'Heavy-Tail',
  'extreme-value': 'Extreme Value',
  'multivariate':  'Multivariate',
  'advanced':      'Advanced',
  'discrete':      'Discrete',
  'copula':        'Copula',
}

/** Display helper: format a moment value with ∞/undefined handling. */
export function fmtMoment(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  if (!isFinite(v)) return v > 0 ? '+∞' : '−∞'
  const a = Math.abs(v)
  if (a === 0) return '0'
  if (a >= 1e4 || (a < 0.001 && a > 0)) return v.toExponential(3)
  return v.toPrecision(5).replace(/\.?0+$/, '')
}
