// ── All distribution definitions ──────────────────────────────────────────────
// Each definition is self-contained: PDF/PMF, CDF, quantile, sampling, moments.
// Import only from ./math and ./types.

import {
  erf, erfc, lgamma, lbeta, gammaP, betainc,
  normalPDF, normalCDF, normalQuantile, owensT,
  randNormal, randGamma, randBeta,
  bisectQuantile, linspace,
  digamma, logBinom, randPoisson, randBinomial, randInvGaussian,
} from './math'
import type { DistributionDef, Params } from './types'

// ── Internal helpers ──────────────────────────────────────────────────────────

const PI    = Math.PI
const EULER = 0.5772156649015328   // Euler-Mascheroni constant

function sq(x: number) { return x * x }
function fill(n: number, f: () => number): number[] {
  const a = new Array<number>(n)
  for (let i = 0; i < n; i++) a[i] = f()
  return a
}
function clamp01(x: number) { return Math.max(0, Math.min(1, x)) }

// ═══════════════════════════════════════════════════════════════════════════
// CLASSICAL
// ═══════════════════════════════════════════════════════════════════════════

const normal: DistributionDef = {
  id: 'normal', name: 'Normal', category: 'classical',
  description: 'The Gaussian — bell-shaped, defined by mean μ and scale σ. Ubiquitous via CLT.',
  pdfFormula: 'f(x) = 1/(σ√(2π)) · exp(−(x−μ)²/2σ²)',
  params: [
    { key: 'mu',    label: 'μ (mean)',  min: -5,  max: 5,   step: 0.1,  default: 0 },
    { key: 'sigma', label: 'σ (std)',   min: 0.1, max: 4,   step: 0.05, default: 1 },
  ],
  support:    () => [-Infinity, Infinity],
  plotDomain: (p) => [p.mu - 4*p.sigma, p.mu + 4*p.sigma],
  pdf:      (x, p) => normalPDF((x - p.mu) / p.sigma) / p.sigma,
  cdf:      (x, p) => normalCDF((x - p.mu) / p.sigma),
  quantile: (u, p) => p.mu + p.sigma * normalQuantile(u),
  sample:   (n, p) => fill(n, () => p.mu + p.sigma * randNormal()),
  mean:     (p) => p.mu,
  variance: (p) => sq(p.sigma),
  skewness: () => 0,
  kurtosis: () => 0,
  entropy:  (p) => 0.5 * Math.log(2 * PI * Math.E * sq(p.sigma)),
}

const uniform: DistributionDef = {
  id: 'uniform', name: 'Uniform', category: 'classical',
  description: 'Constant density on [a,b]. Maximum-entropy distribution for bounded support.',
  pdfFormula: 'f(x) = 1/(b−a)  for x ∈ [a,b]',
  params: [
    { key: 'a', label: 'a (min)', min: -5, max: 4, step: 0.1, default: 0 },
    { key: 'b', label: 'b (max)', min: -4, max: 5, step: 0.1, default: 1 },
  ],
  support:    (p) => [p.a, p.b],
  plotDomain: (p) => [p.a - 0.3*(p.b-p.a), p.b + 0.3*(p.b-p.a)],
  pdf:      (x, p) => (x < p.a || x > p.b || p.a >= p.b) ? 0 : 1 / (p.b - p.a),
  cdf:      (x, p) => x < p.a ? 0 : x > p.b ? 1 : (x - p.a) / (p.b - p.a),
  quantile: (u, p) => p.a + (p.b - p.a) * u,
  sample:   (n, p) => fill(n, () => p.a + (p.b - p.a) * Math.random()),
  mean:     (p) => (p.a + p.b) / 2,
  variance: (p) => sq(p.b - p.a) / 12,
  skewness: () => 0,
  kurtosis: () => -1.2,
  entropy:  (p) => Math.log(p.b - p.a),
}

const exponential: DistributionDef = {
  id: 'exponential', name: 'Exponential', category: 'classical',
  description: 'Memoryless waiting-time distribution. Limiting case of Geometric.',
  pdfFormula: 'f(x) = λ · exp(−λx)  for x ≥ 0',
  params: [
    { key: 'lambda', label: 'λ (rate)', min: 0.1, max: 5, step: 0.05, default: 1 },
  ],
  support:    () => [0, Infinity],
  plotDomain: (p) => [0, 5 / p.lambda],
  pdf:      (x, p) => x < 0 ? 0 : p.lambda * Math.exp(-p.lambda * x),
  cdf:      (x, p) => x < 0 ? 0 : 1 - Math.exp(-p.lambda * x),
  quantile: (u, p) => -Math.log(1 - u) / p.lambda,
  sample:   (n, p) => fill(n, () => -Math.log(Math.random()) / p.lambda),
  mean:     (p) => 1 / p.lambda,
  variance: (p) => 1 / sq(p.lambda),
  skewness: () => 2,
  kurtosis: () => 6,
  entropy:  (p) => 1 - Math.log(p.lambda),
}

const gamma_: DistributionDef = {
  id: 'gamma', name: 'Gamma', category: 'classical',
  description: 'Models wait times for α events. Generalises Exponential and Chi-Squared.',
  pdfFormula: 'f(x) = β^α/Γ(α) · x^{α−1} exp(−βx)',
  params: [
    { key: 'alpha', label: 'α (shape)', min: 0.5, max: 10, step: 0.1,  default: 2 },
    { key: 'beta',  label: 'β (rate)',  min: 0.1, max: 5,  step: 0.05, default: 1 },
  ],
  support:    () => [0, Infinity],
  plotDomain: (p) => [0, (p.alpha + 4 * Math.sqrt(p.alpha)) / p.beta * 1.3],
  pdf: (x, p) => {
    if (x <= 0) return 0
    return Math.exp(p.alpha*Math.log(p.beta) + (p.alpha-1)*Math.log(x) - p.beta*x - lgamma(p.alpha))
  },
  cdf:      (x, p) => x <= 0 ? 0 : gammaP(p.alpha, p.beta * x),
  quantile: (u, p) => {
    const m = p.alpha / p.beta, s = Math.sqrt(p.alpha) / p.beta
    return bisectQuantile(x => gammaP(p.alpha, p.beta * x), 0, m + 10*s, u)
  },
  sample:   (n, p) => fill(n, () => randGamma(p.alpha, 1 / p.beta)),
  mean:     (p) => p.alpha / p.beta,
  variance: (p) => p.alpha / sq(p.beta),
  skewness: (p) => 2 / Math.sqrt(p.alpha),
  kurtosis: (p) => 6 / p.alpha,
  entropy:  (p) => p.alpha - Math.log(p.beta) + lgamma(p.alpha) + (1 - p.alpha) * digamma(p.alpha),
}

const beta_: DistributionDef = {
  id: 'beta', name: 'Beta', category: 'classical',
  description: 'Probability of a probability. Flexible shape on [0,1] — conjugate to Binomial.',
  pdfFormula: 'f(x) = x^{α−1}(1−x)^{β−1} / B(α,β)',
  params: [
    { key: 'alpha', label: 'α', min: 0.1, max: 10, step: 0.1, default: 2 },
    { key: 'beta',  label: 'β', min: 0.1, max: 10, step: 0.1, default: 3 },
  ],
  support:    () => [0, 1],
  plotDomain: () => [0, 1],
  pdf: (x, p) => {
    if (x <= 0 || x >= 1) return 0
    return Math.exp((p.alpha-1)*Math.log(x) + (p.beta-1)*Math.log(1-x) - lbeta(p.alpha, p.beta))
  },
  cdf:      (x, p) => clamp01(betainc(x, p.alpha, p.beta)),
  quantile: (u, p) => bisectQuantile(x => betainc(x, p.alpha, p.beta), 0, 1, u),
  sample:   (n, p) => fill(n, () => randBeta(p.alpha, p.beta)),
  mean:     (p) => p.alpha / (p.alpha + p.beta),
  variance: (p) => { const s = p.alpha + p.beta; return p.alpha*p.beta / (s*s*(s+1)) },
  skewness: (p) => 2*(p.beta-p.alpha)*Math.sqrt(p.alpha+p.beta+1) /
    ((p.alpha+p.beta+2)*Math.sqrt(p.alpha*p.beta)),
  kurtosis: (p) => {
    const {alpha: a, beta: b} = p, s = a+b
    return 6*(sq(a-b)*(s+1) - a*b*(s+2)) / (a*b*(s+2)*(s+3))
  },
  // H = lnB(α,β) − (α−1)ψ(α) − (β−1)ψ(β) + (α+β−2)ψ(α+β)
  entropy: (p) => {
    const {alpha: a, beta: b} = p
    return lbeta(a, b) - (a-1)*digamma(a) - (b-1)*digamma(b) + (a+b-2)*digamma(a+b)
  },
}

const chiSquared: DistributionDef = {
  id: 'chi-squared', name: 'Chi-Squared', category: 'classical',
  description: 'Sum of k squared standard normals. Central to χ²/likelihood-ratio tests.',
  pdfFormula: 'f(x) = x^{k/2−1} e^{−x/2} / (2^{k/2} Γ(k/2))',
  params: [
    { key: 'k', label: 'k (df)', min: 1, max: 30, step: 1, default: 3 },
  ],
  support:    () => [0, Infinity],
  plotDomain: (p) => [0, Math.max(10, p.k + 5*Math.sqrt(2*p.k))],
  pdf: (x, p) => x <= 0 ? 0 : Math.exp(
    (p.k/2-1)*Math.log(x) - x/2 - (p.k/2)*Math.log(2) - lgamma(p.k/2)
  ),
  cdf:      (x, p) => x <= 0 ? 0 : gammaP(p.k/2, x/2),
  quantile: (u, p) => bisectQuantile(x => gammaP(p.k/2, x/2), 0, p.k + 10*Math.sqrt(2*p.k), u),
  sample:   (n, p) => fill(n, () => randGamma(p.k/2, 2)),
  mean:     (p) => p.k,
  variance: (p) => 2 * p.k,
  skewness: (p) => Math.sqrt(8 / p.k),
  kurtosis: (p) => 12 / p.k,
  // H = k/2 + ln(2) + lnΓ(k/2) + (1−k/2)ψ(k/2)
  entropy: (p) => p.k/2 + Math.log(2) + lgamma(p.k/2) + (1 - p.k/2)*digamma(p.k/2),
}

// ═══════════════════════════════════════════════════════════════════════════
// HEAVY-TAIL
// ═══════════════════════════════════════════════════════════════════════════

const cauchy: DistributionDef = {
  id: 'cauchy', name: 'Cauchy', category: 'heavy-tail',
  description: 'Location-scale distribution with undefined mean and variance. All moments diverge.',
  pdfFormula: 'f(x) = 1/(πγ(1+((x−x₀)/γ)²))',
  params: [
    { key: 'x0',    label: 'x₀ (loc)',  min: -3,  max: 3, step: 0.1, default: 0 },
    { key: 'gamma', label: 'γ (scale)', min: 0.1, max: 5, step: 0.1, default: 1 },
  ],
  support:    () => [-Infinity, Infinity],
  plotDomain: (p) => [p.x0 - 8*p.gamma, p.x0 + 8*p.gamma],
  pdf:      (x, p) => 1 / (PI * p.gamma * (1 + sq((x - p.x0) / p.gamma))),
  cdf:      (x, p) => 0.5 + Math.atan((x - p.x0) / p.gamma) / PI,
  quantile: (u, p) => p.x0 + p.gamma * Math.tan(PI * (u - 0.5)),
  sample:   (n, p) => fill(n, () => p.x0 + p.gamma * Math.tan(PI * (Math.random() - 0.5))),
  mean:     () => null,
  variance: () => null,
  skewness: () => null,
  kurtosis: () => null,
  entropy:  (p) => Math.log(4 * PI * p.gamma),
}

const studentT: DistributionDef = {
  id: 'student-t', name: 'Student-t', category: 'heavy-tail',
  description: 'Interpolates Normal (ν→∞) and Cauchy (ν=1). Essential for small-sample inference.',
  pdfFormula: 'f(x) = Γ((ν+1)/2)/(√(νπ)Γ(ν/2)) · (1+x²/ν)^{−(ν+1)/2}',
  params: [
    { key: 'nu', label: 'ν (df)', min: 0.5, max: 30, step: 0.5, default: 5 },
  ],
  support:    () => [-Infinity, Infinity],
  plotDomain: (p) => [-(6 + 4/p.nu), 6 + 4/p.nu],
  pdf: (x, p) => {
    const v = p.nu
    return Math.exp(lgamma((v+1)/2) - lgamma(v/2) - 0.5*Math.log(v*PI)
      - ((v+1)/2) * Math.log(1 + sq(x)/v))
  },
  cdf: (x, p) => {
    const v = p.nu, t = v / (v + sq(x))
    const ib = 0.5 * betainc(t, v/2, 0.5)
    return x >= 0 ? 1 - ib : ib
  },
  quantile: (u, p) => {
    const v = p.nu
    return bisectQuantile(x => {
      const t = v / (v + sq(x)); const ib = 0.5 * betainc(t, v/2, 0.5)
      return x >= 0 ? 1 - ib : ib
    }, -(50+10/v), 50+10/v, u)
  },
  sample: (n, p) => fill(n, () => randNormal() / Math.sqrt(randGamma(p.nu/2, 2/p.nu))),
  mean:     (p) => p.nu > 1 ? 0 : null,
  variance: (p) => p.nu > 2 ? p.nu/(p.nu-2) : null,
  skewness: (p) => p.nu > 3 ? 0 : null,
  kurtosis: (p) => p.nu > 4 ? 6/(p.nu-4) : null,
  // H = (ν+1)/2·[ψ((ν+1)/2)−ψ(ν/2)] + ½ln(ν) + lnB(ν/2,½)
  entropy: (p) => {
    const v = p.nu
    return (v+1)/2*(digamma((v+1)/2) - digamma(v/2)) + 0.5*Math.log(v) + lbeta(v/2, 0.5)
  },
}

const pareto: DistributionDef = {
  id: 'pareto', name: 'Pareto', category: 'heavy-tail',
  description: 'Power-law tail — the "80-20 rule". Shape α controls tail heaviness.',
  pdfFormula: 'f(x) = α·xₘ^α / x^{α+1}  for x ≥ xₘ',
  params: [
    { key: 'xm',    label: 'xₘ (min)',  min: 0.1, max: 5, step: 0.1, default: 1 },
    { key: 'alpha', label: 'α (shape)', min: 0.5, max: 5, step: 0.1, default: 2 },
  ],
  support:    (p) => [p.xm, Infinity],
  plotDomain: (p) => [p.xm, p.xm * Math.pow(1/(1-0.98), 1/p.alpha)],
  pdf:      (x, p) => x < p.xm ? 0 : p.alpha * Math.pow(p.xm, p.alpha) / Math.pow(x, p.alpha+1),
  cdf:      (x, p) => x < p.xm ? 0 : 1 - Math.pow(p.xm/x, p.alpha),
  quantile: (u, p) => p.xm / Math.pow(1 - u, 1/p.alpha),
  sample:   (n, p) => fill(n, () => p.xm / Math.pow(Math.random(), 1/p.alpha)),
  mean:     (p) => p.alpha > 1 ? p.alpha*p.xm/(p.alpha-1) : null,
  variance: (p) => p.alpha > 2 ? sq(p.xm)*p.alpha/(sq(p.alpha-1)*(p.alpha-2)) : null,
  skewness: (p) => p.alpha > 3 ? 2*(1+p.alpha)/(p.alpha-3)*Math.sqrt((p.alpha-2)/p.alpha) : null,
  kurtosis: (p) => p.alpha > 4 ? 6*(sq(p.alpha)+p.alpha-6)/(p.alpha*(p.alpha-3)*(p.alpha-4)) : null,
  entropy:  (p) => Math.log(p.xm / p.alpha) + 1 + 1/p.alpha,
}

const levy: DistributionDef = {
  id: 'levy', name: 'Lévy', category: 'heavy-tail',
  description: 'α-stable with α=½, β=1. Extreme heavy right tail; mean and variance undefined.',
  pdfFormula: 'f(x) = √(c/2π) · exp(−c/(2(x−μ))) / (x−μ)^{3/2}',
  params: [
    { key: 'mu', label: 'μ (loc)',   min: -3, max: 3, step: 0.1, default: 0 },
    { key: 'c',  label: 'c (scale)', min: 0.1, max: 5, step: 0.1, default: 1 },
  ],
  support:    (p) => [p.mu, Infinity],
  plotDomain: (p) => {
    const hi = p.mu + p.c / sq(normalQuantile(0.025))
    return [p.mu, Math.max(p.mu + 0.1, hi) * 1.1]
  },
  pdf: (x, p) => {
    const z = x - p.mu; if (z <= 0) return 0
    return Math.sqrt(p.c / (2*PI)) * Math.exp(-p.c / (2*z)) / Math.pow(z, 1.5)
  },
  cdf: (x, p) => {
    const z = x - p.mu; if (z <= 0) return 0
    return erfc(Math.sqrt(p.c / (2*z)))
  },
  quantile: (u, p) => {
    if (u <= 0) return p.mu; if (u >= 1) return Infinity
    return p.mu + p.c / sq(normalQuantile(1 - u/2))
  },
  sample: (n, p) => fill(n, () => { const z = randNormal(); return p.mu + p.c / sq(z) }),
  mean:     () => null,
  variance: () => null,
  skewness: () => null,
  kurtosis: () => null,
  // H = (1 + 3γ + ln(16πc²)) / 2
  entropy: (p) => (1 + 3*EULER + Math.log(16 * PI * sq(p.c))) / 2,
}

const logNormal: DistributionDef = {
  id: 'log-normal', name: 'Log-Normal', category: 'heavy-tail',
  description: 'If ln X ~ N(μ,σ²). Models multiplicative processes; right-skewed.',
  pdfFormula: 'f(x) = 1/(xσ√(2π)) · exp(−(ln x−μ)²/2σ²)',
  params: [
    { key: 'mu',    label: 'μ',  min: -2,  max: 3,  step: 0.1,  default: 0   },
    { key: 'sigma', label: 'σ',  min: 0.1, max: 2,  step: 0.05, default: 0.5 },
  ],
  support:    () => [0, Infinity],
  plotDomain: (p) => [0, Math.exp(p.mu + 3*p.sigma) * 1.1],
  pdf: (x, p) => {
    if (x <= 0) return 0
    return normalPDF((Math.log(x) - p.mu) / p.sigma) / (x * p.sigma)
  },
  cdf:      (x, p) => x <= 0 ? 0 : normalCDF((Math.log(x) - p.mu) / p.sigma),
  quantile: (u, p) => Math.exp(p.mu + p.sigma * normalQuantile(u)),
  sample:   (n, p) => fill(n, () => Math.exp(p.mu + p.sigma * randNormal())),
  mean:     (p) => Math.exp(p.mu + sq(p.sigma)/2),
  variance: (p) => (Math.exp(sq(p.sigma))-1) * Math.exp(2*p.mu + sq(p.sigma)),
  skewness: (p) => (Math.exp(sq(p.sigma))+2) * Math.sqrt(Math.exp(sq(p.sigma))-1),
  kurtosis: (p) => {
    const es2 = Math.exp(sq(p.sigma))
    return es2*es2*es2*es2 + 2*es2*es2*es2 + 3*es2*es2 - 6
  },
  // H = μ + ½(1 + ln(2πσ²))
  entropy: (p) => p.mu + 0.5 * (1 + Math.log(2 * PI * sq(p.sigma))),
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTREME VALUE
// ═══════════════════════════════════════════════════════════════════════════

const gev: DistributionDef = {
  id: 'gev', name: 'GEV', category: 'extreme-value',
  description: 'Generalised Extreme Value: Gumbel (ξ=0), Fréchet (ξ>0), Weibull-type (ξ<0).',
  pdfFormula: 'F(x) = exp(−(1+ξ(x−μ)/σ)^{−1/ξ})',
  params: [
    { key: 'mu',    label: 'μ (loc)',   min: -3,   max: 3,   step: 0.1,  default: 0   },
    { key: 'sigma', label: 'σ (scale)', min: 0.1,  max: 3,   step: 0.1,  default: 1   },
    { key: 'xi',    label: 'ξ (shape)', min: -0.8, max: 0.8, step: 0.05, default: 0.2 },
  ],
  support: (p) => {
    if (Math.abs(p.xi) < 1e-8) return [-Infinity, Infinity]
    const bound = p.mu - p.sigma / p.xi
    return p.xi > 0 ? [bound, Infinity] : [-Infinity, bound]
  },
  plotDomain: (p) => [_gevQ(0.002, p.mu, p.sigma, p.xi), _gevQ(0.998, p.mu, p.sigma, p.xi)],
  pdf: (x, p) => {
    const {mu, sigma, xi} = p
    if (Math.abs(xi) < 1e-8) {
      const t = (x - mu) / sigma
      return Math.exp(-t - Math.exp(-t)) / sigma
    }
    const z = 1 + xi * (x - mu) / sigma
    if (z <= 0) return 0
    return Math.exp(-(1/xi + 1)*Math.log(z) - Math.pow(z, -1/xi)) / sigma
  },
  cdf: (x, p) => {
    const {mu, sigma, xi} = p
    if (Math.abs(xi) < 1e-8) return Math.exp(-Math.exp(-(x-mu)/sigma))
    const z = 1 + xi*(x-mu)/sigma
    if (z <= 0) return xi > 0 ? 0 : 1
    return Math.exp(-Math.pow(z, -1/xi))
  },
  quantile: (u, p) => _gevQ(u, p.mu, p.sigma, p.xi),
  sample:   (n, p) => fill(n, () => _gevQ(Math.random(), p.mu, p.sigma, p.xi)),
  mean: (p) => {
    const xi = p.xi
    if (Math.abs(xi) < 1e-8) return p.mu + p.sigma * EULER
    if (xi >= 1) return null
    return p.mu + p.sigma * (Math.exp(lgamma(1-xi)) - 1) / xi
  },
  variance: (p) => {
    const xi = p.xi
    if (xi >= 0.5) return null
    if (Math.abs(xi) < 1e-8) return sq(p.sigma) * sq(PI) / 6
    const g1 = Math.exp(lgamma(1-xi)), g2 = Math.exp(lgamma(1-2*xi))
    return sq(p.sigma) * (g2 - sq(g1)) / sq(xi)
  },
  skewness: (p) => {
    const xi = p.xi
    if (xi >= 1/3) return null
    if (Math.abs(xi) < 1e-8) return 12*Math.sqrt(6)*1.2020569/sq(PI)  // ≈1.1395
    const g1 = Math.exp(lgamma(1-xi))
    const g2 = Math.exp(lgamma(1-2*xi))
    const g3 = Math.exp(lgamma(1-3*xi))
    // Derived from raw-moment expansion: sign(ξ)·(g3−3g1g2+2g1³)/(g2−g1²)^{3/2}
    return Math.sign(xi) * (g3 - 3*g1*g2 + 2*g1*g1*g1) / Math.pow(g2 - sq(g1), 1.5)
  },
  kurtosis: (p) => {
    const xi = p.xi
    if (xi >= 0.25) return null
    if (Math.abs(xi) < 1e-8) return 2.4   // Gumbel excess kurtosis = 12/5
    const g = (k: number) => Math.exp(lgamma(1 - k*xi))
    const [g1,g2,g3,g4] = [g(1),g(2),g(3),g(4)]
    // Raw moments of standardised GEV (μ=0,σ=1): E[X^r] = (g_{r}−C(r,1)g_{r-1}+…)/ξ^r
    const m  = (g1-1)/xi
    const rm2 = (1 - 2*g1 + g2) / sq(xi)
    const rm3 = (-1 + 3*g1 - 3*g2 + g3) / (xi**3)
    const rm4 = (1 - 4*g1 + 6*g2 - 4*g3 + g4) / (xi**4)
    const mu2 = rm2 - sq(m)
    const mu4 = rm4 - 4*m*rm3 + 6*sq(m)*rm2 - 3*m**4
    return mu4 / sq(mu2) - 3
  },
  // H = ln(σ) + γ(ξ+1) + 1
  entropy: (p) => Math.log(p.sigma) + EULER*(p.xi + 1) + 1,
}

function _gevQ(u: number, mu: number, sigma: number, xi: number): number {
  if (u <= 0) return xi > 0 ? mu - sigma/xi : -Infinity
  if (u >= 1) return xi < 0 ? mu - sigma/xi : Infinity
  const lnU = -Math.log(u)
  if (Math.abs(xi) < 1e-8) return mu - sigma * Math.log(lnU)
  return mu + sigma * (Math.pow(lnU, -xi) - 1) / xi
}

const gpd: DistributionDef = {
  id: 'gpd', name: 'GPD', category: 'extreme-value',
  description: 'Generalised Pareto — limit distribution of threshold exceedances.',
  pdfFormula: 'f(x) = (1/σ)(1+ξx/σ)^{−1/ξ−1}',
  params: [
    { key: 'xi',    label: 'ξ (shape)', min: -0.8, max: 1,  step: 0.05, default: 0.3 },
    { key: 'sigma', label: 'σ (scale)', min: 0.1,  max: 5,  step: 0.1,  default: 1   },
    { key: 'mu',    label: 'μ (thresh)',min: -2,   max: 2,  step: 0.1,  default: 0   },
  ],
  support: (p) => p.xi >= 0 ? [p.mu, Infinity] : [p.mu, p.mu - p.sigma/p.xi],
  plotDomain: (p) => [p.mu, _gpdQ(0.995, p.xi, p.sigma, p.mu)],
  pdf: (x, p) => {
    const z = (x - p.mu) / p.sigma
    if (z < 0) return 0
    if (Math.abs(p.xi) < 1e-8) return Math.exp(-z) / p.sigma
    const t = 1 + p.xi * z; if (t <= 0) return 0
    return Math.pow(t, -1/p.xi - 1) / p.sigma
  },
  cdf: (x, p) => {
    const z = (x - p.mu) / p.sigma; if (z < 0) return 0
    if (Math.abs(p.xi) < 1e-8) return 1 - Math.exp(-z)
    const t = 1 + p.xi * z; if (t <= 0) return p.xi < 0 ? 1 : 0
    return 1 - Math.pow(t, -1/p.xi)
  },
  quantile: (u, p) => _gpdQ(u, p.xi, p.sigma, p.mu),
  sample:   (n, p) => fill(n, () => _gpdQ(Math.random(), p.xi, p.sigma, p.mu)),
  mean:     (p) => p.xi < 1   ? p.mu + p.sigma/(1-p.xi)                       : null,
  variance: (p) => p.xi < 0.5 ? sq(p.sigma)/((1-p.xi)*(1-p.xi)*(1-2*p.xi))   : null,
  skewness: (p) => p.xi < 1/3 ? 2*(1+p.xi)*Math.sqrt(1-2*p.xi)/(1-3*p.xi)    : null,
  kurtosis: (p) => {
    if (p.xi >= 0.25) return null
    const xi = p.xi, s = p.sigma
    // E[X^r] = r! * σ^r / ∏_{k=1}^r (1−kξ)  (location shift doesn't affect kurtosis)
    const m1 = s/(1-xi)
    const m2 = 2*sq(s)/((1-xi)*(1-2*xi))
    const m3 = 6*s**3/((1-xi)*(1-2*xi)*(1-3*xi))
    const m4 = 24*s**4/((1-xi)*(1-2*xi)*(1-3*xi)*(1-4*xi))
    const v = m2 - sq(m1)
    const mu4 = m4 - 4*m1*m3 + 6*sq(m1)*m2 - 3*m1**4
    return mu4/sq(v) - 3
  },
  entropy: (p) => Math.log(p.sigma) + p.xi + 1,
}

function _gpdQ(u: number, xi: number, sigma: number, mu: number): number {
  if (u >= 1) return xi >= 0 ? Infinity : mu - sigma/xi
  if (Math.abs(xi) < 1e-8) return mu - sigma * Math.log(1 - u)
  return mu + sigma * (Math.pow(1-u, -xi) - 1) / xi
}

// ═══════════════════════════════════════════════════════════════════════════
// ADVANCED
// ═══════════════════════════════════════════════════════════════════════════

const weibull: DistributionDef = {
  id: 'weibull', name: 'Weibull', category: 'advanced',
  description: 'Flexible lifetime distribution. Exponential (k=1), Rayleigh (k=2), normal-like (k≈3.6).',
  pdfFormula: 'f(x) = (k/λ)(x/λ)^{k−1} exp(−(x/λ)^k)',
  params: [
    { key: 'k',      label: 'k (shape)', min: 0.2, max: 5, step: 0.1, default: 2 },
    { key: 'lambda', label: 'λ (scale)', min: 0.1, max: 5, step: 0.1, default: 1 },
  ],
  support:    () => [0, Infinity],
  plotDomain: (p) => [0, p.lambda * Math.pow(-Math.log(0.001), 1/p.k) * 1.05],
  pdf: (x, p) => {
    if (x <= 0) return 0
    const z = x / p.lambda
    return (p.k/p.lambda) * Math.pow(z, p.k-1) * Math.exp(-Math.pow(z, p.k))
  },
  cdf:      (x, p) => x <= 0 ? 0 : 1 - Math.exp(-Math.pow(x/p.lambda, p.k)),
  quantile: (u, p) => p.lambda * Math.pow(-Math.log(1-u), 1/p.k),
  sample:   (n, p) => fill(n, () => p.lambda * Math.pow(-Math.log(Math.random()), 1/p.k)),
  mean:     (p) => p.lambda * Math.exp(lgamma(1 + 1/p.k)),
  variance: (p) => sq(p.lambda) * (Math.exp(lgamma(1+2/p.k)) - sq(Math.exp(lgamma(1+1/p.k)))),
  skewness: (p) => {
    const [g1, g2, g3] = [lgamma(1+1/p.k), lgamma(1+2/p.k), lgamma(1+3/p.k)].map(Math.exp)
    const mu = p.lambda*g1, v = sq(p.lambda)*(g2-sq(g1))
    return (p.lambda**3*g3 - 3*mu*v - mu**3) / Math.pow(v, 1.5)
  },
  kurtosis: (p) => {
    const [g1,g2,g3,g4] = [1,2,3,4].map(r => Math.exp(lgamma(1+r/p.k)))
    const mu = p.lambda*g1
    const m2 = sq(p.lambda)*g2, m3 = p.lambda**3*g3, m4 = p.lambda**4*g4
    const v = m2 - sq(mu)
    const mu4 = m4 - 4*mu*m3 + 6*sq(mu)*m2 - 3*mu**4
    return mu4/sq(v) - 3
  },
  // H = γ(1−1/k) + ln(λ/k) + 1
  entropy: (p) => EULER*(1 - 1/p.k) + Math.log(p.lambda / p.k) + 1,
}

const laplace: DistributionDef = {
  id: 'laplace', name: 'Laplace', category: 'advanced',
  description: 'Double-exponential. Heavier tails than Normal; used in L₁ regression (LASSO prior).',
  pdfFormula: 'f(x) = (1/2b) exp(−|x−μ|/b)',
  params: [
    { key: 'mu', label: 'μ (loc)',   min: -4, max: 4, step: 0.1, default: 0 },
    { key: 'b',  label: 'b (scale)', min: 0.1, max: 5, step: 0.1, default: 1 },
  ],
  support:    () => [-Infinity, Infinity],
  plotDomain: (p) => [p.mu - 6*p.b, p.mu + 6*p.b],
  pdf:  (x, p) => Math.exp(-Math.abs(x - p.mu) / p.b) / (2 * p.b),
  cdf:  (x, p) => {
    const z = (x - p.mu) / p.b
    return z < 0 ? 0.5 * Math.exp(z) : 1 - 0.5 * Math.exp(-z)
  },
  quantile: (u, p) => {
    if (u < 0.5) return p.mu + p.b * Math.log(2 * u)
    return p.mu - p.b * Math.log(2 * (1 - u))
  },
  sample: (n, p) => fill(n, () => {
    const u = Math.random()
    return u < 0.5 ? p.mu + p.b*Math.log(2*u) : p.mu - p.b*Math.log(2*(1-u))
  }),
  mean:     (p) => p.mu,
  variance: (p) => 2 * sq(p.b),
  skewness: () => 0,
  kurtosis: () => 3,
  entropy:  (p) => 1 + Math.log(2 * p.b),
}

const skewNormal: DistributionDef = {
  id: 'skew-normal', name: 'Skew-Normal', category: 'advanced',
  description: '3-parameter generalisation of Normal. α=0 recovers N(ξ,ω²). Named after Azzalini.',
  pdfFormula: 'f(x) = 2/ω · φ((x−ξ)/ω) · Φ(α(x−ξ)/ω)',
  params: [
    { key: 'xi',    label: 'ξ (loc)',   min: -4,  max: 4, step: 0.1,  default: 0 },
    { key: 'omega', label: 'ω (scale)', min: 0.1, max: 4, step: 0.1,  default: 1 },
    { key: 'alpha', label: 'α (shape)', min: -8,  max: 8, step: 0.25, default: 3 },
  ],
  support:    () => [-Infinity, Infinity],
  plotDomain: (p) => {
    const d = p.alpha / Math.sqrt(1 + sq(p.alpha))
    const mu = p.xi + p.omega * d * Math.sqrt(2/PI)
    const s = p.omega * Math.sqrt(1 - 2*sq(d)/PI) * 4
    return [mu - 4*s, mu + 4*s]
  },
  pdf: (x, p) => {
    const z = (x - p.xi) / p.omega
    return 2 * normalPDF(z) * normalCDF(p.alpha * z) / p.omega
  },
  cdf: (x, p) => {
    const z = (x - p.xi) / p.omega
    return normalCDF(z) - 2 * owensT(z, p.alpha)
  },
  quantile: (u, p) => {
    const [lo, hi] = skewNormal.plotDomain(p)
    return bisectQuantile(x => skewNormal.cdf(x, p), lo - 10, hi + 10, u)
  },
  sample: (n, p) => fill(n, () => {
    for (;;) {
      const z = randNormal()
      if (Math.random() < normalCDF(p.alpha * z)) return p.xi + p.omega * z
    }
  }),
  mean: (p) => {
    const d = p.alpha / Math.sqrt(1 + sq(p.alpha))
    return p.xi + p.omega * d * Math.sqrt(2/PI)
  },
  variance: (p) => {
    const d = p.alpha / Math.sqrt(1 + sq(p.alpha))
    return sq(p.omega) * (1 - 2*sq(d)/PI)
  },
  skewness: (p) => {
    const d = p.alpha / Math.sqrt(1 + sq(p.alpha))
    const c = (4-PI)/2, v = sq(d) * 2/PI
    return c * Math.pow(v, 1.5) / Math.pow(1-v, 1.5)
  },
  kurtosis: () => null,  // No compact closed form
}

const betaPrime: DistributionDef = {
  id: 'beta-prime', name: 'Beta-Prime', category: 'advanced',
  description: 'Inverted beta — ratio of two Gamma variates. Support (0,∞) with flexible shape.',
  pdfFormula: 'f(x) = x^{α−1}(1+x)^{−α−β}/B(α,β)',
  params: [
    { key: 'alpha', label: 'α', min: 0.5, max: 8, step: 0.1, default: 3 },
    { key: 'beta',  label: 'β', min: 1,   max: 8, step: 0.1, default: 4 },
  ],
  support:    () => [0, Infinity],
  plotDomain: (p) => {
    const mode = p.alpha > 1 ? (p.alpha-1)/(p.beta+1) : 0
    const hi = Math.max(mode * 5, (p.alpha/(p.beta-1)) * 4)
    return [0, isFinite(hi) && hi > 0.5 ? hi : 10]
  },
  pdf: (x, p) => {
    if (x <= 0) return 0
    return Math.exp((p.alpha-1)*Math.log(x) - (p.alpha+p.beta)*Math.log(1+x) - lbeta(p.alpha, p.beta))
  },
  cdf:      (x, p) => x <= 0 ? 0 : betainc(x/(1+x), p.alpha, p.beta),
  quantile: (u, p) => bisectQuantile(x => betainc(x/(1+x), p.alpha, p.beta), 0, 1e6, u),
  sample:   (n, p) => fill(n, () => randGamma(p.alpha) / randGamma(p.beta)),
  mean:     (p) => p.beta > 1 ? p.alpha/(p.beta-1) : null,
  variance: (p) => p.beta > 2 ? p.alpha*(p.alpha+p.beta-1)/(sq(p.beta-1)*(p.beta-2)) : null,
  skewness: (p) => p.beta > 3
    ? 2*(2*p.alpha+p.beta-1)/(p.beta-3)*Math.sqrt((p.beta-2)/(p.alpha*(p.alpha+p.beta-1)))
    : null,
  kurtosis: (p) => {
    if (p.beta <= 4) return null
    const {alpha: a, beta: b} = p
    // Raw moments E[X^r] = a(a+1)…(a+r−1) / (b−1)(b−2)…(b−r)
    const m1 = a/(b-1)
    const m2 = a*(a+1)/((b-1)*(b-2))
    const m3 = a*(a+1)*(a+2)/((b-1)*(b-2)*(b-3))
    const m4 = a*(a+1)*(a+2)*(a+3)/((b-1)*(b-2)*(b-3)*(b-4))
    const v = m2 - sq(m1)
    const mu4 = m4 - 4*m1*m3 + 6*sq(m1)*m2 - 3*m1**4
    return mu4/sq(v) - 3
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// ADVANCED — NEW DISTRIBUTIONS
// ═══════════════════════════════════════════════════════════════════════════

const inverseGaussian: DistributionDef = {
  id: 'inverse-gaussian', name: 'Inverse-Gaussian', category: 'advanced',
  description: 'First-passage time of Brownian motion to a boundary. Also called the Wald distribution.',
  pdfFormula: 'f(x) = √(λ/2πx³) · exp(−λ(x−μ)²/(2μ²x))',
  params: [
    { key: 'mu',     label: 'μ (mean)',   min: 0.2, max: 5, step: 0.1, default: 1 },
    { key: 'lambda', label: 'λ (shape)',  min: 0.1, max: 8, step: 0.1, default: 1 },
  ],
  support:    () => [0, Infinity],
  plotDomain: (p) => {
    const q99 = bisectQuantile(x => {
      const t1 = normalCDF(Math.sqrt(p.lambda/x)*(x/p.mu - 1))
      const t2 = Math.exp(2*p.lambda/p.mu) * normalCDF(-Math.sqrt(p.lambda/x)*(x/p.mu + 1))
      return t1 + t2
    }, 0, p.mu + 6*Math.sqrt(p.mu**3/p.lambda), 0.995)
    return [0, q99 * 1.05]
  },
  pdf: (x, p) => {
    if (x <= 0) return 0
    return Math.sqrt(p.lambda / (2*PI*x**3)) * Math.exp(-p.lambda*sq(x-p.mu) / (2*sq(p.mu)*x))
  },
  cdf: (x, p) => {
    if (x <= 0) return 0
    const r = Math.sqrt(p.lambda/x)
    return normalCDF(r*(x/p.mu - 1)) + Math.exp(2*p.lambda/p.mu)*normalCDF(-r*(x/p.mu + 1))
  },
  quantile: (u, p) => {
    const m = p.mu, s = Math.sqrt(p.mu**3/p.lambda)
    return bisectQuantile(x => {
      if (x <= 0) return 0
      const r = Math.sqrt(p.lambda/x)
      return normalCDF(r*(x/m-1)) + Math.exp(2*p.lambda/m)*normalCDF(-r*(x/m+1))
    }, 0, m + 10*s, u)
  },
  sample:   (n, p) => fill(n, () => randInvGaussian(p.mu, p.lambda)),
  mean:     (p) => p.mu,
  variance: (p) => p.mu**3 / p.lambda,
  skewness: (p) => 3 * Math.sqrt(p.mu / p.lambda),
  kurtosis: (p) => 15 * p.mu / p.lambda,
}

const kumaraswamy: DistributionDef = {
  id: 'kumaraswamy', name: 'Kumaraswamy', category: 'advanced',
  description: 'Beta-like distribution on (0,1) with a fully closed-form CDF — no incomplete beta needed.',
  pdfFormula: 'f(x) = abx^{a−1}(1−x^a)^{b−1}',
  params: [
    { key: 'a', label: 'a (shape₁)', min: 0.2, max: 8, step: 0.1, default: 2 },
    { key: 'b', label: 'b (shape₂)', min: 0.2, max: 8, step: 0.1, default: 3 },
  ],
  support:    () => [0, 1],
  plotDomain: () => [0, 1],
  pdf: (x, p) => {
    if (x <= 0 || x >= 1) return 0
    return p.a * p.b * Math.pow(x, p.a-1) * Math.pow(1 - Math.pow(x, p.a), p.b-1)
  },
  cdf:      (x, p) => x <= 0 ? 0 : x >= 1 ? 1 : 1 - Math.pow(1 - Math.pow(x, p.a), p.b),
  quantile: (u, p) => Math.pow(1 - Math.pow(1-u, 1/p.b), 1/p.a),
  sample:   (n, p) => fill(n, () => Math.pow(1 - Math.pow(1-Math.random(), 1/p.b), 1/p.a)),
  // E[X^r] = b·B(1+r/a, b) = b·exp(lbeta(1+r/a, b))
  mean: (p) => p.b * Math.exp(lbeta(1 + 1/p.a, p.b)),
  variance: (p) => {
    const m1 = p.b * Math.exp(lbeta(1+1/p.a, p.b))
    const m2 = p.b * Math.exp(lbeta(1+2/p.a, p.b))
    return m2 - sq(m1)
  },
  skewness: (p) => {
    const mr = (r: number) => p.b * Math.exp(lbeta(1+r/p.a, p.b))
    const [m1,m2,m3] = [mr(1),mr(2),mr(3)]
    const v = m2 - sq(m1)
    return (m3 - 3*m1*m2 + 2*m1**3) / Math.pow(v, 1.5)
  },
  kurtosis: (p) => {
    const mr = (r: number) => p.b * Math.exp(lbeta(1+r/p.a, p.b))
    const [m1,m2,m3,m4] = [mr(1),mr(2),mr(3),mr(4)]
    const v = m2 - sq(m1)
    const mu4 = m4 - 4*m1*m3 + 6*sq(m1)*m2 - 3*m1**4
    return mu4/sq(v) - 3
  },
}

const truncatedNormal: DistributionDef = {
  id: 'truncated-normal', name: 'Truncated Normal', category: 'advanced',
  description: 'Normal distribution restricted to [lo, hi]. Ubiquitous in Bayesian models and constrained inference.',
  pdfFormula: 'f(x) = φ((x−μ)/σ) / (σ(Φ(β)−Φ(α)))',
  params: [
    { key: 'mu',    label: 'μ (mean)',   min: -4, max: 4,  step: 0.1,  default: 0  },
    { key: 'sigma', label: 'σ (scale)',  min: 0.1,max: 3,  step: 0.1,  default: 1  },
    { key: 'lo',    label: 'lo (lower)', min: -5, max: 3,  step: 0.1,  default: -2 },
    { key: 'hi',    label: 'hi (upper)', min: -3, max: 5,  step: 0.1,  default: 2  },
  ],
  support:    (p) => [p.lo, p.hi],
  plotDomain: (p) => [p.lo - 0.2, p.hi + 0.2],
  pdf: (x, p) => {
    if (x < p.lo || x > p.hi) return 0
    const za = (p.lo - p.mu) / p.sigma, zb = (p.hi - p.mu) / p.sigma
    const Z = normalCDF(zb) - normalCDF(za)
    if (Z < 1e-15) return 0
    return normalPDF((x - p.mu) / p.sigma) / (p.sigma * Z)
  },
  cdf: (x, p) => {
    if (x <= p.lo) return 0; if (x >= p.hi) return 1
    const za = (p.lo - p.mu) / p.sigma, zb = (p.hi - p.mu) / p.sigma
    const Z = normalCDF(zb) - normalCDF(za)
    if (Z < 1e-15) return 0.5
    return (normalCDF((x - p.mu) / p.sigma) - normalCDF(za)) / Z
  },
  quantile: (u, p) => {
    const za = (p.lo - p.mu) / p.sigma, zb = (p.hi - p.mu) / p.sigma
    const Fa = normalCDF(za), Fb = normalCDF(zb)
    return p.mu + p.sigma * normalQuantile(Fa + u * (Fb - Fa))
  },
  sample: (n, p) => fill(n, () => {
    const za = (p.lo - p.mu) / p.sigma, zb = (p.hi - p.mu) / p.sigma
    const Fa = normalCDF(za), Fb = normalCDF(zb)
    return p.mu + p.sigma * normalQuantile(Fa + Math.random() * (Fb - Fa))
  }),
  mean: (p) => {
    const za = (p.lo - p.mu) / p.sigma, zb = (p.hi - p.mu) / p.sigma
    const Z = normalCDF(zb) - normalCDF(za)
    if (Z < 1e-15) return p.mu
    return p.mu + p.sigma * (normalPDF(za) - normalPDF(zb)) / Z
  },
  variance: (p) => {
    const za = (p.lo - p.mu) / p.sigma, zb = (p.hi - p.mu) / p.sigma
    const Z = normalCDF(zb) - normalCDF(za)
    if (Z < 1e-15) return 0
    const phi_ratio = (normalPDF(za) - normalPDF(zb)) / Z
    return sq(p.sigma) * (1 + (za*normalPDF(za) - zb*normalPDF(zb)) / Z - sq(phi_ratio))
  },
  skewness: () => null,
  kurtosis: () => null,
}

const gompertz: DistributionDef = {
  id: 'gompertz', name: 'Gompertz', category: 'advanced',
  description: 'Accelerating-hazard survival model. CDF = 1−exp(−η(e^{bx}−1)). Used in actuarial science.',
  pdfFormula: 'f(x) = ηb·exp(bx)·exp(−η(e^{bx}−1))',
  params: [
    { key: 'eta', label: 'η (scale)', min: 0.1, max: 3, step: 0.1, default: 0.5 },
    { key: 'b',   label: 'b (shape)', min: 0.1, max: 3, step: 0.1, default: 1   },
  ],
  support:    () => [0, Infinity],
  plotDomain: (p) => [0, _gompertzQ(0.995, p.eta, p.b) * 1.05],
  pdf: (x, p) => {
    if (x < 0) return 0
    return p.eta * p.b * Math.exp(p.b*x) * Math.exp(-p.eta*(Math.exp(p.b*x) - 1))
  },
  cdf:      (x, p) => x < 0 ? 0 : 1 - Math.exp(-p.eta*(Math.exp(p.b*x) - 1)),
  quantile: (u, p) => _gompertzQ(u, p.eta, p.b),
  sample:   (n, p) => fill(n, () => _gompertzQ(Math.random(), p.eta, p.b)),
  // Mean involves E₁ (exponential integral) — return null; numerics via sampling
  mean:     () => null,
  variance: () => null,
  skewness: () => null,
  kurtosis: () => null,
}

function _gompertzQ(u: number, eta: number, b: number): number {
  if (u >= 1) return Infinity
  const v = 1 - Math.log(1-u)/eta
  return v > 0 ? Math.log(v) / b : 0
}

const halfNormal: DistributionDef = {
  id: 'half-normal', name: 'Half-Normal', category: 'advanced',
  description: 'Folded normal, restricted to x≥0. Arises as |N(0,σ²)|. Used in hierarchical Bayesian models.',
  pdfFormula: 'f(x) = √(2/π)/σ · exp(−x²/2σ²)  for x ≥ 0',
  params: [
    { key: 'sigma', label: 'σ', min: 0.1, max: 4, step: 0.1, default: 1 },
  ],
  support:    () => [0, Infinity],
  plotDomain: (p) => [0, p.sigma * 4],
  pdf:      (x, p) => x < 0 ? 0 : Math.sqrt(2/PI) / p.sigma * Math.exp(-sq(x) / (2*sq(p.sigma))),
  cdf:      (x, p) => x < 0 ? 0 : erf(x / (p.sigma * Math.SQRT2)),
  quantile: (u, p) => p.sigma * normalQuantile((u + 1) / 2),
  sample:   (n, p) => fill(n, () => Math.abs(p.sigma * randNormal())),
  mean:     (p) => p.sigma * Math.sqrt(2/PI),
  variance: (p) => sq(p.sigma) * (1 - 2/PI),
  skewness: () => {
    const num = Math.sqrt(2/PI) * (4/PI - 1)
    return num / Math.pow(1 - 2/PI, 1.5)
  },
  // Excess kurtosis = 8(π−3)/(π−2)²
  kurtosis: () => 8*(Math.PI - 3) / sq(Math.PI - 2),
  // H = ln(σ√(πe/2))
  entropy: (p) => Math.log(p.sigma * Math.sqrt(Math.PI * Math.E / 2)),
}

const logUniform: DistributionDef = {
  id: 'log-uniform', name: 'Log-Uniform', category: 'advanced',
  description: 'Reciprocal distribution on [a,b]. Constant density on log scale. Scale-invariant Jeffreys prior.',
  pdfFormula: 'f(x) = 1/(x·ln(b/a))  for x ∈ [a,b]',
  params: [
    { key: 'a', label: 'a (min)', min: 0.01, max: 5,  step: 0.05, default: 1  },
    { key: 'b', label: 'b (max)', min: 0.1,  max: 20, step: 0.1,  default: 10 },
  ],
  support:    (p) => [p.a, p.b],
  plotDomain: (p) => [p.a * 0.9, p.b * 1.1],
  pdf: (x, p) => {
    if (x < p.a || x > p.b || p.a >= p.b) return 0
    return 1 / (x * Math.log(p.b / p.a))
  },
  cdf:      (x, p) => x <= p.a ? 0 : x >= p.b ? 1 : Math.log(x/p.a) / Math.log(p.b/p.a),
  quantile: (u, p) => p.a * Math.pow(p.b/p.a, u),
  sample:   (n, p) => fill(n, () => p.a * Math.pow(p.b/p.a, Math.random())),
  mean:     (p) => (p.b - p.a) / Math.log(p.b/p.a),
  variance: (p) => {
    const L = Math.log(p.b/p.a)
    return (sq(p.b) - sq(p.a)) / (2*L) - sq((p.b-p.a)/L)
  },
  skewness: () => null,
  kurtosis: () => null,
  // H = (ln(a)+ln(b))/2 + ln(ln(b/a))
  entropy: (p) => 0.5*(Math.log(p.a) + Math.log(p.b)) + Math.log(Math.log(p.b/p.a)),
}

const burr: DistributionDef = {
  id: 'burr', name: 'Burr XII', category: 'advanced',
  description: 'Two-parameter heavy-tail family. Nests Weibull (k→∞), Pareto, log-logistic (k=1). Widely used in reliability.',
  pdfFormula: 'f(x) = ck·x^{c−1}/(1+x^c)^{k+1}  for x>0',
  params: [
    { key: 'c', label: 'c (shape₁)', min: 0.5, max: 8, step: 0.1, default: 2 },
    { key: 'k', label: 'k (shape₂)', min: 0.5, max: 8, step: 0.1, default: 2 },
  ],
  support:    () => [0, Infinity],
  plotDomain: (p) => [0, Math.pow(Math.pow(0.001, -1/p.k) - 1, 1/p.c) * 1.1],
  pdf: (x, p) => {
    if (x <= 0) return 0
    return p.c * p.k * Math.pow(x, p.c-1) / Math.pow(1 + Math.pow(x, p.c), p.k+1)
  },
  cdf:      (x, p) => x <= 0 ? 0 : 1 - Math.pow(1 + Math.pow(x, p.c), -p.k),
  quantile: (u, p) => Math.pow(Math.pow(1-u, -1/p.k) - 1, 1/p.c),
  sample:   (n, p) => fill(n, () => Math.pow(Math.pow(Math.random(), -1/p.k) - 1, 1/p.c)),
  // E[X^r] = k·B(1+r/c, k−r/c) valid when ck > r
  mean: (p) => p.c*p.k > 1 ? p.k * Math.exp(lbeta(1+1/p.c, p.k-1/p.c)) : null,
  variance: (p) => {
    if (p.c*p.k <= 2) return null
    const mr = (r: number) => p.k * Math.exp(lbeta(1+r/p.c, p.k-r/p.c))
    return mr(2) - sq(mr(1))
  },
  skewness: (p) => {
    if (p.c*p.k <= 3) return null
    const mr = (r: number) => p.k * Math.exp(lbeta(1+r/p.c, p.k-r/p.c))
    const [m1,m2,m3] = [mr(1),mr(2),mr(3)]
    const v = m2 - sq(m1)
    return (m3 - 3*m1*m2 + 2*m1**3) / Math.pow(v, 1.5)
  },
  kurtosis: (p) => {
    if (p.c*p.k <= 4) return null
    const mr = (r: number) => p.k * Math.exp(lbeta(1+r/p.c, p.k-r/p.c))
    const [m1,m2,m3,m4] = [mr(1),mr(2),mr(3),mr(4)]
    const v = m2 - sq(m1)
    const mu4 = m4 - 4*m1*m3 + 6*sq(m1)*m2 - 3*m1**4
    return mu4/sq(v) - 3
  },
}

const lomax: DistributionDef = {
  id: 'lomax', name: 'Lomax', category: 'advanced',
  description: 'Pareto Type II / shifted Pareto — threshold at 0. Used in queuing, income modelling.',
  pdfFormula: 'f(x) = (α/λ)(1+x/λ)^{−α−1}  for x≥0',
  params: [
    { key: 'alpha',  label: 'α (shape)', min: 0.5, max: 8, step: 0.1, default: 2 },
    { key: 'lambda', label: 'λ (scale)', min: 0.1, max: 5, step: 0.1, default: 1 },
  ],
  support:    () => [0, Infinity],
  plotDomain: (p) => [0, p.lambda * (Math.pow(0.01, -1/p.alpha) - 1) * 1.05],
  pdf:      (x, p) => x < 0 ? 0 : (p.alpha/p.lambda) * Math.pow(1+x/p.lambda, -p.alpha-1),
  cdf:      (x, p) => x < 0 ? 0 : 1 - Math.pow(1+x/p.lambda, -p.alpha),
  quantile: (u, p) => p.lambda * (Math.pow(1-u, -1/p.alpha) - 1),
  sample:   (n, p) => fill(n, () => p.lambda * (Math.pow(Math.random(), -1/p.alpha) - 1)),
  mean:     (p) => p.alpha > 1 ? p.lambda/(p.alpha-1) : null,
  variance: (p) => p.alpha > 2 ? sq(p.lambda)*p.alpha/(sq(p.alpha-1)*(p.alpha-2)) : null,
  skewness: (p) => p.alpha > 3
    ? 2*(1+p.alpha)/(p.alpha-3)*Math.sqrt((p.alpha-2)/p.alpha)
    : null,
  kurtosis: (p) => {
    if (p.alpha <= 4) return null
    const a = p.alpha, s = p.lambda
    const m1 = s/(a-1)
    const m2 = 2*sq(s)/((a-1)*(a-2))
    const m3 = 6*s**3/((a-1)*(a-2)*(a-3))
    const m4 = 24*s**4/((a-1)*(a-2)*(a-3)*(a-4))
    const v = m2 - sq(m1)
    const mu4 = m4 - 4*m1*m3 + 6*sq(m1)*m2 - 3*m1**4
    return mu4/sq(v) - 3
  },
}

const dagum: DistributionDef = {
  id: 'dagum', name: 'Dagum', category: 'advanced',
  description: 'Income and wealth distribution model. CDF = (1+(b/x)^a)^{−p}. Flexible S-shaped CDF.',
  pdfFormula: 'f(x) = (ap/x)(b/x)^a(1+(b/x)^a)^{−p−1}',
  params: [
    { key: 'p', label: 'p (shape₁)', min: 0.2, max: 5, step: 0.1, default: 2 },
    { key: 'a', label: 'a (shape₂)', min: 0.5, max: 5, step: 0.1, default: 2 },
    { key: 'b', label: 'b (scale)',  min: 0.1, max: 5, step: 0.1, default: 1 },
  ],
  support:    () => [0, Infinity],
  plotDomain: (p) => {
    const q = (u: number) => p.b * Math.pow(Math.pow(u, -1/p.p) - 1, -1/p.a)
    return [0, q(0.995) * 1.05]
  },
  pdf: (x, p) => {
    if (x <= 0) return 0
    const ba = Math.pow(p.b/x, p.a)
    return (p.a * p.p / x) * ba * Math.pow(1 + ba, -p.p - 1)
  },
  cdf:      (x, p) => x <= 0 ? 0 : Math.pow(1 + Math.pow(p.b/x, p.a), -p.p),
  quantile: (u, p) => p.b * Math.pow(Math.pow(u, -1/p.p) - 1, -1/p.a),
  sample:   (n, p) => fill(n, () => p.b * Math.pow(Math.pow(Math.random(), -1/p.p) - 1, -1/p.a)),
  // E[X^r] = b^r · exp(lgamma(1+r/a) + lgamma(p−r/a) − lgamma(p)) for r/a < p
  mean: (p) => p.p > 1/p.a
    ? p.b * Math.exp(lgamma(1+1/p.a) + lgamma(p.p-1/p.a) - lgamma(p.p))
    : null,
  variance: (p) => {
    if (p.p <= 2/p.a) return null
    const mr = (r: number) => p.b**r * Math.exp(lgamma(1+r/p.a) + lgamma(p.p-r/p.a) - lgamma(p.p))
    return mr(2) - sq(mr(1))
  },
  skewness: (p) => {
    if (p.p <= 3/p.a) return null
    const mr = (r: number) => p.b**r * Math.exp(lgamma(1+r/p.a) + lgamma(p.p-r/p.a) - lgamma(p.p))
    const [m1,m2,m3] = [mr(1),mr(2),mr(3)]
    const v = m2 - sq(m1)
    return (m3 - 3*m1*m2 + 2*m1**3) / Math.pow(v, 1.5)
  },
  kurtosis: (p) => {
    if (p.p <= 4/p.a) return null
    const mr = (r: number) => p.b**r * Math.exp(lgamma(1+r/p.a) + lgamma(p.p-r/p.a) - lgamma(p.p))
    const [m1,m2,m3,m4] = [mr(1),mr(2),mr(3),mr(4)]
    const v = m2 - sq(m1)
    const mu4 = m4 - 4*m1*m3 + 6*sq(m1)*m2 - 3*m1**4
    return mu4/sq(v) - 3
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// MULTIVARIATE
// ═══════════════════════════════════════════════════════════════════════════

const bivariateNormal: DistributionDef = {
  id: 'bivariate-normal', name: 'Bivariate Normal', category: 'multivariate',
  description: 'Joint distribution of two correlated normals. ρ controls linear dependence.',
  pdfFormula: 'f(x,y) = exp(−Q/2) / (2πσ₁σ₂√(1−ρ²))',
  is2D: true,
  params: [
    { key: 'mu1',  label: 'μ₁',   min: -3,    max: 3,    step: 0.1,  default: 0   },
    { key: 'mu2',  label: 'μ₂',   min: -3,    max: 3,    step: 0.1,  default: 0   },
    { key: 'sig1', label: 'σ₁',   min: 0.2,   max: 3,    step: 0.1,  default: 1   },
    { key: 'sig2', label: 'σ₂',   min: 0.2,   max: 3,    step: 0.1,  default: 1   },
    { key: 'rho',  label: 'ρ',    min: -0.95, max: 0.95, step: 0.05, default: 0.5 },
  ],
  support:    () => [-Infinity, Infinity],
  plotDomain: (p) => [p.mu1 - 3.5*p.sig1, p.mu1 + 3.5*p.sig1],
  density2d: (x, y, p) => {
    const dx = (x-p.mu1)/p.sig1, dy = (y-p.mu2)/p.sig2, r = p.rho
    const q = (sq(dx) - 2*r*dx*dy + sq(dy)) / (1 - sq(r))
    return Math.exp(-0.5*q) / (2*PI*p.sig1*p.sig2*Math.sqrt(1-sq(r)))
  },
  sample2d: (n, p) => {
    const r = p.rho
    return Array.from({length: n}, () => {
      const z1 = randNormal(), z2 = randNormal()
      return [p.mu1 + p.sig1*z1, p.mu2 + p.sig2*(r*z1 + Math.sqrt(1-sq(r))*z2)] as [number,number]
    })
  },
  plotDomain2d: (p) => ({
    x: [p.mu1 - 3.5*p.sig1, p.mu1 + 3.5*p.sig1],
    y: [p.mu2 - 3.5*p.sig2, p.mu2 + 3.5*p.sig2],
  }),
  pdf:      (x, p) => normalPDF((x-p.mu1)/p.sig1)/p.sig1,
  cdf:      (x, p) => normalCDF((x-p.mu1)/p.sig1),
  quantile: (u, p) => p.mu1 + p.sig1 * normalQuantile(u),
  sample:   (n, p) => fill(n, () => p.mu1 + p.sig1 * randNormal()),
  mean:     (p) => p.mu1,
  variance: (p) => sq(p.sig1),
  skewness: () => 0,
  kurtosis: () => 0,
  entropy:  (p) => 0.5*Math.log(sq(p.sig1) * 2*PI*Math.E),
}

// ═══════════════════════════════════════════════════════════════════════════
// DISCRETE
// ═══════════════════════════════════════════════════════════════════════════

const binomial: DistributionDef = {
  id: 'binomial', name: 'Binomial', category: 'discrete',
  isDiscrete: true,
  description: 'Number of successes in n independent Bernoulli trials with probability p.',
  pdfFormula: 'P(X=k) = C(n,k)·p^k·(1−p)^{n−k}',
  params: [
    { key: 'n', label: 'n (trials)', min: 1,  max: 100, step: 1,    default: 20  },
    { key: 'p', label: 'p (prob)',   min: 0.01,max: 0.99,step: 0.01, default: 0.4 },
  ],
  support:    (p) => [0, p.n],
  plotDomain: (p) => [-0.5, p.n + 0.5],
  pdf: (x, p) => {
    const k = Math.round(x); if (k < 0 || k > p.n) return 0
    return Math.exp(logBinom(p.n, k) + k*Math.log(p.p) + (p.n-k)*Math.log(1-p.p))
  },
  cdf: (x, p) => {
    const k = Math.floor(x); if (k < 0) return 0; if (k >= p.n) return 1
    // Regularised incomplete beta: P(X≤k) = I_{1−p}(n−k, k+1)
    return betainc(1 - p.p, p.n - k, k + 1)
  },
  quantile: (u, p) => {
    return bisectQuantile(x => betainc(1 - p.p, p.n - Math.floor(x), Math.floor(x) + 1),
      -0.5, p.n + 0.5, u)
  },
  sample:   (n, p) => fill(n, () => randBinomial(Math.round(p.n), p.p)),
  mean:     (p) => p.n * p.p,
  variance: (p) => p.n * p.p * (1 - p.p),
  skewness: (p) => (1 - 2*p.p) / Math.sqrt(p.n * p.p * (1-p.p)),
  kurtosis: (p) => (1 - 6*p.p*(1-p.p)) / (p.n * p.p * (1-p.p)),
  // H ≈ ½ln(2πe·np(1−p)) for large n (exact is sum, this is the normal approximation)
  entropy: (p) => 0.5 * Math.log(2*PI*Math.E * p.n * p.p * (1-p.p)),
}

const poisson: DistributionDef = {
  id: 'poisson', name: 'Poisson', category: 'discrete',
  isDiscrete: true,
  description: 'Number of events in a fixed interval when events occur at rate λ. Mean = Variance = λ.',
  pdfFormula: 'P(X=k) = e^{−λ}·λ^k / k!',
  params: [
    { key: 'lambda', label: 'λ (rate)', min: 0.1, max: 30, step: 0.1, default: 5 },
  ],
  support:    () => [0, Infinity],
  plotDomain: (p) => [-0.5, Math.max(10, p.lambda + 4*Math.sqrt(p.lambda) + 0.5)],
  pdf: (x, p) => {
    const k = Math.round(x); if (k < 0) return 0
    return Math.exp(-p.lambda + k*Math.log(p.lambda) - lgamma(k+1))
  },
  cdf: (x, p) => {
    const k = Math.floor(x); if (k < 0) return 0
    // P(X≤k) = Q(k+1, λ) = 1 − Γ(k+1, λ)/Γ(k+1) = 1 − gammaP(k+1, λ) + ...
    // Actually P(X≤k) = gammaP via upper: P(X≤k)=Γ(k+1,λ)/k! = 1-gammaP(k+1,λ)? No:
    // P(X≤k) = e^{-λ}·Σ_{j=0}^k λ^j/j! = Q(k+1,λ) where Q is regularised upper Γ = 1-gammaP
    return 1 - gammaP(k + 1, p.lambda)
  },
  quantile: (u, p) => bisectQuantile(
    x => 1 - gammaP(Math.floor(x)+1, p.lambda),
    -0.5, p.lambda + 8*Math.sqrt(p.lambda) + 0.5, u
  ),
  sample:   (n, p) => fill(n, () => randPoisson(p.lambda)),
  mean:     (p) => p.lambda,
  variance: (p) => p.lambda,
  skewness: (p) => 1 / Math.sqrt(p.lambda),
  kurtosis: (p) => 1 / p.lambda,
  entropy:  (p) => 0.5*Math.log(2*PI*Math.E*p.lambda) - 1/(12*p.lambda),  // Stirling approx
}

const negBinomial: DistributionDef = {
  id: 'neg-binomial', name: 'Neg. Binomial', category: 'discrete',
  isDiscrete: true,
  description: 'Failures before r-th success. Generalises Geometric; overdispersed alternative to Poisson.',
  pdfFormula: 'P(X=k) = C(k+r−1,k)·p^r·(1−p)^k',
  params: [
    { key: 'r', label: 'r (successes)', min: 1,   max: 20,  step: 1,    default: 5   },
    { key: 'p', label: 'p (success)',   min: 0.05, max: 0.95,step: 0.05, default: 0.5 },
  ],
  support:    () => [0, Infinity],
  plotDomain: (p) => [-0.5, Math.max(15, p.r*(1-p.p)/p.p + 4*Math.sqrt(p.r*(1-p.p)/sq(p.p)) + 0.5)],
  pdf: (x, p) => {
    const k = Math.round(x); if (k < 0) return 0
    return Math.exp(logBinom(k+p.r-1, k) + p.r*Math.log(p.p) + k*Math.log(1-p.p))
  },
  cdf: (x, p) => {
    const k = Math.floor(x); if (k < 0) return 0
    return betainc(p.p, p.r, k + 1)
  },
  quantile: (u, p) => bisectQuantile(
    x => betainc(p.p, p.r, Math.floor(x)+1),
    -0.5, p.r*(1-p.p)/p.p + 10*Math.sqrt(p.r*(1-p.p)/sq(p.p)) + 0.5, u
  ),
  sample: (n, p) => fill(n, () => {
    // NB as Poisson mixture: X|G ~ Pois(G), G ~ Gamma(r, (1-p)/p)
    const g = randGamma(p.r, (1-p.p)/p.p)
    return randPoisson(g)
  }),
  mean:     (p) => p.r * (1-p.p) / p.p,
  variance: (p) => p.r * (1-p.p) / sq(p.p),
  skewness: (p) => (2-p.p) / Math.sqrt(p.r*(1-p.p)),
  kurtosis: (p) => 6/p.r + sq(p.p)/(p.r*(1-p.p)),
}

const geometric: DistributionDef = {
  id: 'geometric', name: 'Geometric', category: 'discrete',
  isDiscrete: true,
  description: 'Number of trials until first success. The discrete memoryless distribution.',
  pdfFormula: 'P(X=k) = p·(1−p)^{k−1}  for k = 1, 2, …',
  params: [
    { key: 'p', label: 'p (success)', min: 0.05, max: 0.95, step: 0.05, default: 0.3 },
  ],
  support:    () => [1, Infinity],
  plotDomain: (p) => [0.5, Math.max(10, Math.ceil(-Math.log(0.005)/Math.log(1-p.p))) + 0.5],
  pdf: (x, p) => {
    const k = Math.round(x); if (k < 1) return 0
    return p.p * Math.pow(1-p.p, k-1)
  },
  cdf:      (x, p) => x < 1 ? 0 : 1 - Math.pow(1-p.p, Math.floor(x)),
  quantile: (u, p) => Math.ceil(Math.log(1-u) / Math.log(1-p.p)),
  sample:   (n, p) => fill(n, () => Math.ceil(Math.log(Math.random()) / Math.log(1-p.p))),
  mean:     (p) => 1 / p.p,
  variance: (p) => (1-p.p) / sq(p.p),
  skewness: (p) => (2-p.p) / Math.sqrt(1-p.p),
  kurtosis: (p) => 6 + sq(p.p)/(1-p.p),
  entropy:  (p) => -(1-p.p)*Math.log(1-p.p)/p.p - Math.log(p.p),
}

// ═══════════════════════════════════════════════════════════════════════════
// COPULAS  (2D — defined on [0,1]²)
// ═══════════════════════════════════════════════════════════════════════════

const gaussianCopula: DistributionDef = {
  id: 'gaussian-copula', name: 'Gaussian Copula', category: 'copula',
  is2D: true,
  description: 'Captures linear/elliptic dependence via the bivariate Gaussian. Marginals are Uniform(0,1).',
  pdfFormula: 'c(u,v) = φ₂(Φ⁻¹(u),Φ⁻¹(v);ρ) / (φ(Φ⁻¹(u))·φ(Φ⁻¹(v)))',
  params: [
    { key: 'rho', label: 'ρ (corr)', min: -0.95, max: 0.95, step: 0.05, default: 0.7 },
  ],
  support:    () => [0, 1],
  plotDomain: () => [0, 1],
  // 1D marginal: Uniform(0,1)
  pdf:      (x) => (x >= 0 && x <= 1) ? 1 : 0,
  cdf:      (x) => Math.max(0, Math.min(1, x)),
  quantile: (u) => u,
  sample:   (n, p) => fill(n, () => normalCDF(randNormal())),
  density2d: (u, v, p) => {
    if (u <= 0 || u >= 1 || v <= 0 || v >= 1) return 0
    const z1 = normalQuantile(u), z2 = normalQuantile(v), r = p.rho
    const r2 = sq(r)
    return Math.exp(-(r2*(sq(z1)+sq(z2)) - 2*r*z1*z2) / (2*(1-r2))) / Math.sqrt(1-r2)
  },
  sample2d: (n, p) => {
    const r = p.rho
    return Array.from({length: n}, () => {
      const z1 = randNormal(), z2 = randNormal()
      return [normalCDF(z1), normalCDF(r*z1 + Math.sqrt(1-sq(r))*z2)] as [number,number]
    })
  },
  plotDomain2d: () => ({ x: [0.01, 0.99], y: [0.01, 0.99] }),
  mean:     () => 0.5,
  variance: () => 1/12,
  skewness: () => 0,
  kurtosis: () => -1.2,
}

const claytonCopula: DistributionDef = {
  id: 'clayton-copula', name: 'Clayton Copula', category: 'copula',
  is2D: true,
  description: 'Archimedean copula with strong lower-tail dependence. Used in credit risk modelling.',
  pdfFormula: 'c(u,v) = (1+θ)(uv)^{−θ−1}(u^{−θ}+v^{−θ}−1)^{−2−1/θ}',
  params: [
    { key: 'theta', label: 'θ (dep)', min: 0.1, max: 6, step: 0.1, default: 2 },
  ],
  support:    () => [0, 1],
  plotDomain: () => [0, 1],
  pdf:      (x) => (x >= 0 && x <= 1) ? 1 : 0,
  cdf:      (x) => Math.max(0, Math.min(1, x)),
  quantile: (u) => u,
  sample:   (n, p) => fill(n, () => normalCDF(randNormal())),
  density2d: (u, v, p) => {
    if (u <= 0 || u >= 1 || v <= 0 || v >= 1) return 0
    const t = p.theta
    const S = Math.pow(u, -t) + Math.pow(v, -t) - 1
    if (S <= 0) return 0
    return (1+t) * Math.pow(u*v, -t-1) * Math.pow(S, -2-1/t)
  },
  sample2d: (n, p) => {
    const t = p.theta
    return Array.from({length: n}, () => {
      const u = Math.random(), r = Math.random()
      // Conditional inversion: V = ((r^(−t/(t+1))−1)·u^(−t)+1)^(−1/t)
      const factor = Math.pow(r, -t/(t+1))
      const vt = (factor - 1) * Math.pow(u, -t) + 1
      return [u, Math.pow(Math.max(vt, 1e-10), -1/t)] as [number,number]
    })
  },
  plotDomain2d: () => ({ x: [0.01, 0.99], y: [0.01, 0.99] }),
  mean:     () => 0.5,
  variance: () => 1/12,
  skewness: () => 0,
  kurtosis: () => -1.2,
}

// ═══════════════════════════════════════════════════════════════════════════
// REGISTRY & CATEGORIES
// ═══════════════════════════════════════════════════════════════════════════

export const DISTRIBUTIONS: Record<string, DistributionDef> = {
  [normal.id]:           normal,
  [uniform.id]:          uniform,
  [exponential.id]:      exponential,
  [gamma_.id]:           gamma_,
  [beta_.id]:            beta_,
  [chiSquared.id]:       chiSquared,
  [cauchy.id]:           cauchy,
  [studentT.id]:         studentT,
  [pareto.id]:           pareto,
  [levy.id]:             levy,
  [logNormal.id]:        logNormal,
  [gev.id]:              gev,
  [gpd.id]:              gpd,
  [weibull.id]:          weibull,
  [laplace.id]:          laplace,
  [skewNormal.id]:       skewNormal,
  [betaPrime.id]:        betaPrime,
  [inverseGaussian.id]:  inverseGaussian,
  [kumaraswamy.id]:      kumaraswamy,
  [truncatedNormal.id]:  truncatedNormal,
  [gompertz.id]:         gompertz,
  [halfNormal.id]:       halfNormal,
  [logUniform.id]:       logUniform,
  [burr.id]:             burr,
  [lomax.id]:            lomax,
  [dagum.id]:            dagum,
  [bivariateNormal.id]:  bivariateNormal,
  [binomial.id]:         binomial,
  [poisson.id]:          poisson,
  [negBinomial.id]:      negBinomial,
  [geometric.id]:        geometric,
  [gaussianCopula.id]:   gaussianCopula,
  [claytonCopula.id]:    claytonCopula,
}

export type { DistributionDef }
export { bivariateNormal }

export const DIST_CATEGORIES: Record<string, string[]> = {
  'classical':     ['normal','uniform','exponential','gamma','beta','chi-squared'],
  'heavy-tail':    ['cauchy','student-t','pareto','levy','log-normal'],
  'extreme-value': ['gev','gpd'],
  'advanced':      ['weibull','laplace','skew-normal','beta-prime',
                    'inverse-gaussian','kumaraswamy','truncated-normal',
                    'gompertz','half-normal','log-uniform','burr','lomax','dagum'],
  'multivariate':  ['bivariate-normal'],
  'discrete':      ['binomial','poisson','neg-binomial','geometric'],
  'copula':        ['gaussian-copula','clayton-copula'],
}
