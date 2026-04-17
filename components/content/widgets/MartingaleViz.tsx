'use client'

import { useState, useMemo, useCallback } from 'react'
import { randNormal, niceTicks, fmtTick } from './distributions/math'

// ═══════════════════════════════════════════════════════════════════════════
// Martingale examples
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Simple symmetric random walk: X_n = Σ ξ_i, ξ_i = ±1 with prob 1/2.
 * Martingale: E[X_{n+1} | F_n] = X_n.
 * E[X_n] = 0 = E[X_0] for all n.
 */
function genRandomWalk(N: number): number[] {
  const X = new Array<number>(N + 1)
  X[0] = 0
  for (let k = 1; k <= N; k++) {
    X[k] = X[k - 1] + (Math.random() < 0.5 ? 1 : -1)
  }
  return X
}

/**
 * Stopped random walk: stop at first time |X_n| ≥ b.
 * By optional stopping (Wald's identity): E[X_τ] = 0, E[τ] = b².
 * After τ, the path is "frozen" at the boundary.
 */
function genStoppedWalk(N: number, b: number): { path: number[]; tau: number } {
  const path = new Array<number>(N + 1)
  path[0] = 0
  let tau = N  // default: never stopped
  for (let k = 1; k <= N; k++) {
    if (Math.abs(path[k - 1]) >= b) {
      // Stopped — freeze at boundary value
      path.fill(path[k - 1], k, N + 1)
      tau = k - 1
      break
    }
    path[k] = path[k - 1] + (Math.random() < 0.5 ? 1 : -1)
  }
  return { path, tau }
}

/**
 * Exponential martingale: M_t = exp(λ W_t − λ²t/2).
 * This is the Doléans-Dade exponential of λW.
 * E[M_t] = 1 for all t (despite paths looking explosive for large λ).
 * Used in: Girsanov's theorem (changing measure), likelihood ratios.
 */
function genExpMartingale(N: number, T: number, lambda: number): number[] {
  const dt = T / N
  const sq = Math.sqrt(dt)
  const M = new Array<number>(N + 1)
  M[0] = 1
  let W = 0
  for (let k = 1; k <= N; k++) {
    W += sq * randNormal()
    const t = k * dt
    M[k] = Math.exp(lambda * W - 0.5 * lambda * lambda * t)
  }
  return M
}

/**
 * Azuma-Hoeffding example: bounded-difference martingale.
 * X_n = Σ d_i where |d_i| ≤ c_i (controlled increments).
 * Demonstrates: P(X_n ≥ t) ≤ exp(−2t²/Σ c_i²).
 */
function genBoundedMartingale(N: number, c: number): number[] {
  const X = new Array<number>(N + 1)
  X[0] = 0
  for (let k = 1; k <= N; k++) {
    // d_k uniform on [−c, c], mean 0
    const d = (Math.random() * 2 - 1) * c
    X[k] = X[k - 1] + d
  }
  return X
}

// ═══════════════════════════════════════════════════════════════════════════
// SVG infrastructure
// ═══════════════════════════════════════════════════════════════════════════

const PAD = { top: 26, right: 22, bottom: 40, left: 54 }
const VW = 520, VH = 210

function makeScales(xMin: number, xMax: number, yMin: number, yMax: number) {
  const pw = VW - PAD.left - PAD.right
  const ph = VH - PAD.top - PAD.bottom
  return {
    pw, ph,
    sx: (x: number) => PAD.left + (x - xMin) / (xMax - xMin) * pw,
    sy: (y: number) => PAD.top + (1 - (y - yMin) / (yMax - yMin)) * ph,
  }
}

function pathD(
  ys: number[],
  sx: (x: number) => number,
  sy: (y: number) => number,
  step = 1
): string {
  return ys.map((y, i) =>
    `${i === 0 ? 'M' : 'L'}${sx(i * step).toFixed(1)},${sy(y).toFixed(1)}`
  ).join('')
}

// ═══════════════════════════════════════════════════════════════════════════
// Shared multi-path plot
// ═══════════════════════════════════════════════════════════════════════════

interface PathRecord {
  path: number[]
  tau?: number   // optional stopping time
}

interface MartPlotProps {
  records: PathRecord[]
  N: number
  xStep?: number          // x-axis step (1 for discrete, dt for continuous)
  pathColor?: string
  refLines?: number[]     // horizontal reference lines (barriers, E[X])
  refColor?: string
  clipId: string
  xLabel?: string
  yLabel?: string
  highlightBands?: { lo: number; hi: number; color: string }[]
  azumaUpper?: number[] | null  // Azuma bound
}

function MartPlot({
  records, N, xStep = 1, pathColor = '#4E79A7',
  refLines = [], refColor = '#E15759',
  clipId, xLabel, yLabel,
  highlightBands = [],
  azumaUpper = null,
}: MartPlotProps) {
  const { yMin, yMax } = useMemo(() => {
    if (records.length === 0) return { yMin: -3, yMax: 3 }
    let lo = 0, hi = 0
    for (const r of records) for (const y of r.path) {
      if (!isFinite(y)) continue
      if (y < lo) lo = y; if (y > hi) hi = y
    }
    for (const v of refLines) { if (v < lo) lo = v; if (v > hi) hi = v }
    const m = (Math.abs(lo) + Math.abs(hi)) * 0.1 + 0.5
    return { yMin: lo - m, yMax: hi + m }
  }, [records, refLines])

  const { pw, ph, sx, sy } = makeScales(0, N * xStep, yMin, yMax)
  const xTicks = niceTicks(0, N * xStep, 5)
  const yTicks = niceTicks(yMin, yMax, 5)

  // Running mean across all paths at each step
  const meanPath = useMemo(() => {
    if (records.length === 0) return null
    const len = records[0].path.length
    const means = new Array<number>(len)
    for (let k = 0; k < len; k++) {
      const vals = records.map(r => r.path[k]).filter(isFinite)
      means[k] = vals.reduce((a, b) => a + b, 0) / vals.length
    }
    return means
  }, [records])

  const meanD = meanPath ? pathD(meanPath, sx, sy, xStep) : null

  const azumaD = azumaUpper ? pathD(azumaUpper, sx, sy, xStep) : null

  return (
    <svg width="100%" viewBox={`0 0 ${VW} ${VH}`}
      style={{ overflow: 'visible', display: 'block' }}
      aria-label="Martingale sample paths">
      <defs>
        <clipPath id={clipId}>
          <rect x={PAD.left} y={PAD.top} width={pw} height={ph} />
        </clipPath>
      </defs>

      <rect x={PAD.left} y={PAD.top} width={pw} height={ph}
        fill="var(--color-elevated)" rx="2" />

      {yTicks.map(y => (
        <line key={y} x1={PAD.left} y1={sy(y)} x2={PAD.left + pw} y2={sy(y)}
          stroke="var(--color-border)" strokeWidth="0.5" />
      ))}

      <g clipPath={`url(#${clipId})`}>
        {/* Shaded bands (e.g. barriers) */}
        {highlightBands.map((b, i) => {
          const y1 = Math.min(sy(b.hi), sy(b.lo))
          const h  = Math.abs(sy(b.hi) - sy(b.lo))
          return <rect key={i} x={PAD.left} y={y1} width={pw} height={h}
            fill={b.color} fillOpacity="0.08" />
        })}

        {/* Reference lines (barriers, E[X_0]) */}
        {refLines.map(v => (
          <line key={v}
            x1={sx(0)} y1={sy(v)} x2={sx(N * xStep)} y2={sy(v)}
            stroke={refColor} strokeWidth="1.2" strokeDasharray="5 3" opacity="0.6" />
        ))}

        {/* Individual paths */}
        {records.map((r, i) => {
          // If stopped: draw in two segments — active and frozen
          if (r.tau !== undefined && r.tau < N) {
            const activePath = r.path.slice(0, r.tau + 1)
            const frozenY = r.path[r.tau]
            return (
              <g key={i}>
                <path d={pathD(activePath, sx, sy, xStep)}
                  fill="none" stroke={pathColor} strokeWidth="1"
                  strokeOpacity="0.35" strokeLinejoin="round" />
                <line
                  x1={sx(r.tau * xStep)} y1={sy(frozenY)}
                  x2={sx(N * xStep)} y2={sy(frozenY)}
                  stroke={pathColor} strokeWidth="1"
                  strokeOpacity="0.2" strokeDasharray="3 2" />
              </g>
            )
          }
          return (
            <path key={i} d={pathD(r.path, sx, sy, xStep)}
              fill="none" stroke={pathColor} strokeWidth="1"
              strokeOpacity="0.3" strokeLinejoin="round" />
          )
        })}

        {/* Azuma upper bound */}
        {azumaD && (
          <path d={azumaD} fill="none" stroke="#9467BD"
            strokeWidth="1.5" strokeDasharray="4 3" strokeLinejoin="round" />
        )}

        {/* Running mean — the key martingale diagnostic */}
        {meanD && (
          <path d={meanD} fill="none" stroke="#E15759"
            strokeWidth="2.2" strokeLinejoin="round" />
        )}
      </g>

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

      {/* Legend: paths vs mean */}
      {records.length > 0 && (
        <g>
          <line x1={PAD.left + 8} y1={PAD.top + 10} x2={PAD.left + 20} y2={PAD.top + 10}
            stroke={pathColor} strokeWidth="1" strokeOpacity="0.5" />
          <text x={PAD.left + 24} y={PAD.top + 14} fontSize="8"
            fill="var(--color-text-secondary)" fontFamily="var(--font-inter, sans-serif)">
            paths
          </text>
          <line x1={PAD.left + 54} y1={PAD.top + 10} x2={PAD.left + 66} y2={PAD.top + 10}
            stroke="#E15759" strokeWidth="2.2" />
          <text x={PAD.left + 70} y={PAD.top + 14} fontSize="8"
            fill="var(--color-text-secondary)" fontFamily="var(--font-inter, sans-serif)">
            mean
          </text>
        </g>
      )}
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Example 1 — Random Walk
// ═══════════════════════════════════════════════════════════════════════════

function RandomWalkPanel({ N, records }: { N: number; records: PathRecord[] }) {
  const finalMean = useMemo(() => {
    if (records.length === 0) return null
    const finals = records.map(r => r.path[r.path.length - 1])
    return finals.reduce((a, b) => a + b, 0) / finals.length
  }, [records])

  // Doob's L² inequality: P(max |X_k| ≥ λ) ≤ E[X_N²]/λ²
  // E[X_N²] = N for symmetric random walk
  const doobBound = (lambda: number) => N / (lambda * lambda)

  return (
    <div className="space-y-2">
      <MartPlot records={records} N={N}
        refLines={[0]} clipId="rw-clip" xLabel="n" yLabel="X_n" />
      {finalMean !== null && (
        <div className="text-[10px] font-mono text-text-muted px-1 space-y-0.5">
          <p>Mean X_N = {finalMean.toFixed(3)}  (theory: 0)  — {records.length} paths</p>
          <p>Doob L²: P(max|X_k| ≥ 5) ≤ E[X_N²]/25 = {(doobBound(5)).toFixed(2)} &nbsp;(N={N})</p>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Example 2 — Stopped Walk (Optional Stopping Theorem)
// ═══════════════════════════════════════════════════════════════════════════

function StoppedWalkPanel({ N, b, records }: { N: number; b: number; records: PathRecord[] }) {
  const stats = useMemo(() => {
    if (records.length === 0) return null
    const stopped = records.filter(r => r.tau !== undefined && r.tau < N)
    const taus = records.map(r => r.tau ?? N)
    const finals = records.map(r => r.path[r.tau ?? (r.path.length - 1)])
    const meanTau  = taus.reduce((a, c) => a + c, 0) / taus.length
    const meanFinal = finals.reduce((a, c) => a + c, 0) / finals.length
    return { nStopped: stopped.length, meanTau, meanFinal }
  }, [records, N])

  return (
    <div className="space-y-2">
      <MartPlot
        records={records} N={N}
        refLines={[b, -b]}
        refColor="#E15759"
        highlightBands={[{ lo: b, hi: b + 1, color: '#E15759' }, { lo: -b - 1, hi: -b, color: '#E15759' }]}
        clipId="stopped-clip" xLabel="n" yLabel="X_n"
      />
      {stats ? (
        <div className="text-[10px] font-mono text-text-muted px-1 space-y-0.5">
          <p>Stopped: {stats.nStopped}/{records.length} paths hit ±{b} within {N} steps</p>
          <p>E[X_τ] = {stats.meanFinal.toFixed(3)}  (theory: 0 — optional stopping)</p>
          <p>E[τ] = {stats.meanTau.toFixed(1)}  (theory: {b}² = {b * b}  — Wald's identity)</p>
        </div>
      ) : (
        <p className="text-[10px] text-text-muted px-1">Generate paths to verify E[X_τ] = 0.</p>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Example 3 — Exponential Martingale
// ═══════════════════════════════════════════════════════════════════════════

function ExpMartPanel({ N, T, lambda, records }: {
  N: number; T: number; lambda: number; records: PathRecord[]
}) {
  const finalMean = useMemo(() => {
    if (records.length === 0) return null
    const finals = records.map(r => r.path[r.path.length - 1]).filter(isFinite)
    return finals.reduce((a, b) => a + b, 0) / finals.length
  }, [records])

  const dt = T / N
  const xStep = dt

  return (
    <div className="space-y-2">
      <MartPlot records={records} N={N} xStep={xStep}
        refLines={[1]} refColor="var(--color-accent)"
        clipId="expmg-clip" xLabel="t" yLabel="M_t" />
      {finalMean !== null && (
        <div className="text-[10px] font-mono text-text-muted px-1 space-y-0.5">
          <p>Mean M_T = {finalMean.toFixed(4)}  (theory: 1.0)  — {records.length} paths</p>
          <p>λ={lambda.toFixed(2)}: paths look {'explosive'} but E[M_t]=1 exactly (Girsanov)</p>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Example 4 — Azuma-Hoeffding Inequality
// ═══════════════════════════════════════════════════════════════════════════

function AzumaPanel({ N, c, records }: { N: number; c: number; records: PathRecord[] }) {
  // Azuma: P(X_N ≥ t) ≤ exp(−t² / 2Σc_i²) = exp(−t²/2Nc²)
  const azumaUpper = useMemo(() => {
    return Array.from({ length: N + 1 }, (_, k) => {
      // 1-sided 95% bound: t s.t. exp(−t²/2kc²) = 0.05 → t = c√(2k·ln20)
      return k === 0 ? 0 : c * Math.sqrt(2 * k * Math.log(20))
    })
  }, [N, c])

  const finalMean = useMemo(() => {
    if (records.length === 0) return null
    const finals = records.map(r => r.path[r.path.length - 1])
    return finals.reduce((a, b) => a + b, 0) / finals.length
  }, [records])

  const exceeds = useMemo(() => {
    if (records.length === 0) return null
    const bound = azumaUpper[N]
    return records.filter(r => r.path[N] > bound).length
  }, [records, azumaUpper, N])

  return (
    <div className="space-y-2">
      <MartPlot records={records} N={N}
        refLines={[0]}
        azumaUpper={azumaUpper}
        clipId="azuma-clip" xLabel="n" yLabel="X_n"
      />
      {finalMean !== null && (
        <div className="text-[10px] font-mono text-text-muted px-1 space-y-0.5">
          <p>Mean X_N = {finalMean.toFixed(3)}  — {records.length} paths</p>
          <p>Purple = Azuma 95% upper bound: {azumaUpper[N].toFixed(2)}</p>
          {exceeds !== null && (
            <p>Paths exceeding bound: {exceeds}/{records.length} (≤5% by Azuma-Hoeffding)</p>
          )}
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

type ExampleId = 'rw' | 'stopped' | 'exp' | 'azuma'

const EXAMPLES: { id: ExampleId; label: string; description: string }[] = [
  {
    id: 'rw',
    label: 'Random Walk',
    description: 'E[X_{n+1}|F_n] = X_n. Mean stays at 0 regardless of path history.',
  },
  {
    id: 'stopped',
    label: 'Optional Stopping',
    description: 'τ = first hit of ±b. OST: E[X_τ] = E[X_0] = 0. Wald: E[τ] = b².',
  },
  {
    id: 'exp',
    label: 'Exponential (Girsanov)',
    description: 'M_t = exp(λW_t − λ²t/2). E[M_t] = 1. Foundation of measure change.',
  },
  {
    id: 'azuma',
    label: 'Azuma-Hoeffding',
    description: 'Bounded-increment martingale. Concentration inequality on max deviation.',
  },
]

const N_OPTS: [number, string][] = [[50,'50'], [100,'100'], [200,'200'], [500,'500']]
const K_OPTS: [number, string][] = [[5,'5'], [10,'10'], [20,'20'], [50,'50']]

export function MartingaleViz() {
  const [exampleId, setExampleId] = useState<ExampleId>('rw')
  const [N, setN]                 = useState(100)
  const [K, setK]                 = useState(20)
  const [b, setB]                 = useState(5)
  const [lambda, setLambda]       = useState(0.5)
  const [c, setC]                 = useState(0.5)
  const [records, setRecords]     = useState<PathRecord[]>([])
  const T = 1.0  // for exponential martingale

  const handleExampleChange = (id: ExampleId) => {
    setExampleId(id)
    setRecords([])
  }

  const generate = useCallback(() => {
    let newRecords: PathRecord[] = []
    if (exampleId === 'rw') {
      newRecords = Array.from({ length: K }, () => ({ path: genRandomWalk(N) }))
    } else if (exampleId === 'stopped') {
      newRecords = Array.from({ length: K }, () => {
        const { path, tau } = genStoppedWalk(N, b)
        return { path, tau }
      })
    } else if (exampleId === 'exp') {
      newRecords = Array.from({ length: K }, () => ({
        path: genExpMartingale(N, T, lambda)
      }))
    } else if (exampleId === 'azuma') {
      newRecords = Array.from({ length: K }, () => ({ path: genBoundedMartingale(N, c) }))
    }
    setRecords(prev => [...prev, ...newRecords].slice(-200))
  }, [exampleId, N, K, b, lambda, c])

  const reset = () => setRecords([])

  const example = EXAMPLES.find(e => e.id === exampleId)!

  return (
    <div className="flex flex-col sm:flex-row h-full min-h-0">

      {/* ── Controls ── */}
      <div className="flex flex-col gap-4 p-5 sm:w-60 shrink-0 border-b sm:border-b-0 sm:border-r border-border bg-elevated overflow-y-auto">

        <div>
          <p className="label-xs mb-2">Example</p>
          <div className="space-y-1">
            {EXAMPLES.map(ex => (
              <button key={ex.id} onClick={() => handleExampleChange(ex.id)}
                className={`w-full text-left px-2.5 py-2 rounded border transition-colors ${
                  exampleId === ex.id
                    ? 'bg-surface border-border text-text-primary'
                    : 'border-transparent text-text-secondary hover:bg-surface'
                }`}>
                <div className="text-xs font-medium">{ex.label}</div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="label-xs mb-1.5">Steps N</p>
          <div className="flex gap-1">
            {N_OPTS.map(([v, l]) => (
              <button key={l} onClick={() => { setN(v); setRecords([]) }}
                className={`flex-1 text-[11px] font-mono py-1 rounded border transition-colors ${
                  N === v ? 'bg-surface border-border' : 'border-transparent text-text-muted hover:border-border'
                }`}>{l}</button>
            ))}
          </div>
        </div>

        <div>
          <p className="label-xs mb-1.5">Paths K</p>
          <div className="flex gap-1">
            {K_OPTS.map(([v, l]) => (
              <button key={l} onClick={() => setK(v)}
                className={`flex-1 text-[11px] font-mono py-1 rounded border transition-colors ${
                  K === v ? 'bg-surface border-border' : 'border-transparent text-text-muted hover:border-border'
                }`}>{l}</button>
            ))}
          </div>
        </div>

        {exampleId === 'stopped' && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-muted w-24 shrink-0">Barrier b</span>
            <input type="range" min={2} max={20} step={1} value={b}
              onChange={e => { setB(parseInt(e.target.value)); setRecords([]) }}
              className="flex-1 h-1 accent-accent" />
            <span className="text-[11px] font-mono w-6 text-right">{b}</span>
          </div>
        )}

        {exampleId === 'exp' && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-muted w-24 shrink-0">λ</span>
            <input type="range" min={0.1} max={2} step={0.1} value={lambda}
              onChange={e => { setLambda(parseFloat(e.target.value)); setRecords([]) }}
              className="flex-1 h-1 accent-accent" />
            <span className="text-[11px] font-mono w-8 text-right">{lambda.toFixed(1)}</span>
          </div>
        )}

        {exampleId === 'azuma' && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-text-muted w-24 shrink-0">Bound c</span>
            <input type="range" min={0.1} max={2} step={0.1} value={c}
              onChange={e => { setC(parseFloat(e.target.value)); setRecords([]) }}
              className="flex-1 h-1 accent-accent" />
            <span className="text-[11px] font-mono w-8 text-right">{c.toFixed(1)}</span>
          </div>
        )}

        <div className="space-y-2">
          <button onClick={generate}
            className="w-full text-xs font-medium bg-accent text-white py-2 rounded hover:opacity-90 transition-opacity">
            + Generate {K} paths
          </button>
          <button onClick={reset}
            className="w-full text-xs border border-border text-text-muted py-1.5 rounded hover:bg-surface transition-colors">
            Reset ({records.length} stored)
          </button>
        </div>

        <div className="rounded border border-border bg-surface px-3 py-2.5 text-xs space-y-1.5">
          <p className="label-xs">Martingale property</p>
          <p className="text-[11px] text-text-muted leading-relaxed">{example.description}</p>
          <p className="text-[11px] text-accent leading-relaxed font-medium">
            Red line = mean of all paths. For a martingale, it stays flat at E[X₀].
          </p>
        </div>
      </div>

      {/* ── Plot ── */}
      <div className="flex-1 flex flex-col p-4 bg-surface min-h-0 overflow-y-auto gap-3">
        {exampleId === 'rw' && (
          <RandomWalkPanel N={N} records={records} />
        )}
        {exampleId === 'stopped' && (
          <StoppedWalkPanel N={N} b={b} records={records} />
        )}
        {exampleId === 'exp' && (
          <ExpMartPanel N={N} T={T} lambda={lambda} records={records} />
        )}
        {exampleId === 'azuma' && (
          <AzumaPanel N={N} c={c} records={records} />
        )}
        {records.length === 0 && (
          <p className="text-[11px] text-text-muted italic">
            Click "Generate paths". The key diagnostic: the red mean line should stay flat at E[X₀],
            regardless of how wild individual paths look.
          </p>
        )}
      </div>

    </div>
  )
}
