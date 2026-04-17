'use client'

import { useState, useMemo } from 'react'
import { normalPDF, normalCDF, normalQuantile, niceTicks, fmtTick } from './distributions/math'

// ── Distribution implementations ─────────────────────────────────────────────

interface DistParams { [key: string]: number }

interface DistDef {
  id: string
  name: string
  color: string
  paramSpecs: { key: string; label: string; min: number; max: number; step: number; default: number }[]
  pdf: (x: number, p: DistParams) => number
  cdf: (x: number, p: DistParams) => number
  plotDomain: (p: DistParams) => [number, number]
  mean:     (p: DistParams) => number | null
  variance: (p: DistParams) => number | null
  skewness: (p: DistParams) => number | null
  kurtosis: (p: DistParams) => number | null
}

const TAU = 2 * Math.PI

const DISTRIBUTIONS: DistDef[] = [
  {
    id: 'normal',
    name: 'Normal',
    color: '#4E79A7',
    paramSpecs: [
      { key: 'mu',    label: 'μ (mean)',  min: -5, max: 5,  step: 0.1, default: 0   },
      { key: 'sigma', label: 'σ (std)',   min: 0.1, max: 5, step: 0.1, default: 1   },
    ],
    pdf: (x, { mu, sigma }) => normalPDF((x - mu) / sigma) / sigma,
    cdf: (x, { mu, sigma }) => normalCDF((x - mu) / sigma),
    plotDomain: ({ mu, sigma }) => [mu - 4 * sigma, mu + 4 * sigma],
    mean:     ({ mu }) => mu,
    variance: ({ sigma }) => sigma * sigma,
    skewness: () => 0,
    kurtosis: () => 0,
  },
  {
    id: 'cauchy',
    name: 'Cauchy',
    color: '#E15759',
    paramSpecs: [
      { key: 'x0',    label: 'x₀ (location)', min: -5, max: 5,  step: 0.1, default: 0 },
      { key: 'gamma', label: 'γ (scale)',      min: 0.1, max: 5, step: 0.1, default: 1 },
    ],
    pdf: (x, { x0, gamma }) => 1 / (Math.PI * gamma * (1 + ((x - x0) / gamma) ** 2)),
    cdf: (x, { x0, gamma }) => 0.5 + Math.atan2(x - x0, gamma) / Math.PI,
    plotDomain: ({ x0, gamma }) => [x0 - 12 * gamma, x0 + 12 * gamma],
    mean:     () => null,
    variance: () => null,
    skewness: () => null,
    kurtosis: () => null,
  },
  {
    id: 'levy',
    name: 'Lévy',
    color: '#59A14F',
    paramSpecs: [
      { key: 'mu', label: 'μ (shift)',  min: -4, max: 4,  step: 0.1, default: 0   },
      { key: 'c',  label: 'c (scale)',  min: 0.1, max: 5, step: 0.1, default: 1   },
    ],
    pdf: (x, { mu, c }) => {
      if (x <= mu) return 0
      const z = x - mu
      return Math.sqrt(c / TAU) * Math.exp(-c / (2 * z)) / Math.pow(z, 1.5)
    },
    cdf: (x, { mu, c }) => {
      if (x <= mu) return 0
      return 1 - normalCDF(Math.sqrt(c / (x - mu)))
    },
    // Lévy has no finite mean, variance, etc.
    plotDomain: ({ mu, c }) => [mu + 1e-4, mu + 25 * c],
    mean:     () => null,
    variance: () => null,
    skewness: () => null,
    kurtosis: () => null,
  },
]

// ── Plot constants ────────────────────────────────────────────────────────────

const PAD = { top: 22, right: 16, bottom: 38, left: 48 }
const VW = 500, VH = 180

function buildLinePath(
  pts: [number, number][],
  sx: (x: number) => number,
  sy: (y: number) => number
): string {
  const valid = pts.filter(([x, y]) => isFinite(x) && isFinite(y) && y >= 0)
  if (valid.length === 0) return ''
  return valid.map(([x, y], i) =>
    `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`
  ).join('')
}

interface SeriesSpec {
  pts: [number, number][]
  color: string
  dashed?: boolean
  label?: string
}

function SVGPlot({
  series,
  xDomain,
  yDomain,
  xLabel,
  title,
  clipId,
}: {
  series: SeriesSpec[]
  xDomain: [number, number]
  yDomain: [number, number]
  xLabel?: string
  title?: string
  clipId: string
}) {
  const [xMin, xMax] = xDomain
  const [yMin, yMax] = yDomain
  const pw = VW - PAD.left - PAD.right
  const ph = VH - PAD.top  - PAD.bottom

  const sx = (x: number) => PAD.left + (x - xMin) / (xMax - xMin) * pw
  const sy = (y: number) => PAD.top + (1 - (y - yMin) / (yMax - yMin)) * ph

  const xTicks = niceTicks(xMin, xMax, 5)
  const yTicks = niceTicks(yMin, yMax, 4)

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${VW} ${VH}`}
      style={{ overflow: 'visible', display: 'block' }}
      aria-label={title ?? 'Distribution plot'}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={PAD.left} y={PAD.top} width={pw} height={ph} />
        </clipPath>
      </defs>

      <rect x={PAD.left} y={PAD.top} width={pw} height={ph}
        fill="var(--color-elevated)" rx="2" />

      {yTicks.map(y => (
        <line key={y}
          x1={PAD.left} y1={sy(y)} x2={PAD.left + pw} y2={sy(y)}
          stroke="var(--color-border)" strokeWidth="0.5" />
      ))}
      {xTicks.map(x => (
        <line key={x}
          x1={sx(x)} y1={PAD.top} x2={sx(x)} y2={PAD.top + ph}
          stroke="var(--color-border)" strokeWidth="0.5" />
      ))}

      <g clipPath={`url(#${clipId})`}>
        {series.map((s, i) => {
          const p = buildLinePath(s.pts, sx, sy)
          if (!p) return null
          return (
            <path key={i}
              d={p}
              fill="none"
              stroke={s.color}
              strokeWidth="2"
              strokeDasharray={s.dashed ? '5 3' : undefined}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )
        })}
      </g>

      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + ph}
        stroke="var(--color-border-strong)" strokeWidth="1" />
      <line x1={PAD.left} y1={PAD.top + ph} x2={PAD.left + pw} y2={PAD.top + ph}
        stroke="var(--color-border-strong)" strokeWidth="1" />

      {xTicks.map(x => (
        <g key={x}>
          <line x1={sx(x)} y1={PAD.top + ph} x2={sx(x)} y2={PAD.top + ph + 4}
            stroke="var(--color-border-strong)" strokeWidth="1" />
          <text x={sx(x)} y={PAD.top + ph + 14}
            textAnchor="middle" fontSize="9"
            fill="var(--color-muted)"
            fontFamily="var(--font-mono, monospace)">
            {fmtTick(x)}
          </text>
        </g>
      ))}

      {yTicks.map(y => (
        <g key={y}>
          <line x1={PAD.left - 4} y1={sy(y)} x2={PAD.left} y2={sy(y)}
            stroke="var(--color-border-strong)" strokeWidth="1" />
          <text x={PAD.left - 6} y={sy(y) + 3.5}
            textAnchor="end" fontSize="9"
            fill="var(--color-muted)"
            fontFamily="var(--font-mono, monospace)">
            {fmtTick(y)}
          </text>
        </g>
      ))}

      {xLabel && (
        <text x={PAD.left + pw / 2} y={VH - 3}
          textAnchor="middle" fontSize="9.5"
          fill="var(--color-text-secondary)"
          fontFamily="var(--font-inter, sans-serif)">
          {xLabel}
        </text>
      )}

      {title && (
        <text x={PAD.left + pw / 2} y={PAD.top - 7}
          textAnchor="middle" fontSize="9.5"
          fill="var(--color-text-secondary)"
          fontFamily="var(--font-inter, sans-serif)"
          fontWeight="500">
          {title}
        </text>
      )}

      {/* Legend */}
      {series.some(s => s.label) && (
        <g>
          {series.filter(s => s.label).map((s, i) => (
            <g key={i} transform={`translate(${PAD.left + pw - 110}, ${PAD.top + 8 + i * 14})`}>
              <line x1={0} y1={5} x2={12} y2={5}
                stroke={s.color} strokeWidth="2"
                strokeDasharray={s.dashed ? '4 2' : undefined} />
              <text x={16} y={8.5} fontSize="8.5"
                fill="var(--color-text-secondary)"
                fontFamily="var(--font-inter, sans-serif)">
                {s.label}
              </text>
            </g>
          ))}
        </g>
      )}
    </svg>
  )
}

// ── Tail comparison sparkline ─────────────────────────────────────────────────

function TailSparkline({
  dists, params, visible,
}: {
  dists: DistDef[]
  params: DistParams[]
  visible: boolean[]
}) {
  const series = useMemo(() => {
    // Log-scale CDF (1−F(x)) tail comparison from x=0 to x=20
    return dists.map((dist, i) => {
      if (!visible[i]) return null
      const p = params[i]
      const [lo] = dist.plotDomain(p)
      const xStart = Math.max(lo, dist.id === 'levy' ? p.mu + 0.01 : lo)
      return Array.from({ length: 100 }, (_, j) => {
        const x = xStart + (j / 99) * 20
        const sf = 1 - dist.cdf(x, p)
        return [x, Math.max(sf, 1e-10)] as [number, number]
      })
    })
  }, [dists, params, visible])

  const yMin = 1e-6, yMax = 1
  const pw = 220, ph = 80
  const lp = { top: 8, right: 8, bottom: 20, left: 36 }
  const sx = (x: number) => lp.left + (x / 20) * pw
  const sy = (y: number) => {
    const lo = Math.log10(yMin), hi = Math.log10(yMax)
    return lp.top + (1 - (Math.log10(y) - lo) / (hi - lo)) * ph
  }

  const vw = pw + lp.left + lp.right
  const vh = ph + lp.top + lp.bottom

  const yTicks = [1, 0.1, 0.01, 0.001, 1e-4, 1e-6].filter(v => v >= yMin)

  function superscript(n: number): string {
    const SUPER: Record<string, string> = {
      '-': '⁻', '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴',
      '5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹',
    }
    return String(n).split('').map(c => SUPER[c] ?? c).join('')
  }

  return (
    <svg width="100%" viewBox={`0 0 ${vw} ${vh}`}
      style={{ display: 'block' }}
      aria-label="Tail survival function comparison">
      <defs>
        <clipPath id="tail-clip">
          <rect x={lp.left} y={lp.top} width={pw} height={ph} />
        </clipPath>
      </defs>
      <rect x={lp.left} y={lp.top} width={pw} height={ph}
        fill="var(--color-elevated)" rx="1" />
      {yTicks.map(y => (
        <g key={y}>
          <line x1={lp.left} y1={sy(y)} x2={lp.left + pw} y2={sy(y)}
            stroke="var(--color-border)" strokeWidth="0.4" />
          <text x={lp.left - 3} y={sy(y) + 3} textAnchor="end" fontSize="7"
            fill="var(--color-muted)" fontFamily="var(--font-mono, monospace)">
            {y === 1 ? '1' : `10${superscript(Math.round(Math.log10(y)))}`}
          </text>
        </g>
      ))}
      <g clipPath="url(#tail-clip)">
        {series.map((pts, i) => {
          if (!pts) return null
          const path = pts.map(([x, y], j) =>
            `${j === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`
          ).join('')
          return (
            <path key={i} d={path} fill="none"
              stroke={dists[i].color} strokeWidth="1.5" strokeLinejoin="round" />
          )
        })}
      </g>
      <line x1={lp.left} y1={lp.top} x2={lp.left} y2={lp.top + ph}
        stroke="var(--color-border-strong)" strokeWidth="1" />
      <line x1={lp.left} y1={lp.top + ph} x2={lp.left + pw} y2={lp.top + ph}
        stroke="var(--color-border-strong)" strokeWidth="1" />
      <text x={lp.left + pw / 2} y={vh - 2}
        textAnchor="middle" fontSize="7.5"
        fill="var(--color-muted)" fontFamily="var(--font-mono, monospace)">
        x
      </text>
      <text x={lp.left + 3} y={lp.top + 6} fontSize="7"
        fill="var(--color-text-secondary)" fontFamily="var(--font-inter, sans-serif)">
        Tail P(X &gt; x)
      </text>
    </svg>
  )
}

// ── Moment table ──────────────────────────────────────────────────────────────

function fmtMoment(v: number | null | undefined): string {
  if (v === null || v === undefined) return '—'
  if (!isFinite(v)) return v > 0 ? '+∞' : '−∞'
  const a = Math.abs(v)
  if (a === 0) return '0'
  if (a >= 1e4 || (a < 0.001 && a > 0)) return v.toExponential(3)
  return v.toPrecision(5).replace(/\.?0+$/, '')
}

// ── Parameter slider row ──────────────────────────────────────────────────────

function ParamSlider({
  label, value, min, max, step, onChange, color,
}: {
  label: string; value: number; min: number; max: number; step: number
  onChange: (v: number) => void; color: string
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[10px] text-text-muted w-20 shrink-0">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1 h-1"
        style={{ accentColor: color }}
      />
      <span className="text-[10px] font-mono text-text-secondary w-10 text-right shrink-0">
        {value.toFixed(2)}
      </span>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

const DEFAULT_PARAMS: DistParams[] = [
  { mu: 0, sigma: 1 },
  { x0: 0, gamma: 1 },
  { mu: 0, c: 1 },
]

const N_PTS = 300

export function DistributionExplorer() {
  const [params, setParams]   = useState<DistParams[]>(DEFAULT_PARAMS)
  const [visible, setVisible] = useState<boolean[]>([true, true, true])
  const [tab, setTab]         = useState<'pdf' | 'cdf'>('pdf')

  const updateParam = (distIdx: number, key: string, value: number) => {
    setParams(prev => prev.map((p, i) => i === distIdx ? { ...p, [key]: value } : p))
  }

  const toggleVisible = (i: number) => {
    setVisible(prev => prev.map((v, j) => j === i ? !v : v))
  }

  // Compute shared x-domain from all visible distributions
  const { xDom, yMaxPDF, yMaxCDF } = useMemo(() => {
    let lo = Infinity, hi = -Infinity
    DISTRIBUTIONS.forEach((dist, i) => {
      if (!visible[i]) return
      const [a, b] = dist.plotDomain(params[i])
      if (a < lo) lo = a
      if (b > hi) hi = b
    })
    if (!isFinite(lo)) lo = -10
    if (!isFinite(hi)) hi = 10

    // Cap Lévy's very long right tail for shared view
    hi = Math.min(hi, lo + 25)

    let yMaxPDF = 0, yMaxCDF = 1.05
    DISTRIBUTIONS.forEach((dist, i) => {
      if (!visible[i]) return
      const range = hi - lo
      for (let j = 0; j <= N_PTS; j++) {
        const x = lo + (j / N_PTS) * range
        const y = dist.pdf(x, params[i])
        if (isFinite(y) && y > yMaxPDF) yMaxPDF = y
      }
    })

    return {
      xDom: [lo, hi] as [number, number],
      yMaxPDF: yMaxPDF * 1.1 || 1,
      yMaxCDF,
    }
  }, [params, visible])

  const pdfSeries: SeriesSpec[] = useMemo(() =>
    DISTRIBUTIONS.map((dist, i) => {
      if (!visible[i]) return { pts: [], color: dist.color, label: dist.name }
      const [xLo, xHi] = xDom
      const pts: [number, number][] = Array.from({ length: N_PTS + 1 }, (_, j) => {
        const x = xLo + (j / N_PTS) * (xHi - xLo)
        return [x, dist.pdf(x, params[i])]
      })
      return { pts, color: dist.color, label: dist.name }
    })
  , [params, visible, xDom])

  const cdfSeries: SeriesSpec[] = useMemo(() =>
    DISTRIBUTIONS.map((dist, i) => {
      if (!visible[i]) return { pts: [], color: dist.color, label: dist.name }
      const [xLo, xHi] = xDom
      const pts: [number, number][] = Array.from({ length: N_PTS + 1 }, (_, j) => {
        const x = xLo + (j / N_PTS) * (xHi - xLo)
        return [x, dist.cdf(x, params[i])]
      })
      return { pts, color: dist.color, label: dist.name }
    })
  , [params, visible, xDom])

  return (
    <div className="flex flex-col sm:flex-row h-full min-h-0">

      {/* ── Controls ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 p-4 sm:w-64 shrink-0 border-b sm:border-b-0 sm:border-r border-border bg-elevated overflow-y-auto">

        {DISTRIBUTIONS.map((dist, i) => (
          <div key={dist.id}
            className={`rounded border px-3 py-2.5 space-y-2 transition-opacity ${
              visible[i] ? 'border-border bg-surface' : 'border-border/40 bg-elevated opacity-50'
            }`}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => toggleVisible(i)}
                className="w-3 h-3 rounded-sm shrink-0 border border-transparent transition-opacity"
                style={{ background: visible[i] ? dist.color : 'var(--color-border)' }}
                aria-label={`${visible[i] ? 'Hide' : 'Show'} ${dist.name}`}
              />
              <span className="text-xs font-medium text-text-primary">{dist.name}</span>
            </div>
            {dist.paramSpecs.map(spec => (
              <ParamSlider
                key={spec.key}
                label={spec.label}
                value={params[i][spec.key] ?? spec.default}
                min={spec.min} max={spec.max} step={spec.step}
                onChange={v => updateParam(i, spec.key, v)}
                color={dist.color}
              />
            ))}
          </div>
        ))}

        {/* Tail comparison */}
        <div className="rounded border border-border bg-surface px-2 py-2">
          <p className="label-xs mb-2">Tail comparison (log scale)</p>
          <TailSparkline dists={DISTRIBUTIONS} params={params} visible={visible} />
        </div>

        {/* Moment table */}
        <div className="rounded border border-border bg-surface overflow-hidden">
          <table className="w-full text-[10px]">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-2 py-1.5 text-text-muted font-normal">Moment</th>
                {DISTRIBUTIONS.map((d, i) => (
                  <th key={d.id}
                    className="px-2 py-1.5 font-medium text-right"
                    style={{ color: visible[i] ? d.color : 'var(--color-muted)' }}>
                    {d.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {([
                ['Mean',     (d: DistDef, p: DistParams) => d.mean(p)],
                ['Variance', (d: DistDef, p: DistParams) => d.variance(p)],
                ['Skewness', (d: DistDef, p: DistParams) => d.skewness(p)],
                ['Ex. Kurt', (d: DistDef, p: DistParams) => d.kurtosis(p)],
              ] as [string, (d: DistDef, p: DistParams) => number | null][]).map(([label, fn]) => (
                <tr key={label} className="border-b border-border/50 last:border-0">
                  <td className="px-2 py-1 text-text-muted">{label}</td>
                  {DISTRIBUTIONS.map((dist, i) => (
                    <td key={dist.id}
                      className="px-2 py-1 font-mono text-right text-text-secondary">
                      {fmtMoment(fn(dist, params[i]))}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Plot area ────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col gap-3 p-4 bg-surface min-h-0 overflow-y-auto">

        {/* Tab switcher */}
        <div className="flex gap-1 p-1 bg-elevated rounded-md self-center">
          {(['pdf', 'cdf'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-1 text-xs rounded transition-colors font-medium ${
                tab === t
                  ? 'bg-surface text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              {t.toUpperCase()}
            </button>
          ))}
        </div>

        {tab === 'pdf' && (
          <SVGPlot
            series={pdfSeries}
            xDomain={xDom}
            yDomain={[0, yMaxPDF]}
            xLabel="x"
            title="Probability Density Function f(x)"
            clipId="explorer-pdf-clip"
          />
        )}

        {tab === 'cdf' && (
          <SVGPlot
            series={cdfSeries}
            xDomain={xDom}
            yDomain={[0, yMaxCDF]}
            xLabel="x"
            title="Cumulative Distribution Function F(x)"
            clipId="explorer-cdf-clip"
          />
        )}

        <p className="text-[11px] text-text-muted leading-relaxed max-w-lg">
          <strong>Normal</strong> — thin tails, all moments exist.&nbsp;
          <strong>Cauchy</strong> — heavier tails; mean and variance are undefined (the sample mean
          does not converge).&nbsp;
          <strong>Lévy</strong> — one-sided heavy tail (stable index α = 1/2); mean and all higher
          moments are infinite.
        </p>
      </div>

    </div>
  )
}

// ── Quantile utility (used for Lévy VaR, exported for future use) ─────────────

export function levyQuantile(p: number, mu: number, c: number): number {
  if (p <= 0) return mu
  if (p >= 1) return Infinity
  // P(X ≤ x) = erfc(√(c/2(x-μ))) = p  ⟹  x = μ + c/(2·Φ⁻¹(1-p/2)²)
  const z = normalQuantile(1 - p / 2)
  return mu + c / (2 * z * z)
}
