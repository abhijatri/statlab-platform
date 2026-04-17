'use client'

import { useState, useMemo, useCallback } from 'react'
import { randNormal, normalCDF, sampleStats, niceTicks, fmtTick } from './distributions/math'

// ═══════════════════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════════════════

type Params = Record<string, number>

interface ParamSpec {
  key: string; label: string; min: number; max: number; step: number; default: number
}

interface SDEDef {
  id: string
  name: string
  equation: string       // display
  itoFormula?: string    // exact solution if known
  description: string
  params: ParamSpec[]
  x0Spec: { label: string; min: number; max: number; step: number; default: number }
  drift:     (x: number, t: number, p: Params) => number
  diffusion: (x: number, t: number, p: Params) => number
  /** Given the same BM increments, compute the exact path (where closed form exists). */
  exact?: (x0: number, times: number[], cumW: number[], p: Params) => number[]
  /** Theoretical mean at each time step (for overlay). */
  meanAt?:  (x0: number, t: number, p: Params) => number
  /** Theoretical ±1σ band. */
  stdAt?:   (t: number, p: Params) => number
  /** Warn if parameters are outside valid range. */
  validate?: (p: Params) => string | null
}

// ═══════════════════════════════════════════════════════════════════════════
// SDE definitions
// ═══════════════════════════════════════════════════════════════════════════

const SDES: SDEDef[] = [
  {
    id: 'gbm',
    name: 'Geometric Brownian Motion',
    equation: 'dS = μS dt + σS dW',
    itoFormula: 'S_t = S₀ exp((μ − σ²/2)t + σW_t)',
    description: 'The Black-Scholes model for asset prices. Itô\'s formula shifts the drift from μ to μ−σ²/2 in the exponent — the Itô correction.',
    params: [
      { key: 'mu',    label: 'μ (drift)',   min: -0.5, max: 2,   step: 0.05, default: 0.1  },
      { key: 'sigma', label: 'σ (vol)',     min: 0.05,  max: 1,   step: 0.05, default: 0.3  },
    ],
    x0Spec: { label: 'S₀', min: 0.1, max: 10, step: 0.1, default: 1 },
    drift:     (x, _t, p) => p.mu * x,
    diffusion: (x, _t, p) => p.sigma * x,
    exact: (x0, times, cumW, p) =>
      times.map((t, i) => x0 * Math.exp((p.mu - 0.5 * p.sigma ** 2) * t + p.sigma * cumW[i])),
    meanAt: (x0, t, p)  => x0 * Math.exp(p.mu * t),
    stdAt:  (t, p) => {
      // Not a simple std since S_t is log-normal, but pointwise std of S_t:
      // Var[S_t] = S₀² e^{2μt}(e^{σ²t} - 1)
      return NaN  // skip for GBM — mean line is more informative
    },
  },
  {
    id: 'ou',
    name: 'Ornstein-Uhlenbeck',
    equation: 'dX = θ(μ − X) dt + σ dW',
    itoFormula: 'X_t | X₀ ~ N(m_t, v_t)',
    description: 'Mean-reverting process. The stationary distribution is N(μ, σ²/2θ). Used for interest rates (Vasicek model) and velocity in physics.',
    params: [
      { key: 'theta', label: 'θ (speed)', min: 0.1, max: 5,  step: 0.1,  default: 1  },
      { key: 'mu',    label: 'μ (level)', min: -3,  max: 3,  step: 0.1,  default: 0  },
      { key: 'sigma', label: 'σ (vol)',   min: 0.05, max: 2,  step: 0.05, default: 0.5 },
    ],
    x0Spec: { label: 'X₀', min: -5, max: 5, step: 0.1, default: 2 },
    drift:     (x, _t, p) => p.theta * (p.mu - x),
    diffusion: (_x, _t, p) => p.sigma,
    // Exact: X_t | X_0 ~ N(m_t, v_t) — can simulate exactly step by step
    meanAt: (x0, t, p) => p.mu + (x0 - p.mu) * Math.exp(-p.theta * t),
    stdAt:  (t, p) => Math.sqrt(p.sigma ** 2 / (2 * p.theta) * (1 - Math.exp(-2 * p.theta * t))),
  },
  {
    id: 'cir',
    name: 'Cox-Ingersoll-Ross',
    equation: 'dX = κ(θ − X) dt + σ√X dW',
    description: 'Mean-reverting with state-dependent vol. Stays positive if 2κθ ≥ σ² (Feller condition). Used for interest rates and volatility.',
    params: [
      { key: 'kappa', label: 'κ (speed)', min: 0.1, max: 5,  step: 0.1, default: 1   },
      { key: 'theta', label: 'θ (level)', min: 0.1, max: 5,  step: 0.1, default: 1   },
      { key: 'sigma', label: 'σ (vol)',   min: 0.05, max: 2, step: 0.05, default: 0.5 },
    ],
    x0Spec: { label: 'X₀', min: 0.01, max: 5, step: 0.05, default: 1 },
    drift:     (x, _t, p) => p.kappa * (p.theta - x),
    diffusion: (x, _t, p) => p.sigma * Math.sqrt(Math.max(x, 0)),
    meanAt: (x0, t, p)  => p.theta + (x0 - p.theta) * Math.exp(-p.kappa * t),
    validate: (p) =>
      2 * p.kappa * p.theta < p.sigma ** 2
        ? `Feller condition 2κθ ≥ σ² violated (${(2*p.kappa*p.theta).toFixed(2)} < ${(p.sigma**2).toFixed(2)}): X may hit 0`
        : null,
  },
  {
    id: 'bridge',
    name: 'Brownian Bridge',
    equation: 'dX = (b − X)/(T − t) dt + dW',
    description: 'A BM conditioned to hit b at time T. Drift pulls the path toward b as t→T, pinning the endpoint exactly.',
    params: [
      { key: 'b', label: 'b (endpoint)', min: -5, max: 5, step: 0.1, default: 0 },
    ],
    x0Spec: { label: 'X₀', min: -5, max: 5, step: 0.1, default: 0 },
    drift:     (x, t, p) => {
      const remaining = Math.max(p.T - t, 1e-5)
      return (p.b - x) / remaining
    },
    diffusion: (_x, _t, _p) => 1,
    meanAt: (x0, t, p)  => x0 * (1 - t / p.T) + p.b * (t / p.T),
    stdAt:  (t, p) => Math.sqrt(t * (1 - t / p.T)),
  },
]

// ═══════════════════════════════════════════════════════════════════════════
// Euler-Maruyama solver
// ═══════════════════════════════════════════════════════════════════════════

interface SolvedPath {
  em: number[]          // Euler-Maruyama path
  exact: number[] | null  // exact path (same BM, different formula)
  cumW: number[]        // cumulative BM increments W_t
  times: number[]
}

function solveEM(
  sde: SDEDef,
  x0: number,
  T: number,
  steps: number,
  params: Params,
): SolvedPath {
  const dt = T / steps
  const sq = Math.sqrt(dt)
  const em = new Array<number>(steps + 1)
  const cumW = new Array<number>(steps + 1)
  const times = Array.from({ length: steps + 1 }, (_, i) => i * dt)

  em[0] = x0
  cumW[0] = 0

  // Collect BM increments for exact solution
  const dW = new Array<number>(steps)

  for (let k = 0; k < steps; k++) {
    const z = randNormal()
    dW[k] = sq * z
    cumW[k + 1] = cumW[k] + dW[k]
    const mu_k = sde.drift(em[k], times[k], params)
    const si_k = sde.diffusion(em[k], times[k], params)
    em[k + 1] = em[k] + mu_k * dt + si_k * dW[k]
    // CIR: clamp to 0 to prevent negative values under Milstein-less E-M
    if (sde.id === 'cir') em[k + 1] = Math.max(em[k + 1], 0)
  }

  const exact = sde.exact ? sde.exact(x0, times, cumW, params) : null

  return { em, exact, cumW, times }
}

// ═══════════════════════════════════════════════════════════════════════════
// SVG infrastructure (matches BM widget style)
// ═══════════════════════════════════════════════════════════════════════════

const PAD = { top: 26, right: 22, bottom: 42, left: 54 }
const VW = 520, VH = 220

function makeScales(xMin: number, xMax: number, yMin: number, yMax: number) {
  const pw = VW - PAD.left - PAD.right
  const ph = VH - PAD.top  - PAD.bottom
  return {
    pw, ph,
    sx: (x: number) => PAD.left + (x - xMin) / (xMax - xMin) * pw,
    sy: (y: number) => PAD.top  + (1 - (y - yMin) / (yMax - yMin)) * ph,
  }
}

function pathD(ys: number[], times: number[], sx: (x: number) => number, sy: (y: number) => number): string {
  return ys.map((y, i) =>
    `${i === 0 ? 'M' : 'L'}${sx(times[i]).toFixed(1)},${sy(y).toFixed(1)}`
  ).join('')
}

function bandPath(
  upper: [number, number][], lower: [number, number][],
  sx: (x: number) => number, sy: (y: number) => number
): string {
  const up = upper.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join('')
  const dn = [...lower].reverse().map(([x, y]) => `L${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join('')
  return `${up}${dn}Z`
}

// ═══════════════════════════════════════════════════════════════════════════
// Plot component
// ═══════════════════════════════════════════════════════════════════════════

function SDEPlot({
  solved,
  theory,
  T,
  xLabel,
  yLabel,
  clipId,
  showExact,
}: {
  solved: SolvedPath[]
  theory: { mean: number[]; upper: number[]; lower: number[]; times: number[] } | null
  T: number
  xLabel?: string
  yLabel?: string
  clipId: string
  showExact: boolean
}) {
  const { yMin, yMax } = useMemo(() => {
    if (solved.length === 0) return { yMin: -2, yMax: 2 }
    const allY: number[] = []
    for (const s of solved) {
      for (const y of s.em) if (isFinite(y)) allY.push(y)
      if (showExact && s.exact) for (const y of s.exact) if (isFinite(y)) allY.push(y)
    }
    if (theory) {
      for (const y of theory.mean)  if (isFinite(y)) allY.push(y)
      for (const y of theory.upper) if (isFinite(y)) allY.push(y)
      for (const y of theory.lower) if (isFinite(y)) allY.push(y)
    }
    const lo = Math.min(...allY), hi = Math.max(...allY)
    const m = (hi - lo) * 0.08 + 0.1
    return { yMin: lo - m, yMax: hi + m }
  }, [solved, theory, showExact])

  const { pw, ph, sx, sy } = makeScales(0, T, yMin, yMax)
  const xTicks = niceTicks(0, T, 5)
  const yTicks = niceTicks(yMin, yMax, 5)

  const bandD = useMemo(() => {
    if (!theory) return null
    const upper: [number, number][] = theory.times.map((t, i) => [t, theory.upper[i]])
    const lower: [number, number][] = theory.times.map((t, i) => [t, theory.lower[i]])
    return bandPath(
      upper.filter(([, y]) => isFinite(y)),
      lower.filter(([, y]) => isFinite(y)),
      sx, sy
    )
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theory, sx, sy])

  const meanD = useMemo(() => {
    if (!theory) return null
    return theory.times.map((t, i) => {
      const y = theory.mean[i]
      return isFinite(y) ? `${i === 0 ? 'M' : 'L'}${sx(t).toFixed(1)},${sy(y).toFixed(1)}` : ''
    }).join('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theory, sx, sy])

  return (
    <svg width="100%" viewBox={`0 0 ${VW} ${VH}`}
      style={{ overflow: 'visible', display: 'block' }}
      aria-label="SDE solved paths">
      <defs>
        <clipPath id={clipId}>
          <rect x={PAD.left} y={PAD.top} width={pw} height={ph} />
        </clipPath>
      </defs>

      {/* Background + grid */}
      <rect x={PAD.left} y={PAD.top} width={pw} height={ph}
        fill="var(--color-elevated)" rx="2" />
      {yTicks.map(y => (
        <line key={y} x1={PAD.left} y1={sy(y)} x2={PAD.left + pw} y2={sy(y)}
          stroke="var(--color-border)" strokeWidth="0.5" />
      ))}

      <g clipPath={`url(#${clipId})`}>
        {/* ±1σ band */}
        {bandD && (
          <path d={bandD} fill="var(--color-accent)" fillOpacity="0.08" stroke="none" />
        )}
        {/* E-M paths */}
        {solved.map((s, i) => (
          <path key={`em-${i}`}
            d={pathD(s.em, s.times, sx, sy)}
            fill="none" stroke="#4E79A7" strokeWidth="1" strokeOpacity="0.4"
            strokeLinejoin="round" />
        ))}
        {/* Exact paths (same BM, different formula) */}
        {showExact && solved.map((s, i) => s.exact && (
          <path key={`ex-${i}`}
            d={pathD(s.exact, s.times, sx, sy)}
            fill="none" stroke="#E15759" strokeWidth="1" strokeOpacity="0.5"
            strokeLinejoin="round" />
        ))}
        {/* Theoretical mean */}
        {meanD && (
          <path d={meanD} fill="none" stroke="var(--color-accent)"
            strokeWidth="2" strokeLinejoin="round" />
        )}
      </g>

      {/* Axes */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + ph}
        stroke="var(--color-border-strong)" strokeWidth="1" />
      <line x1={PAD.left} y1={PAD.top + ph} x2={PAD.left + pw} y2={PAD.top + ph}
        stroke="var(--color-border-strong)" strokeWidth="1" />
      {xTicks.map(x => (
        <g key={x}>
          <line x1={sx(x)} y1={PAD.top + ph} x2={sx(x)} y2={PAD.top + ph + 4}
            stroke="var(--color-border-strong)" strokeWidth="1" />
          <text x={sx(x)} y={PAD.top + ph + 14} textAnchor="middle" fontSize="9"
            fill="var(--color-muted)" fontFamily="var(--font-mono, monospace)">
            {fmtTick(x)}
          </text>
        </g>
      ))}
      {yTicks.map(y => (
        <g key={y}>
          <line x1={PAD.left - 4} y1={sy(y)} x2={PAD.left} y2={sy(y)}
            stroke="var(--color-border-strong)" strokeWidth="1" />
          <text x={PAD.left - 6} y={sy(y) + 3.5} textAnchor="end" fontSize="9"
            fill="var(--color-muted)" fontFamily="var(--font-mono, monospace)">
            {fmtTick(y)}
          </text>
        </g>
      ))}
      {xLabel && (
        <text x={PAD.left + pw / 2} y={VH - 3} textAnchor="middle" fontSize="9.5"
          fill="var(--color-text-secondary)" fontFamily="var(--font-inter, sans-serif)">
          {xLabel}
        </text>
      )}
      {yLabel && (
        <text transform={`translate(12, ${PAD.top + ph / 2}) rotate(-90)`}
          textAnchor="middle" fontSize="9.5"
          fill="var(--color-text-secondary)" fontFamily="var(--font-inter, sans-serif)">
          {yLabel}
        </text>
      )}

      {/* Legend */}
      <g transform={`translate(${PAD.left + 8}, ${PAD.top + 8})`}>
        <line x1={0} y1={4} x2={10} y2={4} stroke="#4E79A7" strokeWidth="1.5" />
        <text x={14} y={8} fontSize="8" fill="var(--color-text-secondary)"
          fontFamily="var(--font-inter, sans-serif)">E-M</text>
      </g>
      {showExact && solved[0]?.exact && (
        <g transform={`translate(${PAD.left + 44}, ${PAD.top + 8})`}>
          <line x1={0} y1={4} x2={10} y2={4} stroke="#E15759" strokeWidth="1.5" />
          <text x={14} y={8} fontSize="8" fill="var(--color-text-secondary)"
            fontFamily="var(--font-inter, sans-serif)">exact</text>
        </g>
      )}
      {meanD && (
        <g transform={`translate(${PAD.left + (showExact ? 88 : 44)}, ${PAD.top + 8})`}>
          <line x1={0} y1={4} x2={10} y2={4} stroke="var(--color-accent)" strokeWidth="2" />
          <text x={14} y={8} fontSize="8" fill="var(--color-text-secondary)"
            fontFamily="var(--font-inter, sans-serif)">E[X_t]</text>
        </g>
      )}
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Slider helper
// ═══════════════════════════════════════════════════════════════════════════

function Slider({
  label, value, min, max, step, onChange,
}: {
  label: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] text-text-muted w-24 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1 accent-accent" />
      <span className="text-[11px] font-mono text-text-secondary w-12 text-right shrink-0">
        {value.toFixed(Math.abs(step) < 0.1 ? 2 : (Math.abs(step) < 1 ? 1 : 0))}
      </span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

const STEP_OPTIONS: [number, string][] = [[50,'50'], [100,'100'], [250,'250'], [500,'500']]
const T_OPTIONS:    [number, string][] = [[0.5,'0.5'], [1,'1'], [2,'2'], [5,'5']]
const K_OPTIONS:    [number, string][] = [[1,'1'], [3,'3'], [10,'10'], [20,'20']]

export function SDESolver() {
  const [sdeId, setSdeId]   = useState('gbm')
  const [steps, setSteps]   = useState(250)
  const [T,     setT]       = useState(1)
  const [K,     setK]       = useState(5)
  const [params, setParams] = useState<Params>({})
  const [x0,    setX0]      = useState<number | null>(null)
  const [solved, setSolved] = useState<SolvedPath[]>([])
  const [showExact, setShowExact] = useState(true)

  const sde = SDES.find(s => s.id === sdeId)!

  // Merge defaults with current params when switching SDEs
  const effectiveParams = useMemo(() => {
    const defaults: Params = {}
    for (const sp of sde.params) defaults[sp.key] = sp.default
    if (sde.id === 'bridge') defaults['T'] = T
    return { ...defaults, ...params }
  }, [sde, params, T])

  const effectiveX0 = x0 ?? sde.x0Spec.default
  const warning = sde.validate?.(effectiveParams) ?? null

  const handleSdeChange = (id: string) => {
    setSdeId(id)
    setParams({})
    setX0(null)
    setSolved([])
  }

  const updateParam = (key: string, v: number) => {
    setParams(prev => ({ ...prev, [key]: v }))
    setSolved([])
  }

  const solve = useCallback(() => {
    const p = { ...effectiveParams }
    if (sde.id === 'bridge') p['T'] = T
    const newSolved = Array.from({ length: K }, () =>
      solveEM(sde, effectiveX0, T, steps, p)
    )
    setSolved(prev => [...prev, ...newSolved].slice(-50))
  }, [sde, effectiveX0, T, steps, K, effectiveParams])

  const reset = () => setSolved([])

  // Theoretical overlay
  const theory = useMemo(() => {
    if (!sde.meanAt) return null
    const p = { ...effectiveParams }
    if (sde.id === 'bridge') p['T'] = T
    const times  = Array.from({ length: steps + 1 }, (_, i) => i * T / steps)
    const mean   = times.map(t => sde.meanAt!(effectiveX0, t, p))
    const upper  = sde.stdAt
      ? times.map(t => { const m = sde.meanAt!(effectiveX0, t, p); const s = sde.stdAt!(t, p); return isFinite(s) ? m + s : NaN })
      : mean.map(() => NaN)
    const lower  = sde.stdAt
      ? times.map(t => { const m = sde.meanAt!(effectiveX0, t, p); const s = sde.stdAt!(t, p); return isFinite(s) ? m - s : NaN })
      : mean.map(() => NaN)
    return { mean, upper, lower, times }
  }, [sde, effectiveX0, effectiveParams, steps, T])

  // Stats on final values
  const finalStats = useMemo(() => {
    if (solved.length === 0) return null
    const finals = solved.map(s => s.em[s.em.length - 1]).filter(isFinite)
    return sampleStats(finals)
  }, [solved])

  const theoreticalMeanT = sde.meanAt ? sde.meanAt(effectiveX0, T, effectiveParams) : null

  return (
    <div className="flex flex-col sm:flex-row h-full min-h-0">

      {/* ── Controls ── */}
      <div className="flex flex-col gap-4 p-4 sm:w-64 shrink-0 border-b sm:border-b-0 sm:border-r border-border bg-elevated overflow-y-auto">

        {/* SDE selector */}
        <div>
          <p className="label-xs mb-2">Model</p>
          <div className="space-y-1">
            {SDES.map(s => (
              <button key={s.id} onClick={() => handleSdeChange(s.id)}
                className={`w-full text-left px-2.5 py-2 rounded border transition-colors ${
                  sdeId === s.id
                    ? 'bg-surface border-border text-text-primary'
                    : 'border-transparent text-text-secondary hover:bg-surface text-xs'
                }`}>
                <div className="text-xs font-medium">{s.name}</div>
                <div className="text-[10px] text-text-muted font-mono">{s.equation}</div>
              </button>
            ))}
          </div>
        </div>

        {/* X0 */}
        <Slider
          label={sde.x0Spec.label}
          value={effectiveX0}
          min={sde.x0Spec.min} max={sde.x0Spec.max} step={sde.x0Spec.step}
          onChange={v => { setX0(v); setSolved([]) }}
        />

        {/* SDE params */}
        <div className="space-y-2">
          {sde.params.map(sp => (
            <Slider key={sp.key}
              label={sp.label}
              value={effectiveParams[sp.key] ?? sp.default}
              min={sp.min} max={sp.max} step={sp.step}
              onChange={v => updateParam(sp.key, v)}
            />
          ))}
        </div>

        {/* Simulation params */}
        <div>
          <p className="label-xs mb-1.5">Time T</p>
          <div className="flex gap-1">
            {T_OPTIONS.map(([v, l]) => (
              <button key={l} onClick={() => { setT(v); setSolved([]) }}
                className={`flex-1 text-[11px] font-mono py-1 rounded border transition-colors ${
                  T === v ? 'bg-surface border-border' : 'border-transparent text-text-muted hover:border-border'
                }`}>{l}</button>
            ))}
          </div>
        </div>

        <div>
          <p className="label-xs mb-1.5">Steps N</p>
          <div className="flex gap-1">
            {STEP_OPTIONS.map(([v, l]) => (
              <button key={l} onClick={() => { setSteps(v); setSolved([]) }}
                className={`flex-1 text-[11px] font-mono py-1 rounded border transition-colors ${
                  steps === v ? 'bg-surface border-border' : 'border-transparent text-text-muted hover:border-border'
                }`}>{l}</button>
            ))}
          </div>
        </div>

        <div>
          <p className="label-xs mb-1.5">Paths K</p>
          <div className="flex gap-1">
            {K_OPTIONS.map(([v, l]) => (
              <button key={l} onClick={() => setK(v)}
                className={`flex-1 text-[11px] font-mono py-1 rounded border transition-colors ${
                  K === v ? 'bg-surface border-border' : 'border-transparent text-text-muted hover:border-border'
                }`}>{l}</button>
            ))}
          </div>
        </div>

        {sde.id === 'gbm' && (
          <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
            <input type="checkbox" checked={showExact}
              onChange={e => setShowExact(e.target.checked)}
              className="accent-accent" />
            Show exact (same BM)
          </label>
        )}

        <div className="space-y-2">
          <button onClick={solve}
            className="w-full text-xs font-medium bg-accent text-white py-2 rounded hover:opacity-90 transition-opacity">
            + Solve {K} path{K > 1 ? 's' : ''}
          </button>
          <button onClick={reset}
            className="w-full text-xs border border-border text-text-muted py-1.5 rounded hover:bg-surface transition-colors">
            Reset ({solved.length} stored)
          </button>
        </div>

        {warning && (
          <p className="text-[10px] text-amber-600 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded px-2 py-1.5 leading-relaxed">
            ⚠ {warning}
          </p>
        )}

        {finalStats && (
          <div className="rounded border border-border bg-surface px-3 py-2.5 text-xs space-y-1">
            <p className="label-xs mb-1.5">X_T  ({solved.length} paths)</p>
            {([
              ['mean',  finalStats.mean.toPrecision(4),
               theoreticalMeanT != null && isFinite(theoreticalMeanT)
                 ? `th: ${theoreticalMeanT.toPrecision(4)}` : ''],
              ['std',   finalStats.std.toPrecision(4),   ''],
            ] as [string, string, string][]).map(([k, v, note]) => (
              <div key={k} className="flex justify-between gap-1">
                <span className="text-text-muted font-mono">{k}</span>
                <span className="font-mono">{v}</span>
                {note && <span className="text-text-muted text-[10px]">{note}</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Plot panel ── */}
      <div className="flex-1 flex flex-col p-4 bg-surface min-h-0 overflow-y-auto gap-3">
        <SDEPlot
          solved={solved}
          theory={theory}
          T={T}
          xLabel="t"
          yLabel={sde.id === 'gbm' ? 'S_t' : 'X_t'}
          clipId={`sde-${sde.id}-clip`}
          showExact={showExact}
        />

        {/* Equation box */}
        <div className="rounded border border-border bg-elevated px-3 py-2.5 text-xs space-y-1">
          <div className="font-mono text-text-secondary">{sde.equation}</div>
          {sde.itoFormula && (
            <div className="text-[11px] text-text-muted font-mono">
              Exact: {sde.itoFormula}
            </div>
          )}
          <p className="text-[11px] text-text-muted leading-relaxed">{sde.description}</p>
          {sde.id === 'gbm' && showExact && solved.length > 0 && (
            <p className="text-[11px] text-accent leading-relaxed">
              Blue (E-M) vs red (exact, same BM increments) — divergence shows
              the Itô correction: the log-drift is μ−σ²/2, not μ.
            </p>
          )}
        </div>
      </div>

    </div>
  )
}
