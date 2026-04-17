'use client'

import { useState, useMemo, useCallback } from 'react'
import { randNormal, normalPDF, histogram, sampleStats, niceTicks, fmtTick } from './distributions/math'

// ═══════════════════════════════════════════════════════════════════════════
// Simulation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Simulate a standard Brownian motion path.
 * W_0 = 0,  W_{k+1} = W_k + √(Δt)·Z_k,  Z_k ~ N(0,1)  i.i.d.
 * Exact in distribution: W_{t_k} ~ N(0, t_k), independent increments.
 */
function simulateBM(steps: number, T: number): number[] {
  const dt = T / steps
  const sq = Math.sqrt(dt)
  const W = new Array<number>(steps + 1)
  W[0] = 0
  for (let k = 1; k <= steps; k++) {
    W[k] = W[k - 1] + sq * randNormal()
  }
  return W
}

/**
 * Quadratic variation: [W]^(π)_t = Σ (ΔW_k)²
 * As the mesh |π|→0 this converges to t in L² (and a.s. along dyadic sequences).
 * For any C¹ path f, [f]_t = 0 — so QV=t is unique to BM-like roughness.
 */
function computeQV(W: number[]): number[] {
  const qv = new Array<number>(W.length).fill(0)
  for (let k = 1; k < W.length; k++) {
    const d = W[k] - W[k - 1]
    qv[k] = qv[k - 1] + d * d
  }
  return qv
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

interface AxesProps {
  xTicks: number[]; yTicks: number[]
  sx: (x: number) => number; sy: (y: number) => number
  pw: number; ph: number
  xLabel?: string; yLabel?: string
}

function Axes({ xTicks, yTicks, sx, sy, pw, ph, xLabel, yLabel }: AxesProps) {
  return (
    <>
      <rect x={PAD.left} y={PAD.top} width={pw} height={ph}
        fill="var(--color-elevated)" rx="2" />
      {yTicks.map(y => (
        <line key={y} x1={PAD.left} y1={sy(y)} x2={PAD.left + pw} y2={sy(y)}
          stroke="var(--color-border)" strokeWidth="0.5" />
      ))}
      {xTicks.map(x => (
        <line key={x} x1={sx(x)} y1={PAD.top} x2={sx(x)} y2={PAD.top + ph}
          stroke="var(--color-border)" strokeWidth="0.5" />
      ))}
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
    </>
  )
}

function pathD(ys: number[], T: number, sx: (x: number) => number, sy: (y: number) => number): string {
  const N = ys.length - 1
  return ys.map((y, i) =>
    `${i === 0 ? 'M' : 'L'}${sx(i * T / N).toFixed(1)},${sy(y).toFixed(1)}`
  ).join('')
}

// ═══════════════════════════════════════════════════════════════════════════
// Paths tab
// ═══════════════════════════════════════════════════════════════════════════

function PathsTab({ paths, T }: { paths: number[][]; T: number }) {
  const { yMin, yMax } = useMemo(() => {
    if (paths.length === 0) return { yMin: -2.5 * Math.sqrt(T), yMax: 2.5 * Math.sqrt(T) }
    let lo = 0, hi = 0
    for (const p of paths) for (const y of p) {
      if (y < lo) lo = y; if (y > hi) hi = y
    }
    const m = Math.max(Math.abs(lo), Math.abs(hi)) * 0.12 + 0.2
    return { yMin: lo - m, yMax: hi + m }
  }, [paths, T])

  const { pw, ph, sx, sy } = makeScales(0, T, yMin, yMax)
  const xTicks = niceTicks(0, T, 5)
  const yTicks = niceTicks(yMin, yMax, 5)

  // ±2√t envelope points
  const N_ENV = 120
  const envUpper = Array.from({ length: N_ENV }, (_, i) => {
    const t = (i / (N_ENV - 1)) * T
    return `${i === 0 ? 'M' : 'L'}${sx(t).toFixed(1)},${sy(2 * Math.sqrt(t)).toFixed(1)}`
  }).join('')
  const envLower = Array.from({ length: N_ENV }, (_, i) => {
    const t = ((N_ENV - 1 - i) / (N_ENV - 1)) * T
    return `L${sx(t).toFixed(1)},${sy(-2 * Math.sqrt(t)).toFixed(1)}`
  }).join('')
  const envFill = `${envUpper}${envLower}Z`
  const envUpperPath = Array.from({ length: N_ENV }, (_, i) => {
    const t = (i / (N_ENV - 1)) * T
    return `${i === 0 ? 'M' : 'L'}${sx(t).toFixed(1)},${sy(2 * Math.sqrt(t)).toFixed(1)}`
  }).join('')
  const envLowerPath = Array.from({ length: N_ENV }, (_, i) => {
    const t = (i / (N_ENV - 1)) * T
    return `${i === 0 ? 'M' : 'L'}${sx(t).toFixed(1)},${sy(-2 * Math.sqrt(t)).toFixed(1)}`
  }).join('')

  const stats = useMemo(() => {
    if (paths.length === 0) return null
    const endpoints = paths.map(p => p[p.length - 1])
    return sampleStats(endpoints)
  }, [paths])

  return (
    <div className="flex flex-col gap-2">
      <svg width="100%" viewBox={`0 0 ${VW} ${VH}`}
        style={{ overflow: 'visible', display: 'block' }}
        aria-label="Brownian motion sample paths">
        <defs>
          <clipPath id="bm-paths-clip">
            <rect x={PAD.left} y={PAD.top} width={pw} height={ph} />
          </clipPath>
        </defs>
        <Axes xTicks={xTicks} yTicks={yTicks} sx={sx} sy={sy}
          pw={pw} ph={ph} xLabel="t" yLabel="W_t" />
        <g clipPath="url(#bm-paths-clip)">
          {/* 95% pointwise envelope fill */}
          <path d={envFill} fill="#4E79A7" fillOpacity="0.06" stroke="none" />
          <path d={envUpperPath} fill="none" stroke="#4E79A7"
            strokeWidth="1" strokeDasharray="4 3" strokeOpacity="0.5" />
          <path d={envLowerPath} fill="none" stroke="#4E79A7"
            strokeWidth="1" strokeDasharray="4 3" strokeOpacity="0.5" />
          {/* Mean line y=0 */}
          <line x1={sx(0)} y1={sy(0)} x2={sx(T)} y2={sy(0)}
            stroke="var(--color-border-strong)" strokeWidth="1"
            strokeDasharray="6 3" opacity="0.6" />
          {/* Sample paths */}
          {paths.map((W, i) => (
            <path key={i} d={pathD(W, T, sx, sy)}
              fill="none" stroke="#4E79A7"
              strokeWidth="1" strokeOpacity="0.4"
              strokeLinejoin="round" />
          ))}
        </g>
        {/* Envelope label */}
        {T > 0 && (
          <text x={sx(T) - 2} y={sy(2 * Math.sqrt(T)) - 4} textAnchor="end"
            fontSize="8" fill="#4E79A7" fontFamily="var(--font-mono, monospace)">
            ±2√t
          </text>
        )}
      </svg>
      {stats && (
        <div className="flex gap-4 text-[10px] font-mono text-text-muted px-1">
          <span>W_T: n={paths.length}</span>
          <span>mean={stats.mean.toFixed(3)} (theory: 0)</span>
          <span>std={stats.std.toFixed(3)} (theory: {Math.sqrt(T).toFixed(3)})</span>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Distribution tab — W_t* ~ N(0, t*)
// ═══════════════════════════════════════════════════════════════════════════

function DistTab({ paths, T }: { paths: number[][]; T: number }) {
  const [tFrac, setTFrac] = useState(1.0)

  const tStar = tFrac * T
  const stepFrac = tFrac

  // Sample values at t* from each path
  const samples = useMemo(() => {
    if (paths.length === 0) return []
    return paths.map(W => {
      const idx = Math.min(Math.round(stepFrac * (W.length - 1)), W.length - 1)
      return W[idx]
    })
  }, [paths, stepFrac])

  const bins = useMemo(() => histogram(samples, 30), [samples])
  const sd = Math.sqrt(tStar)

  const yMin = 0
  const yMax = useMemo(() => {
    const peakTheory = normalPDF(0) / sd
    const peakEmp    = bins.length > 0 ? Math.max(...bins.map(b => b.density)) : 0
    return Math.max(peakTheory, peakEmp) * 1.15
  }, [bins, sd])

  const xRange = sd * 4
  const xMin = -xRange, xMax = xRange
  const { pw, ph, sx, sy } = makeScales(xMin, xMax, yMin, yMax)
  const xTicks = niceTicks(xMin, xMax, 5)
  const yTicks = niceTicks(0, yMax, 4)

  const baseline = sy(0)
  const curvePath = useMemo(() => {
    return Array.from({ length: 200 }, (_, i) => {
      const x = xMin + (i / 199) * (xMax - xMin)
      const y = normalPDF(x / sd) / sd
      return `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`
    }).join('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sd, xMin, xMax, sx, sy])

  const stats = useMemo(() => samples.length > 0 ? sampleStats(samples) : null, [samples])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 px-1">
        <span className="text-[11px] text-text-muted">t* =</span>
        <input type="range" min={0.01} max={1} step={0.01} value={tFrac}
          onChange={e => setTFrac(parseFloat(e.target.value))}
          className="flex-1 h-1 accent-accent" />
        <span className="text-[11px] font-mono text-text-secondary w-16">
          {tStar.toFixed(3)}
        </span>
      </div>
      <svg width="100%" viewBox={`0 0 ${VW} ${VH}`}
        style={{ overflow: 'visible', display: 'block' }}
        aria-label="Distribution of W at t-star">
        <defs>
          <clipPath id="bm-dist-clip">
            <rect x={PAD.left} y={PAD.top} width={pw} height={ph} />
          </clipPath>
        </defs>
        <Axes xTicks={xTicks} yTicks={yTicks} sx={sx} sy={sy}
          pw={pw} ph={ph} xLabel={`W_{t*}   (t* = ${tStar.toFixed(3)})`} />
        <g clipPath="url(#bm-dist-clip)">
          {bins.map((b, i) => {
            const bx = sx(b.lo)
            const bw = Math.max(0.5, sx(b.hi) - sx(b.lo) - 0.5)
            const by = sy(b.density)
            return <rect key={i} x={bx} y={by} width={bw}
              height={Math.max(0, baseline - by)}
              fill="#4E79A7" fillOpacity="0.5" />
          })}
          <path d={curvePath} fill="none" stroke="var(--color-accent)"
            strokeWidth="2" strokeLinejoin="round" />
        </g>
        {/* Legend */}
        <g transform={`translate(${PAD.left + pw - 130}, ${PAD.top + 8})`}>
          <rect x={0} y={0} width={8} height={8} fill="#4E79A7" fillOpacity="0.5" />
          <text x={12} y={8} fontSize="8.5" fill="var(--color-text-secondary)"
            fontFamily="var(--font-inter, sans-serif)">
            {'W_{t*}'} from paths
          </text>
        </g>
        <g transform={`translate(${PAD.left + pw - 130}, ${PAD.top + 22})`}>
          <line x1={0} y1={4} x2={8} y2={4} stroke="var(--color-accent)" strokeWidth="2" />
          <text x={12} y={8} fontSize="8.5" fill="var(--color-text-secondary)"
            fontFamily="var(--font-inter, sans-serif)">
            N(0, t*) theory
          </text>
        </g>
      </svg>
      {stats ? (
        <div className="flex gap-4 text-[10px] font-mono text-text-muted px-1">
          <span>n={samples.length}</span>
          <span>empirical mean={stats.mean.toFixed(3)} (theory: 0)</span>
          <span>empirical var={stats.variance.toFixed(4)} (theory: {tStar.toFixed(4)})</span>
        </div>
      ) : (
        <p className="text-[11px] text-text-muted px-1">
          Generate paths first — each path contributes one sample of {'W_{t*}'}.
        </p>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Quadratic Variation tab — [W]_t → t
// ═══════════════════════════════════════════════════════════════════════════

function QVTab({ paths, T }: { paths: number[][]; T: number }) {
  const qvPaths = useMemo(() => paths.map(computeQV), [paths])

  const yMax = useMemo(() => {
    if (qvPaths.length === 0) return T * 1.5
    let hi = T * 1.2
    for (const qv of qvPaths) {
      const last = qv[qv.length - 1]
      if (last > hi) hi = last
    }
    return hi * 1.05
  }, [qvPaths, T])

  const { pw, ph, sx, sy } = makeScales(0, T, 0, yMax)
  const xTicks = niceTicks(0, T, 5)
  const yTicks = niceTicks(0, yMax, 5)

  const diagonalD = `M${sx(0).toFixed(1)},${sy(0).toFixed(1)}L${sx(T).toFixed(1)},${sy(T).toFixed(1)}`

  const finalQVs = useMemo(() => qvPaths.map(qv => qv[qv.length - 1]), [qvPaths])
  const meanQV = finalQVs.length > 0
    ? finalQVs.reduce((a, b) => a + b, 0) / finalQVs.length
    : null

  return (
    <div className="flex flex-col gap-2">
      <svg width="100%" viewBox={`0 0 ${VW} ${VH}`}
        style={{ overflow: 'visible', display: 'block' }}
        aria-label="Quadratic variation converging to t">
        <defs>
          <clipPath id="bm-qv-clip">
            <rect x={PAD.left} y={PAD.top} width={pw} height={ph} />
          </clipPath>
        </defs>
        <Axes xTicks={xTicks} yTicks={yTicks} sx={sx} sy={sy}
          pw={pw} ph={ph} xLabel="t" yLabel="[W]_t" />
        <g clipPath="url(#bm-qv-clip)">
          {/* Each QV path */}
          {qvPaths.map((qv, i) => (
            <path key={i} d={pathD(qv, T, sx, sy)}
              fill="none" stroke="#4E79A7" strokeWidth="0.9"
              strokeOpacity="0.35" strokeLinejoin="round" />
          ))}
          {/* y = t diagonal (the target) */}
          <path d={diagonalD} fill="none" stroke="#E15759"
            strokeWidth="2" strokeLinejoin="round" />
        </g>
        {/* Labels */}
        <text x={sx(T) - 4} y={sy(T) - 6} textAnchor="end" fontSize="9"
          fill="#E15759" fontFamily="var(--font-mono, monospace)">
          y = t
        </text>
      </svg>
      <div className="text-[10px] text-text-muted px-1 space-y-0.5">
        {meanQV !== null && (
          <p>Mean [W]_T = {meanQV.toFixed(4)}  (theory: T = {T.toFixed(4)})</p>
        )}
        <p className="italic">
          Smooth C¹ path: [f]_T = 0.  &nbsp;Brownian motion: [W]_T = T.
          The QV of BM is non-zero because (ΔW)² ~ Δt, not o(Δt).
        </p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

type BMTab = 'paths' | 'distribution' | 'qv'

const STEP_OPTS: [number, string][] = [[100, '100'], [250, '250'], [500, '500'], [1000, '1000']]
const T_OPTS:    [number, string][] = [[0.5, '0.5'], [1, '1'], [2, '2'], [5, '5']]
const K_OPTS:    [number, string][] = [[5, '5'], [10, '10'], [20, '20'], [50, '50']]

function ToggleRow<T extends number>({
  label, value, options, onChange,
}: {
  label: string
  value: T
  options: [T, string][]
  onChange: (v: T) => void
}) {
  return (
    <div>
      <p className="label-xs mb-1.5">{label}</p>
      <div className="flex gap-1 flex-wrap">
        {options.map(([v, lbl]) => (
          <button key={lbl} onClick={() => onChange(v)}
            className={`text-[11px] font-mono px-2 py-1 rounded border transition-colors ${
              value === v
                ? 'bg-surface border-border text-text-primary font-semibold'
                : 'border-transparent text-text-muted hover:border-border hover:text-text-secondary'
            }`}>
            {lbl}
          </button>
        ))}
      </div>
    </div>
  )
}

export function BrownianMotion() {
  const [steps, setSteps] = useState(500)
  const [T,     setT]     = useState(1)
  const [K,     setK]     = useState(20)
  const [tab,   setTab]   = useState<BMTab>('paths')
  const [paths, setPaths] = useState<number[][]>([])

  const generate = useCallback(() => {
    const newPaths = Array.from({ length: K }, () => simulateBM(steps, T))
    setPaths(prev => [...prev, ...newPaths].slice(-300))
  }, [K, steps, T])

  const reset = () => setPaths([])

  const handleSteps = (n: number) => { setSteps(n); setPaths([]) }
  const handleT     = (t: number) => { setT(t);     setPaths([]) }

  const tabs: [BMTab, string, string][] = [
    ['paths',        'Paths',        'Sample paths + envelope'],
    ['distribution', 'Distribution', 'W_t* ~ N(0, t*)'],
    ['qv',           'QV',           'Quadratic variation → t'],
  ]

  return (
    <div className="flex flex-col sm:flex-row h-full min-h-0">

      {/* ── Controls ── */}
      <div className="flex flex-col gap-4 p-5 sm:w-56 shrink-0 border-b sm:border-b-0 sm:border-r border-border bg-elevated overflow-y-auto">

        <ToggleRow label="Steps per path" value={steps} options={STEP_OPTS} onChange={handleSteps} />
        <ToggleRow label="Time horizon T"  value={T}     options={T_OPTS}    onChange={handleT} />
        <ToggleRow label="Paths to add K"  value={K}     options={K_OPTS}    onChange={setK} />

        <div className="space-y-2">
          <button onClick={generate}
            className="w-full text-xs font-medium bg-accent text-white py-2 rounded hover:opacity-90 transition-opacity">
            + Generate {K} paths
          </button>
          <button onClick={reset}
            className="w-full text-xs border border-border text-text-muted py-1.5 rounded hover:bg-surface transition-colors">
            Reset ({paths.length} stored)
          </button>
        </div>

        <div className="rounded border border-border bg-surface px-3 py-2.5 text-xs space-y-1">
          <p className="label-xs mb-2">Key properties</p>
          {([
            ['W₀ = 0',           'exact start'],
            ['ΔW ~ N(0, Δt)',    'Gaussian increments'],
            ['E[W_t] = 0',       'martingale property'],
            ['Var[W_t] = t',     'linear variance'],
            ['[W]_t = t',        'quadratic variation'],
            ['H = ½',            'Hurst exponent'],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-1">
              <span className="font-mono text-text-secondary">{k}</span>
              <span className="text-text-muted">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Main panel ── */}
      <div className="flex-1 flex flex-col min-h-0 bg-surface">

        {/* Tabs */}
        <div className="flex gap-0 border-b border-border shrink-0">
          {tabs.map(([id, label, hint]) => (
            <button key={id} onClick={() => setTab(id)}
              title={hint}
              className={`px-4 py-2 text-xs border-b-2 transition-colors ${
                tab === id
                  ? 'border-accent text-text-primary font-medium'
                  : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 p-4 overflow-y-auto">
          {tab === 'paths'        && <PathsTab paths={paths} T={T} />}
          {tab === 'distribution' && <DistTab  paths={paths} T={T} />}
          {tab === 'qv'           && <QVTab    paths={paths} T={T} />}
          {paths.length === 0 && (
            <p className="text-[11px] text-text-muted italic mt-3">
              Click "Generate paths" to begin. Each click adds K new independent realisations.
            </p>
          )}
        </div>
      </div>

    </div>
  )
}
