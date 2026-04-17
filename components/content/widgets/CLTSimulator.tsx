'use client'

import { useState, useMemo, useCallback } from 'react'
import { randNormal, normalPDF, niceTicks, fmtTick } from './distributions/math'

// ── Population definitions ────────────────────────────────────────────────────

interface Population {
  id: string
  label: string
  description: string
  mean: number
  variance: number
  sample: () => number
  color: string
}

const POPULATIONS: Population[] = [
  {
    id: 'uniform',
    label: 'Uniform[0, 1]',
    description: 'μ = 0.5, σ² = 1/12',
    mean: 0.5,
    variance: 1 / 12,
    sample: () => Math.random(),
    color: '#4E79A7',
  },
  {
    id: 'exponential',
    label: 'Exponential(λ=1)',
    description: 'μ = 1, σ² = 1  (right-skewed)',
    mean: 1,
    variance: 1,
    sample: () => -Math.log(1 - Math.random()),
    color: '#59A14F',
  },
  {
    id: 'bimodal',
    label: 'Bimodal Mixture',
    description: 'μ = 0, σ² = 4.25  (two-humped)',
    mean: 0,
    variance: 4.25,
    sample: () => (Math.random() < 0.5 ? -2 : 2) + 0.5 * randNormal(),
    color: '#9467BD',
  },
  {
    id: 'pareto',
    label: 'Pareto(α=3)',
    description: 'μ = 1.5, σ² = 0.75  (heavy tail)',
    mean: 1.5,
    variance: 0.75,
    sample: () => Math.pow(Math.random(), -1 / 3),   // xm=1
    color: '#E15759',
  },
]

const SAMPLE_SIZES = [1, 2, 5, 10, 25, 50]
const BATCH = 500
const MAX_MEANS = 5_000

// ── Histogram + Normal overlay ────────────────────────────────────────────────

const HP = { top: 20, right: 14, bottom: 38, left: 46 }

function HistPlot({
  means,
  mu,
  sigma2n,
  popColor,
  vw = 500,
  vh = 190,
}: {
  means: number[]
  mu: number
  sigma2n: number
  popColor: string
  vw?: number
  vh?: number
}) {
  const pw = vw - HP.left - HP.right
  const ph = vh - HP.top  - HP.bottom
  const sigma = Math.sqrt(sigma2n)

  const { bins, xMin, xMax, yMax } = useMemo(() => {
    const lo = mu - 4.5 * sigma
    const hi = mu + 4.5 * sigma
    const nBins = 44
    const bw = (hi - lo) / nBins

    if (means.length === 0) {
      return { bins: [], xMin: lo, xMax: hi, yMax: normalPDF(0) / sigma * 1.15 }
    }

    const counts = new Array(nBins).fill(0)
    let inside = 0
    for (const m of means) {
      const i = Math.floor((m - lo) / bw)
      if (i >= 0 && i < nBins) { counts[i]++; inside++ }
    }
    const total = inside || 1
    const binData = counts.map((c, i) => ({
      lo: lo + i * bw,
      hi: lo + (i + 1) * bw,
      density: c / (total * bw),
    }))
    const peakTheory = normalPDF(0) / sigma
    const peakEmp = Math.max(...binData.map(b => b.density))
    return { bins: binData, xMin: lo, xMax: hi, yMax: Math.max(peakTheory, peakEmp) * 1.12 }
  }, [means, mu, sigma])

  const sx = (x: number) => HP.left + (x - xMin) / (xMax - xMin) * pw
  const sy = (y: number) => HP.top + (1 - y / yMax) * ph
  const base = sy(0)

  const curvePath = useMemo(() => {
    return Array.from({ length: 200 }, (_, i) => {
      const x = xMin + (i / 199) * (xMax - xMin)
      const y = normalPDF((x - mu) / sigma) / sigma
      return `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`
    }).join('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mu, sigma, xMin, xMax, pw, ph])

  const xTicks = niceTicks(xMin, xMax, 5)
  const yTicks = niceTicks(0, yMax, 4)

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${vw} ${vh}`}
      style={{ display: 'block' }}
      aria-label="Distribution of sample means"
    >
      <defs>
        <clipPath id="clt-plot-clip">
          <rect x={HP.left} y={HP.top} width={pw} height={ph} />
        </clipPath>
      </defs>

      {/* Background */}
      <rect x={HP.left} y={HP.top} width={pw} height={ph}
        fill="var(--color-elevated)" rx="2" />

      {/* Horizontal grid */}
      {yTicks.map(y => (
        <line key={y}
          x1={HP.left} y1={sy(y)} x2={HP.left + pw} y2={sy(y)}
          stroke="var(--color-border)" strokeWidth="0.5" />
      ))}

      <g clipPath="url(#clt-plot-clip)">
        {/* Histogram bars */}
        {bins.map((b, i) => {
          const bx = sx(b.lo)
          const bw2 = Math.max(0.5, sx(b.hi) - sx(b.lo) - 0.5)
          const by = sy(b.density)
          const bh = base - by
          return (
            <rect key={i}
              x={bx} y={by} width={bw2} height={Math.max(0, bh)}
              fill={popColor} fillOpacity={0.45}
            />
          )
        })}

        {/* Theoretical N(μ, σ²/n) curve */}
        {curvePath && (
          <path d={curvePath}
            fill="none"
            stroke="var(--color-accent)"
            strokeWidth="2"
            strokeLinejoin="round"
          />
        )}

        {/* μ reference line */}
        <line
          x1={sx(mu)} y1={HP.top} x2={sx(mu)} y2={HP.top + ph}
          stroke="var(--color-accent)" strokeWidth="1"
          strokeDasharray="4 3" opacity="0.5"
        />
      </g>

      {/* Axes */}
      <line x1={HP.left} y1={HP.top} x2={HP.left} y2={HP.top + ph}
        stroke="var(--color-border-strong)" strokeWidth="1" />
      <line x1={HP.left} y1={HP.top + ph} x2={HP.left + pw} y2={HP.top + ph}
        stroke="var(--color-border-strong)" strokeWidth="1" />

      {/* X ticks */}
      {xTicks.map(x => (
        <g key={x}>
          <line x1={sx(x)} y1={HP.top + ph} x2={sx(x)} y2={HP.top + ph + 4}
            stroke="var(--color-border-strong)" strokeWidth="1" />
          <text x={sx(x)} y={HP.top + ph + 14}
            textAnchor="middle" fontSize="9"
            fill="var(--color-muted)"
            fontFamily="var(--font-mono, monospace)">
            {fmtTick(x)}
          </text>
        </g>
      ))}

      {/* Y ticks */}
      {yTicks.map(y => (
        <g key={y}>
          <line x1={HP.left - 4} y1={sy(y)} x2={HP.left} y2={sy(y)}
            stroke="var(--color-border-strong)" strokeWidth="1" />
          <text x={HP.left - 6} y={sy(y) + 3.5}
            textAnchor="end" fontSize="9"
            fill="var(--color-muted)"
            fontFamily="var(--font-mono, monospace)">
            {fmtTick(y)}
          </text>
        </g>
      ))}

      {/* X-axis label */}
      <text x={HP.left + pw / 2} y={vh - 3}
        textAnchor="middle" fontSize="9.5"
        fill="var(--color-text-secondary)"
        fontFamily="var(--font-inter, sans-serif)">
        sample mean X̄ₙ
      </text>

      {/* Y-axis label */}
      <text
        transform={`translate(11, ${HP.top + ph / 2}) rotate(-90)`}
        textAnchor="middle" fontSize="9.5"
        fill="var(--color-text-secondary)"
        fontFamily="var(--font-inter, sans-serif)">
        density
      </text>

      {/* Legend */}
      <g transform={`translate(${HP.left + pw - 140}, ${HP.top + 8})`}>
        <rect x={0} y={0} width={8} height={8}
          fill={popColor} fillOpacity={0.45} />
        <text x={12} y={8} fontSize="8.5"
          fill="var(--color-text-secondary)"
          fontFamily="var(--font-inter, sans-serif)">
          empirical
        </text>
      </g>
      <g transform={`translate(${HP.left + pw - 140}, ${HP.top + 22})`}>
        <line x1={0} y1={4} x2={8} y2={4}
          stroke="var(--color-accent)" strokeWidth="2" />
        <text x={12} y={8} fontSize="8.5"
          fill="var(--color-text-secondary)"
          fontFamily="var(--font-inter, sans-serif)">
          N(μ, σ²/n)
        </text>
      </g>
    </svg>
  )
}

// ── Population shape preview ──────────────────────────────────────────────────

function PopPreview({ pop, size = 80 }: { pop: Population; size?: number }) {
  const pts = useMemo(() => {
    const N = 2000
    const raw = Array.from({ length: N }, () => pop.sample())
    const lo = Math.min(...raw)
    const hi = Math.max(...raw)
    const nBins = 24
    const bw = (hi - lo) / nBins
    const counts = new Array(nBins).fill(0)
    for (const x of raw) {
      const i = Math.floor((x - lo) / bw)
      if (i >= 0 && i < nBins) counts[i]++
    }
    const peak = Math.max(...counts)
    return { counts, lo, hi, bw, peak }
  }, [pop])

  const { counts, lo, hi, bw, peak } = pts
  const sx = (x: number) => 2 + (x - lo) / (hi - lo) * (size - 4)
  const sy = (h: number) => size - 2 - (h / peak) * (size - 6)

  return (
    <svg width={size} height={size / 2}
      viewBox={`0 0 ${size} ${size / 2}`}
      style={{ display: 'block' }}
      aria-label={`${pop.label} distribution preview`}
    >
      {counts.map((c, i) => {
        const bx = sx(lo + i * bw)
        const bw2 = Math.max(0.5, sx(lo + (i + 1) * bw) - bx - 0.5)
        const by = sy(c) / 2
        const bh = (size / 2 - 2) - by
        return (
          <rect key={i}
            x={bx} y={by} width={bw2} height={Math.max(0, bh)}
            fill={pop.color} fillOpacity={0.55} />
        )
      })}
    </svg>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

export function CLTSimulator() {
  const [popId, setPopId]   = useState('uniform')
  const [n, setN]           = useState(1)
  const [means, setMeans]   = useState<number[]>([])

  const pop = POPULATIONS.find(p => p.id === popId)!

  const drawSamples = useCallback(() => {
    const { sample } = pop
    const newMeans = Array.from({ length: BATCH }, () => {
      let sum = 0
      for (let i = 0; i < n; i++) sum += sample()
      return sum / n
    })
    setMeans(prev => {
      const combined = [...prev, ...newMeans]
      return combined.length > MAX_MEANS ? combined.slice(-MAX_MEANS) : combined
    })
  }, [pop, n])

  const reset = useCallback(() => setMeans([]), [])

  const handlePopChange = (id: string) => { setPopId(id); setMeans([]) }
  const handleNChange   = (newN: number) => { setN(newN); setMeans([]) }

  const sigma2n = pop.variance / n

  const stats = useMemo(() => {
    if (means.length < 2) return null
    const m = means.reduce((a, b) => a + b, 0) / means.length
    const s2 = means.reduce((a, b) => a + (b - m) ** 2, 0) / means.length
    const sk = means.reduce((a, b) => a + ((b - m) / Math.sqrt(s2)) ** 3, 0) / means.length
    return { mean: m, std: Math.sqrt(s2), skew: sk }
  }, [means])

  return (
    <div className="flex flex-col sm:flex-row h-full min-h-0">

      {/* ── Controls ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 p-5 sm:w-60 shrink-0 border-b sm:border-b-0 sm:border-r border-border bg-elevated overflow-y-auto">

        <div>
          <p className="label-xs mb-2">Population distribution</p>
          <div className="space-y-1">
            {POPULATIONS.map(p => (
              <button
                key={p.id}
                onClick={() => handlePopChange(p.id)}
                className={`w-full text-left px-2.5 py-2 rounded border transition-colors ${
                  popId === p.id
                    ? 'bg-surface border-border text-text-primary'
                    : 'border-transparent text-text-secondary hover:bg-surface'
                }`}
              >
                <div className="flex items-center gap-2 mb-0.5">
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ background: p.color }}
                  />
                  <span className="text-xs font-medium">{p.label}</span>
                </div>
                <PopPreview pop={p} size={90} />
                <p className="text-[10px] text-text-muted mt-0.5">{p.description}</p>
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="label-xs mb-2">Sample size n</p>
          <div className="grid grid-cols-3 gap-1">
            {SAMPLE_SIZES.map(s => (
              <button
                key={s}
                onClick={() => handleNChange(s)}
                className={`text-xs py-1.5 rounded border font-mono transition-colors ${
                  n === s
                    ? 'bg-surface border-border text-text-primary font-semibold'
                    : 'border-transparent text-text-muted hover:border-border hover:text-text-secondary'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <button
            onClick={drawSamples}
            className="w-full text-xs font-medium bg-accent text-white py-2 rounded hover:opacity-90 transition-opacity"
          >
            + Draw {BATCH} sample means
          </button>
          <button
            onClick={reset}
            className="w-full text-xs border border-border text-text-muted py-1.5 rounded hover:bg-surface transition-colors"
          >
            Reset
          </button>
        </div>

        <div className="rounded border border-border bg-surface px-3 py-2.5 text-xs space-y-1">
          <p className="label-xs mb-2">CLT prediction</p>
          {([
            ['μ (pop. mean)',   pop.mean.toPrecision(4)],
            ['σ²/n (var of X̄)', sigma2n.toPrecision(4)],
            ['σ/√n (std of X̄)',  Math.sqrt(sigma2n).toPrecision(4)],
          ] as [string, string][]).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-2">
              <span className="text-text-muted">{k}</span>
              <span className="font-mono text-text-secondary">{v}</span>
            </div>
          ))}
        </div>

        {stats && (
          <div className="rounded border border-border bg-surface px-3 py-2.5 text-xs space-y-1">
            <p className="label-xs mb-2">Empirical ({means.length} reps)</p>
            {([
              ['mean',  stats.mean.toPrecision(4)],
              ['std',   stats.std.toPrecision(4)],
              ['skew',  stats.skew.toFixed(3)],
            ] as [string, string][]).map(([k, v]) => (
              <div key={k} className="flex justify-between gap-2">
                <span className="text-text-muted">{k}</span>
                <span className="font-mono text-text-secondary">{v}</span>
              </div>
            ))}
          </div>
        )}

        {means.length === 0 && (
          <p className="text-[11px] text-text-muted italic leading-relaxed">
            Select a population, set n, then click Draw to build up the sampling distribution.
            Watch skewness disappear as n grows.
          </p>
        )}
      </div>

      {/* ── Plot ─────────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-5 bg-surface min-h-0">
        <div className="w-full">
          <HistPlot
            means={means}
            mu={pop.mean}
            sigma2n={sigma2n}
            popColor={pop.color}
          />
        </div>
        <p className="text-[11px] text-text-muted text-center max-w-md leading-relaxed">
          By the <strong>Central Limit Theorem</strong>, the sample mean X̄ₙ converges in
          distribution to N(μ, σ²/n) regardless of the population shape — the blue
          curve shows this target as you increase n.
          {means.length > 0 && ` (${means.length} realisations)`}
        </p>
      </div>

    </div>
  )
}
