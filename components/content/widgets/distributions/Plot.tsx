'use client'

import { useMemo } from 'react'
import { niceTicks, fmtTick } from './math'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface LineSeries {
  kind: 'line'
  id: string
  points: [number, number][]  // [x, y]
  color: string
  strokeWidth?: number
  fill?: boolean       // shade under curve to y=0
  fillOpacity?: number
  dashed?: boolean
  label?: string
}

export interface HistSeries {
  kind: 'hist'
  id: string
  bins: { lo: number; hi: number; density: number }[]
  color: string
  fillOpacity?: number
  label?: string
}

/** Discrete PMF series — renders vertical impulses + dots at integer positions. */
export interface DiscreteSeries {
  kind: 'discrete'
  id: string
  points: [number, number][]   // [k, P(X=k)]
  color: string
  label?: string
}

export type PlotSeries = LineSeries | HistSeries | DiscreteSeries

export interface VLine {
  x: number
  color?: string
  dashed?: boolean
  label?: string
}

export interface PlotProps {
  series: PlotSeries[]
  vlines?: VLine[]
  xDomain?: [number, number]
  yDomain?: [number, number]
  xLabel?: string
  yLabel?: string
  logY?: boolean
  title?: string
  /** Internal viewBox width (default 560) */
  vw?: number
  /** Internal viewBox height (default 210) */
  vh?: number
  nTicksX?: number
  nTicksY?: number
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAD = { top: 24, right: 16, bottom: 38, left: 50 }

// ── Plot ──────────────────────────────────────────────────────────────────────

export function Plot({
  series,
  vlines = [],
  xDomain,
  yDomain,
  xLabel,
  yLabel,
  logY = false,
  title,
  vw = 560,
  vh = 210,
  nTicksX = 6,
  nTicksY = 5,
}: PlotProps) {
  const pw = vw - PAD.left - PAD.right
  const ph = vh - PAD.top  - PAD.bottom

  // ── Domain computation ──────────────────────────────────────────────────

  const { xMin, xMax, yMin, yMax } = useMemo(() => {
    let xMin = Infinity, xMax = -Infinity
    let yMin = Infinity, yMax = -Infinity

    for (const s of series) {
      if (s.kind === 'line') {
        for (const [x, y] of s.points) {
          if (!isFinite(x) || !isFinite(y)) continue
          if (x < xMin) xMin = x;  if (x > xMax) xMax = x
          if (y < yMin) yMin = y;  if (y > yMax) yMax = y
        }
      } else if (s.kind === 'hist') {
        for (const b of s.bins) {
          if (b.lo < xMin) xMin = b.lo;  if (b.hi > xMax) xMax = b.hi
          if (b.density > yMax) yMax = b.density
        }
        if (yMin > 0) yMin = 0
      } else {
        // discrete
        for (const [x, y] of s.points) {
          if (!isFinite(x) || !isFinite(y)) continue
          if (x < xMin) xMin = x;  if (x > xMax) xMax = x
          if (y > yMax) yMax = y
        }
        if (yMin > 0) yMin = 0
      }
    }
    // Fallback
    if (!isFinite(xMin)) xMin = 0; if (!isFinite(xMax)) xMax = 1
    if (!isFinite(yMin)) yMin = 0; if (!isFinite(yMax)) yMax = 1

    return {
      xMin: xDomain ? xDomain[0] : xMin,
      xMax: xDomain ? xDomain[1] : xMax,
      yMin: yDomain ? yDomain[0] : Math.min(0, yMin),
      yMax: yDomain ? yDomain[1] : yMax * 1.08,
    }
  }, [series, xDomain, yDomain])

  // ── Scale functions ─────────────────────────────────────────────────────

  const sx = (x: number) => PAD.left + (x - xMin) / (xMax - xMin) * pw
  const sy = (y: number): number => {
    if (logY) {
      const yL = Math.log10(Math.max(y, 1e-300))
      const lo = Math.log10(Math.max(yMin, 1e-300))
      const hi = Math.log10(Math.max(yMax, 1e-300))
      return PAD.top + (1 - (yL - lo) / (hi - lo)) * ph
    }
    return PAD.top + (1 - (y - yMin) / (yMax - yMin)) * ph
  }
  const baseline = sy(Math.max(yMin, 0))

  // ── Path builders ───────────────────────────────────────────────────────

  function linePath(pts: [number, number][]): string {
    const valid = pts.filter(([x, y]) => isFinite(x) && isFinite(y) && x >= xMin - 1e-9 && x <= xMax + 1e-9)
    if (valid.length === 0) return ''
    return valid.map(([x, y], i) =>
      `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(2)},${sy(y).toFixed(2)}`
    ).join('')
  }

  function fillPath(pts: [number, number][]): string {
    const lp = linePath(pts)
    if (!lp) return ''
    const valid = pts.filter(([x, y]) => isFinite(x) && isFinite(y))
    if (valid.length === 0) return ''
    return `${lp}L${sx(valid[valid.length-1][0]).toFixed(2)},${baseline.toFixed(2)}` +
           `L${sx(valid[0][0]).toFixed(2)},${baseline.toFixed(2)}Z`
  }

  // ── Ticks ───────────────────────────────────────────────────────────────

  const xTicks = useMemo(() => niceTicks(xMin, xMax, nTicksX), [xMin, xMax, nTicksX])
  const yTicks = useMemo(() => {
    if (logY) {
      const lo = Math.floor(Math.log10(Math.max(yMin, 1e-300)))
      const hi = Math.ceil(Math.log10(Math.max(yMax, 1e-300)))
      const ticks: number[] = []
      for (let e = lo; e <= hi; e++) ticks.push(Math.pow(10, e))
      return ticks
    }
    return niceTicks(yMin, yMax, nTicksY)
  }, [yMin, yMax, nTicksY, logY])

  return (
    <svg
      width="100%"
      viewBox={`0 0 ${vw} ${vh}`}
      style={{ overflow: 'visible', display: 'block' }}
      aria-label={title ?? 'Distribution plot'}
    >
      {/* Plot area clip */}
      <defs>
        <clipPath id={`clip-${vw}-${vh}`}>
          <rect x={PAD.left} y={PAD.top} width={pw} height={ph} />
        </clipPath>
      </defs>

      {/* Background */}
      <rect x={PAD.left} y={PAD.top} width={pw} height={ph}
        fill="var(--color-elevated)" rx="2" />

      {/* Grid */}
      {yTicks.map(y => (
        <line key={y}
          x1={PAD.left} y1={sy(y)} x2={PAD.left + pw} y2={sy(y)}
          stroke="var(--color-border)" strokeWidth="0.6" />
      ))}
      {xTicks.map(x => (
        <line key={x}
          x1={sx(x)} y1={PAD.top} x2={sx(x)} y2={PAD.top + ph}
          stroke="var(--color-border)" strokeWidth="0.6" />
      ))}

      {/* Data — clipped */}
      <g clipPath={`url(#clip-${vw}-${vh})`}>
        {series.map(s => {
          if (s.kind === 'hist') {
            return s.bins.map((b, i) => {
              const bx = sx(b.lo), bw = Math.max(0.5, sx(b.hi) - sx(b.lo))
              const by = sy(b.density), bh = baseline - by
              return (
                <rect key={i}
                  x={bx} y={by} width={bw - 0.5} height={Math.max(0, bh)}
                  fill={s.color} fillOpacity={s.fillOpacity ?? 0.45}
                />
              )
            })
          }
          if (s.kind === 'discrete') {
            return (
              <g key={s.id}>
                {s.points.filter(([x, y]) => isFinite(x) && isFinite(y) && y >= 0).map(([x, y], i) => {
                  const cx = sx(x), cy = sy(y)
                  return (
                    <g key={i}>
                      {/* Stem */}
                      <line x1={cx} y1={baseline} x2={cx} y2={cy}
                        stroke={s.color} strokeWidth="1.8" />
                      {/* Dot at top */}
                      <circle cx={cx} cy={cy} r={3}
                        fill={s.color} />
                    </g>
                  )
                })}
              </g>
            )
          }
          // Line series
          const lp = linePath(s.points)
          const fp = s.fill ? fillPath(s.points) : null
          return (
            <g key={s.id}>
              {fp && (
                <path d={fp}
                  fill={s.color} fillOpacity={s.fillOpacity ?? 0.12}
                  stroke="none" />
              )}
              {lp && (
                <path d={lp}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={s.strokeWidth ?? 1.6}
                  strokeDasharray={s.dashed ? '5 3' : undefined}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              )}
            </g>
          )
        })}

        {/* Vertical reference lines */}
        {vlines.map((vl, i) => {
          const vx = sx(vl.x)
          return (
            <g key={i}>
              <line
                x1={vx} y1={PAD.top} x2={vx} y2={PAD.top + ph}
                stroke={vl.color ?? 'var(--color-crimson)'}
                strokeWidth="1.2"
                strokeDasharray={vl.dashed !== false ? '4 3' : undefined}
                opacity="0.8"
              />
              {vl.label && (
                <text
                  x={vx + 3} y={PAD.top + 10}
                  fontSize="8" fill={vl.color ?? 'var(--color-crimson)'}
                  fontFamily="var(--font-mono, monospace)"
                >
                  {vl.label}
                </text>
              )}
            </g>
          )
        })}
      </g>

      {/* Axes */}
      <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={PAD.top + ph}
        stroke="var(--color-border-strong)" strokeWidth="1" />
      <line x1={PAD.left} y1={PAD.top + ph} x2={PAD.left + pw} y2={PAD.top + ph}
        stroke="var(--color-border-strong)" strokeWidth="1" />

      {/* X ticks + labels */}
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

      {/* Y ticks + labels */}
      {yTicks.map(y => (
        <g key={y}>
          <line x1={PAD.left - 4} y1={sy(y)} x2={PAD.left} y2={sy(y)}
            stroke="var(--color-border-strong)" strokeWidth="1" />
          <text x={PAD.left - 6} y={sy(y) + 3.5}
            textAnchor="end" fontSize="9"
            fill="var(--color-muted)"
            fontFamily="var(--font-mono, monospace)">
            {logY ? `10${superscript(Math.round(Math.log10(y)))}` : fmtTick(y)}
          </text>
        </g>
      ))}

      {/* Axis labels */}
      {xLabel && (
        <text x={PAD.left + pw / 2} y={vh - 4}
          textAnchor="middle" fontSize="9.5"
          fill="var(--color-text-secondary)"
          fontFamily="var(--font-inter, sans-serif)">
          {xLabel}
        </text>
      )}
      {yLabel && (
        <text
          transform={`translate(11, ${PAD.top + ph / 2}) rotate(-90)`}
          textAnchor="middle" fontSize="9.5"
          fill="var(--color-text-secondary)"
          fontFamily="var(--font-inter, sans-serif)">
          {yLabel}
        </text>
      )}

      {/* Title */}
      {title && (
        <text x={PAD.left + pw / 2} y={PAD.top - 8}
          textAnchor="middle" fontSize="10"
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
            <g key={s.id} transform={`translate(${PAD.left + pw - 120}, ${PAD.top + 8 + i * 14})`}>
              {s.kind === 'discrete'
                ? <circle cx={7} cy={5} r={3} fill={s.color} />
                : <line x1={0} y1={5} x2={14} y2={5}
                    stroke={s.color} strokeWidth="2"
                    strokeDasharray={s.kind === 'line' && s.dashed ? '4 2' : undefined} />
              }
              <text x={18} y={8.5} fontSize="8.5"
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

// ── Helpers ───────────────────────────────────────────────────────────────────

const SUPER: Record<string, string> = {
  '-': '⁻', '0':'⁰','1':'¹','2':'²','3':'³','4':'⁴',
  '5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹'
}

function superscript(n: number): string {
  return String(n).split('').map(c => SUPER[c] ?? c).join('')
}
