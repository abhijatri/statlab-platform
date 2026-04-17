// ── Numerical special functions & samplers ─────────────────────────────────
// All implementations are numerically stable.
// References: Numerical Recipes 3e, Abramowitz & Stegun, DLMF.

// ═══════════════════════════════════════════════════════════════════════════
// SPECIAL FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/** Error function — Abramowitz & Stegun 7.1.26, max error < 1.5×10⁻⁷ */
export function erf(x: number): number {
  if (x < 0) return -erf(-x)
  const t = 1 / (1 + 0.3275911 * x)
  return 1 - t * (0.254829592 + t * (-0.284496736 + t * (1.421413741
    + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x)
}

export function erfc(x: number): number { return 1 - erf(x) }

/** Log-Gamma via Lanczos (g=7, 9 terms) — ~15 significant digits */
const _LG_C = [
  0.99999999999980993,  676.5203681218851,   -1259.1392167224028,
  771.32342877765313,   -176.61502916214059,  12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
]

export function lgamma(x: number): number {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x)
  const z = x - 1
  let s = _LG_C[0]
  for (let i = 1; i < 9; i++) s += _LG_C[i] / (z + i)
  const t = z + 7.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(s)
}

export function lbeta(a: number, b: number): number {
  return lgamma(a) + lgamma(b) - lgamma(a + b)
}

// ── Regularized incomplete gamma P(a, x) ─────────────────────────────────

export function gammaP(a: number, x: number): number {
  if (x < 0 || a <= 0) return 0
  if (x === 0) return 0
  if (x < a + 1) return _gammaSeries(a, x)
  return 1 - _gammaCF(a, x)
}

function _gammaSeries(a: number, x: number): number {
  let ap = a, del = 1 / a, sum = del
  for (let n = 1; n <= 300; n++) {
    ap++; del *= x / ap; sum += del
    if (Math.abs(del) < Math.abs(sum) * 1e-14) break
  }
  return sum * Math.exp(-x + a * Math.log(x) - lgamma(a))
}

function _gammaCF(a: number, x: number): number {
  let b = x + 1 - a, c = 1 / 1e-300, d = 1 / b, h = d
  for (let i = 1; i <= 300; i++) {
    const an = -i * (i - a); b += 2
    d = an * d + b; if (Math.abs(d) < 1e-300) d = 1e-300; d = 1 / d
    c = b + an / c; if (Math.abs(c) < 1e-300) c = 1e-300
    const del = d * c; h *= del
    if (Math.abs(del - 1) < 1e-13) break
  }
  return Math.exp(-x + a * Math.log(x) - lgamma(a)) * h
}

// ── Regularized incomplete beta I_x(a,b) — Lentz continued fraction ──────

export function betainc(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(a * Math.log(x) + b * Math.log(1 - x) - lbeta(a, b))
  if (x < (a + 1) / (a + b + 2)) return bt * _betaCF(x, a, b) / a
  return 1 - bt * _betaCF(1 - x, b, a) / b
}

function _betaCF(x: number, a: number, b: number): number {
  const qab = a + b, qap = a + 1, qam = a - 1
  let c = 1.0, d = 1 - qab * x / qap
  if (Math.abs(d) < 1e-300) d = 1e-300
  d = 1 / d; let h = d
  for (let m = 1; m <= 300; m++) {
    const m2 = 2 * m
    let aa = m * (b - m) * x / ((qam + m2) * (a + m2))
    d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300
    c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300
    d = 1 / d; h *= d * c
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2))
    d = 1 + aa * d; if (Math.abs(d) < 1e-300) d = 1e-300
    c = 1 + aa / c; if (Math.abs(c) < 1e-300) c = 1e-300
    d = 1 / d; const del = d * c; h *= del
    if (Math.abs(del - 1) < 3e-13) break
  }
  return h
}

// ── Standard normal ───────────────────────────────────────────────────────

export function normalPDF(x: number): number {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI)
}

export function normalCDF(x: number): number {
  return 0.5 * (1 + erf(x / Math.SQRT2))
}

/** Inverse normal CDF — Acklam's rational approximation, max error < 3.65×10⁻⁹ */
const _A = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
             1.383577518672690e2, -3.066479806614716e1,  2.506628277459239]
const _B = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
             6.680131188771972e1, -1.328068155288572e1]
const _C = [-7.784894002430293e-3,-3.223964580411365e-1,-2.400758277161838,
            -2.549732539343734,   4.374664141464968,    2.938163982698783]
const _D = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416]

export function normalQuantile(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return +Infinity
  if (p < 0.02425) {
    const q = Math.sqrt(-2 * Math.log(p))
    return ((((((_C[0]*q+_C[1])*q+_C[2])*q+_C[3])*q+_C[4])*q+_C[5])) /
           (((((_D[0]*q+_D[1])*q+_D[2])*q+_D[3])*q+1))
  }
  if (p > 0.97575) return -normalQuantile(1 - p)
  const q = p - 0.5, r = q * q
  return ((((((_A[0]*r+_A[1])*r+_A[2])*r+_A[3])*r+_A[4])*r+_A[5])*q) /
         ((((((_B[0]*r+_B[1])*r+_B[2])*r+_B[3])*r+_B[4])*r+1))
}

/** Owen's T function — numerical integration (50-point midpoint rule) */
export function owensT(h: number, a: number): number {
  const sign = a < 0 ? -1 : 1
  const aa = Math.abs(a)
  let sum = 0
  const N = 50
  for (let i = 0; i < N; i++) {
    const t = aa * (i + 0.5) / N
    sum += Math.exp(-0.5 * h * h * (1 + t * t)) / (1 + t * t)
  }
  return sign * sum * aa / (2 * Math.PI * N)
}

// ═══════════════════════════════════════════════════════════════════════════
// SAMPLERS
// ═══════════════════════════════════════════════════════════════════════════

let _normalSpare: number | null = null

/** Standard normal via Box-Muller */
export function randNormal(): number {
  if (_normalSpare !== null) { const v = _normalSpare; _normalSpare = null; return v }
  const u = Math.random(), v = Math.random()
  const r = Math.sqrt(-2 * Math.log(u + 1e-300))
  _normalSpare = r * Math.cos(2 * Math.PI * v)
  return r * Math.sin(2 * Math.PI * v)
}

/**
 * Gamma(shape=a, scale=b) via Marsaglia-Tsang.
 * Handles a < 1 via squeeze: Γ(a+1) * U^{1/a}.
 */
export function randGamma(a: number, b: number = 1): number {
  if (a < 1) return randGamma(a + 1, b) * Math.pow(Math.random(), 1 / a)
  const d = a - 1 / 3, c = 1 / Math.sqrt(9 * d)
  for (;;) {
    let x: number, v: number
    do { x = randNormal(); v = 1 + c * x } while (v <= 0)
    v = v * v * v
    const u = Math.random()
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v * b
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v * b
  }
}

export function randBeta(a: number, b: number): number {
  const x = randGamma(a), y = randGamma(b)
  return x / (x + y)
}

// ═══════════════════════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════════════════════

export function linspace(lo: number, hi: number, n: number): number[] {
  const a = new Array<number>(n)
  const d = (hi - lo) / (n - 1)
  for (let i = 0; i < n; i++) a[i] = lo + i * d
  return a
}

export interface HistBin { lo: number; hi: number; density: number }

/** Histogram with robust range (1st–99th percentile). */
export function histogram(data: number[], nBins: number = 40): HistBin[] {
  if (data.length === 0) return []
  const sorted = [...data].sort((a, b) => a - b)
  const n = sorted.length
  const lo = sorted[Math.max(0, Math.floor(0.005 * n))]
  const hi = sorted[Math.min(n - 1, Math.ceil(0.995 * n))]
  if (!isFinite(lo) || !isFinite(hi) || lo >= hi) return []
  const step = (hi - lo) / nBins
  const counts = new Array<number>(nBins).fill(0)
  let inRange = 0
  for (const x of data) {
    if (x < lo || x > hi || !isFinite(x)) continue
    counts[Math.min(Math.floor((x - lo) / step), nBins - 1)]++
    inRange++
  }
  if (inRange === 0) return []
  return counts.map((c, i) => ({
    lo: lo + i * step,
    hi: lo + (i + 1) * step,
    density: c / (inRange * step),
  }))
}

export interface SampleStats {
  mean: number; variance: number; std: number
  skewness: number; kurtosis: number
  min: number; max: number
}

/** Compute sample statistics in one pass. */
export function sampleStats(data: number[]): SampleStats {
  const finite = data.filter(isFinite)
  const n = finite.length
  if (n === 0) return { mean: NaN, variance: NaN, std: NaN, skewness: NaN, kurtosis: NaN, min: NaN, max: NaN }
  let sum = 0, min = finite[0], max = finite[0]
  for (const x of finite) { sum += x; if (x < min) min = x; if (x > max) max = x }
  const mean = sum / n
  let m2 = 0, m3 = 0, m4 = 0
  for (const x of finite) {
    const d = x - mean; m2 += d * d; m3 += d * d * d; m4 += d * d * d * d
  }
  m2 /= n; m3 /= n; m4 /= n
  const std = Math.sqrt(m2)
  const skewness = std > 0 ? m3 / (std * std * std) : 0
  const kurtosis = std > 0 ? m4 / (m2 * m2) - 3 : 0
  return { mean, variance: m2, std, skewness, kurtosis, min, max }
}

/** Bisection quantile — for distributions without closed-form inverse CDF */
export function bisectQuantile(
  cdf: (x: number) => number,
  lo: number, hi: number,
  p: number,
  maxIter: number = 64
): number {
  if (p <= 0) return lo
  if (p >= 1) return hi
  // Expand bracket if needed
  let loV = cdf(lo), hiV = cdf(hi)
  while (loV > p && lo > -1e15) { lo *= 2 - 1e-10; loV = cdf(lo) }
  while (hiV < p && hi < 1e15) { hi *= 2 + 1e-10; hiV = cdf(hi) }
  for (let i = 0; i < maxIter; i++) {
    const m = (lo + hi) / 2
    if (cdf(m) < p) lo = m; else hi = m
    if (hi - lo < 1e-9 * (1 + Math.abs(lo))) break
  }
  return (lo + hi) / 2
}

/** Nice tick values for an axis. */
export function niceTicks(lo: number, hi: number, maxN: number = 5): number[] {
  if (lo >= hi) return [lo]
  const range = hi - lo
  const rawStep = range / maxN
  const mag = Math.pow(10, Math.floor(Math.log10(rawStep)))
  const step = [1, 2, 2.5, 5, 10].map(m => m * mag).find(s => range / s <= maxN) ?? mag * 10
  const start = Math.ceil(lo / step - 1e-9) * step
  const out: number[] = []
  for (let v = start; v <= hi + 1e-9; v += step) {
    const r = parseFloat(v.toPrecision(12))
    if (r >= lo - 1e-9 && r <= hi + 1e-9) out.push(r)
  }
  return out
}

export function fmtTick(x: number): string {
  if (x === 0) return '0'
  const a = Math.abs(x)
  if (a >= 1e4 || a < 1e-3) return x.toExponential(1)
  if (a >= 100) return x.toFixed(0)
  if (a >= 10)  return x.toFixed(1)
  if (a >= 1)   return x.toFixed(2)
  return x.toPrecision(2)
}

// ═══════════════════════════════════════════════════════════════════════════
// ADDITIONAL SPECIAL FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Digamma function ψ(x) = d/dx ln Γ(x).
 * Uses recurrence ψ(x) = ψ(x+1) − 1/x to shift x≥6,
 * then asymptotic expansion (accurate to ~10⁻¹²).
 */
export function digamma(x: number): number {
  if (x < 0.5) return digamma(1 - x) - Math.PI / Math.tan(Math.PI * x)
  if (x < 6)   return digamma(x + 1) - 1 / x
  // Asymptotic: ln(x) - 1/(2x) - B₂/(2x²) + B₄/(4x⁴) - B₆/(6x⁶) + ...
  const x2 = x * x
  return Math.log(x) - 1/(2*x) - 1/(12*x2) + 1/(120*x2*x2) - 1/(252*x2*x2*x2)
}

/** Log of binomial coefficient ln C(n,k) via log-gamma. */
export function logBinom(n: number, k: number): number {
  return lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1)
}

/**
 * Poisson sampler.
 * Knuth direct method for λ ≤ 30; normal approximation otherwise.
 */
export function randPoisson(lambda: number): number {
  if (lambda <= 0) return 0
  if (lambda <= 30) {
    const L = Math.exp(-lambda)
    let k = 0, p = 1
    do { k++; p *= Math.random() } while (p > L)
    return k - 1
  }
  return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * randNormal()))
}

/**
 * Binomial sampler B(n, p).
 * Direct sum of Bernoullis when n·min(p,1−p) < 25; normal approximation otherwise.
 */
export function randBinomial(n: number, p: number): number {
  if (p <= 0) return 0
  if (p >= 1) return n
  if (n * Math.min(p, 1 - p) < 25) {
    let k = 0
    for (let i = 0; i < n; i++) if (Math.random() < p) k++
    return k
  }
  const mu = n * p, sd = Math.sqrt(n * p * (1 - p))
  return Math.max(0, Math.min(n, Math.round(mu + sd * randNormal())))
}

/** Inverse-Gaussian (Wald) sampler — Michael, Schucany & Haas (1976). */
export function randInvGaussian(mu: number, lambda: number): number {
  const y = randNormal(); const y2 = y * y
  const x = mu + mu * mu * y2 / (2 * lambda) -
    (mu / (2 * lambda)) * Math.sqrt(4 * mu * lambda * y2 + mu * mu * y2 * y2)
  return Math.random() <= mu / (mu + x) ? x : mu * mu / x
}
