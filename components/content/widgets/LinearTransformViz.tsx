'use client'

import { useState, useMemo, useId } from 'react'

// ── Math helpers ──────────────────────────────────────────────────────────────

interface Matrix { a: number; b: number; c: number; d: number }

function det({ a, b, c, d }: Matrix): number { return a * d - b * c }
function trace({ a, d }: Matrix): number { return a + d }

/** Eigenvalues of a general real 2×2 matrix.
 *  λ = (tr ± √(tr²−4det)) / 2.
 *  Returns real parts + discriminant sign. */
function eigenvalues(m: Matrix): { λ1: number; λ2: number; imag: number } {
  const tr = trace(m), dt = det(m)
  const disc = tr * tr - 4 * dt
  if (disc >= 0) {
    const sq = Math.sqrt(disc)
    return { λ1: (tr + sq) / 2, λ2: (tr - sq) / 2, imag: 0 }
  }
  const sq = Math.sqrt(-disc)
  return { λ1: tr / 2, λ2: tr / 2, imag: sq / 2 }
}

/** Eigenvector for eigenvalue λ (when matrix is NOT a scalar multiple of I). */
function eigenvec(m: Matrix, λ: number): [number, number] {
  // From (A − λI)v = 0: first row = [a−λ, b], second row = [c, d−λ]
  const row0 = [m.a - λ, m.b] as [number, number]
  const row1 = [m.c, m.d - λ] as [number, number]
  const pick = Math.abs(row0[0]) + Math.abs(row0[1]) >= Math.abs(row1[0]) + Math.abs(row1[1])
    ? row0 : row1
  const len = Math.hypot(pick[0], pick[1])
  if (len < 1e-9) return [1, 0]
  return [-pick[1] / len, pick[0] / len]   // perpendicular to the row
}

/** Apply matrix to a vector. */
function applyM(m: Matrix, x: number, y: number): [number, number] {
  return [m.a * x + m.b * y, m.c * x + m.d * y]
}

// ── Presets ───────────────────────────────────────────────────────────────────

interface Preset { label: string; a: number; b: number; c: number; d: number }

const PRESETS: Preset[] = [
  { label: 'Identity',      a:  1,     b:  0,     c:  0,     d:  1    },
  { label: 'Rotation 45°',  a:  0.707, b: -0.707, c:  0.707, d:  0.707 },
  { label: 'Rotation 90°',  a:  0,     b: -1,     c:  1,     d:  0    },
  { label: 'H-Shear',       a:  1,     b:  1,     c:  0,     d:  1    },
  { label: 'Scale ×2',      a:  2,     b:  0,     c:  0,     d:  2    },
  { label: 'Squeeze',       a:  2,     b:  0,     c:  0,     d:  0.5  },
  { label: 'Reflect x',     a:  1,     b:  0,     c:  0,     d: -1    },
  { label: 'Projection',    a:  1,     b:  0,     c:  0,     d:  0    },
]

// ── Slider component ──────────────────────────────────────────────────────────

function Slider({
  label, value, onChange, min = -3, max = 3, step = 0.05,
}: {
  label: string; value: number; onChange: (v: number) => void
  min?: number; max?: number; step?: number
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-mono text-text-muted w-3 shrink-0">{label}</span>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-accent h-1"
      />
      <span className="text-[11px] font-mono text-text-secondary w-12 text-right shrink-0">
        {value.toFixed(2)}
      </span>
    </div>
  )
}

// ── SVG visualization ─────────────────────────────────────────────────────────

const SIZE = 300   // SVG logical units, square

function TransformPlot({ m }: { m: Matrix }) {
  const uid = useId()
  const eig = useMemo(() => eigenvalues(m), [m])
  const dt  = useMemo(() => det(m), [m])

  // Compute dynamic viewport: scale so that the largest transformed point fits
  const VIEW = useMemo(() => {
    const pts: number[] = [2.5]
    for (let x = -2; x <= 2; x++) for (let y = -2; y <= 2; y++) {
      const [tx, ty] = applyM(m, x, y)
      pts.push(Math.abs(tx), Math.abs(ty))
    }
    return Math.max(2.5, Math.max(...pts) * 1.25)
  }, [m])

  // Coordinate → SVG pixel (centre at SIZE/2, y-flipped)
  const toSVG = (x: number, y: number): [number, number] => [
    SIZE / 2 + (x / VIEW) * (SIZE / 2 - 10),
    SIZE / 2 - (y / VIEW) * (SIZE / 2 - 10),
  ]

  const pt = (x: number, y: number) => toSVG(x, y).map(v => v.toFixed(2)).join(',')

  // Grid lines: integer values from -3 to 3
  const gridRange = [-3, -2, -1, 1, 2, 3]

  // Unit circle (original: dashed; transformed: solid ellipse)
  const N_CIRC = 120
  const circleOrigPts = useMemo(() =>
    Array.from({ length: N_CIRC + 1 }, (_, i) => {
      const t = (i / N_CIRC) * 2 * Math.PI
      return pt(Math.cos(t), Math.sin(t))
    }).join(' ')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  , [VIEW])

  const circleXformPts = useMemo(() =>
    Array.from({ length: N_CIRC + 1 }, (_, i) => {
      const t = (i / N_CIRC) * 2 * Math.PI
      const [tx, ty] = applyM(m, Math.cos(t), Math.sin(t))
      return pt(tx, ty)
    }).join(' ')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  , [m, VIEW])

  // Unit square corners → parallelogram
  const squareCorners: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]]
  const xformCorners = squareCorners.map(([x, y]) => applyM(m, x, y))
  const squarePts    = squareCorners.map(([x, y]) => pt(x, y)).join(' ')
  const parallelPts  = xformCorners.map(([x, y]) => pt(x, y)).join(' ')

  // Basis vectors e1=[1,0], e2=[0,1]
  const Te1 = applyM(m, 1, 0)
  const Te2 = applyM(m, 0, 1)

  // Eigenvectors (only draw if real eigenvalues)
  const eigvecs = useMemo(() => {
    if (eig.imag !== 0) return null
    const v1 = eigenvec(m, eig.λ1)
    const v2 = eigenvec(m, eig.λ2)
    return { v1, v2, λ1: eig.λ1, λ2: eig.λ2 }
  }, [m, eig])

  const sw = VIEW / 80   // adaptive stroke width
  const fs = VIEW / 8    // adaptive font size

  return (
    <svg
      width="100%" viewBox={`0 0 ${SIZE} ${SIZE}`}
      style={{ display: 'block', maxWidth: SIZE }}
      aria-label="Linear transformation visualizer"
    >
      <defs>
        {(['accent', 'e1', 'e2'] as const).map(k => {
          const color = k === 'accent' ? 'var(--color-accent)'
            : k === 'e1' ? '#E15759' : '#59A14F'
          return (
            <marker key={k} id={`${uid}-${k}`}
              markerWidth="6" markerHeight="6" refX="5" refY="3"
              orient="auto" markerUnits="strokeWidth">
              <path d="M0,0 L0,6 L6,3 z" fill={color} />
            </marker>
          )
        })}
      </defs>

      {/* ── Original grid (muted) ── */}
      {gridRange.map(i => (
        <g key={i} stroke="var(--color-border)" strokeWidth={sw * 0.5}>
          <line x1={toSVG(i, -VIEW)[0].toFixed(1)} y1={toSVG(i, -VIEW)[1].toFixed(1)}
                x2={toSVG(i,  VIEW)[0].toFixed(1)} y2={toSVG(i,  VIEW)[1].toFixed(1)} />
          <line x1={toSVG(-VIEW, i)[0].toFixed(1)} y1={toSVG(-VIEW, i)[1].toFixed(1)}
                x2={toSVG( VIEW, i)[0].toFixed(1)} y2={toSVG( VIEW, i)[1].toFixed(1)} />
        </g>
      ))}

      {/* ── Axes ── */}
      <line
        x1={toSVG(-VIEW, 0)[0]} y1={toSVG(-VIEW, 0)[1]}
        x2={toSVG( VIEW, 0)[0]} y2={toSVG( VIEW, 0)[1]}
        stroke="var(--color-border-strong)" strokeWidth={sw} />
      <line
        x1={toSVG(0, -VIEW)[0]} y1={toSVG(0, -VIEW)[1]}
        x2={toSVG(0,  VIEW)[0]} y2={toSVG(0,  VIEW)[1]}
        stroke="var(--color-border-strong)" strokeWidth={sw} />

      {/* ── Transformed grid lines ── */}
      {gridRange.map(i => (
        <g key={i} stroke="var(--color-accent)" strokeOpacity="0.15" strokeWidth={sw * 0.4}>
          {/* columns: x=i, y varies */}
          {(() => {
            const [x1, y1] = toSVG(...applyM(m, i, -VIEW))
            const [x2, y2] = toSVG(...applyM(m, i,  VIEW))
            return <line x1={x1} y1={y1} x2={x2} y2={y2} />
          })()}
          {/* rows: y=i, x varies */}
          {(() => {
            const [x1, y1] = toSVG(...applyM(m, -VIEW, i))
            const [x2, y2] = toSVG(...applyM(m,  VIEW, i))
            return <line x1={x1} y1={y1} x2={x2} y2={y2} />
          })()}
        </g>
      ))}

      {/* ── Original unit circle (dashed) ── */}
      <polyline points={circleOrigPts}
        fill="none" stroke="var(--color-border-strong)"
        strokeWidth={sw * 0.8} strokeDasharray={`${sw * 3} ${sw * 2}`} />

      {/* ── Transformed circle → ellipse ── */}
      <polyline points={circleXformPts}
        fill="var(--color-accent)" fillOpacity="0.06"
        stroke="var(--color-accent)" strokeWidth={sw * 1.2} />

      {/* ── Original unit square (dashed) ── */}
      <polygon points={squarePts}
        fill="none" stroke="var(--color-border-strong)"
        strokeWidth={sw * 0.7} strokeDasharray={`${sw * 2} ${sw * 2}`} />

      {/* ── Transformed parallelogram ── */}
      <polygon points={parallelPts}
        fill="var(--color-accent)" fillOpacity="0.08"
        stroke="var(--color-accent)" strokeWidth={sw * 0.8} strokeOpacity="0.6" />

      {/* ── e1 = [1,0] → T(e1) ── */}
      {(() => {
        const [ox, oy] = toSVG(0, 0)
        const [ex, ey] = toSVG(...Te1)
        return (
          <line x1={ox} y1={oy} x2={ex} y2={ey}
            stroke="#E15759" strokeWidth={sw * 2}
            markerEnd={`url(#${uid}-e1)`} />
        )
      })()}

      {/* ── e2 = [0,1] → T(e2) ── */}
      {(() => {
        const [ox, oy] = toSVG(0, 0)
        const [ex, ey] = toSVG(...Te2)
        return (
          <line x1={ox} y1={oy} x2={ex} y2={ey}
            stroke="#59A14F" strokeWidth={sw * 2}
            markerEnd={`url(#${uid}-e2)`} />
        )
      })()}

      {/* ── Real eigenvectors ── */}
      {eigvecs && (() => {
        const scale = VIEW * 0.45
        const [o1x, o1y] = toSVG(0, 0)
        const [v1x, v1y] = toSVG(eigvecs.v1[0] * scale, eigvecs.v1[1] * scale)
        const [v2x, v2y] = toSVG(eigvecs.v2[0] * scale, eigvecs.v2[1] * scale)
        return (
          <g strokeDasharray={`${sw * 3} ${sw * 2}`} strokeWidth={sw * 1.2}>
            <line x1={o1x} y1={o1y} x2={v1x} y2={v1y}
              stroke="var(--color-accent)" markerEnd={`url(#${uid}-accent)`} />
            <line x1={o1x} y1={o1y} x2={v2x} y2={v2y}
              stroke="var(--color-accent)" opacity="0.5" />
          </g>
        )
      })()}

      {/* ── Column vector labels ── */}
      {(() => {
        const [lx1, ly1] = toSVG(Te1[0] * 1.12, Te1[1] * 1.12)
        const [lx2, ly2] = toSVG(Te2[0] * 1.12, Te2[1] * 1.12)
        return (
          <>
            <text x={lx1} y={ly1} fontSize={fs} fill="#E15759"
              textAnchor="middle" fontFamily="var(--font-mono, monospace)">
              Te₁
            </text>
            <text x={lx2} y={ly2} fontSize={fs} fill="#59A14F"
              textAnchor="middle" fontFamily="var(--font-mono, monospace)">
              Te₂
            </text>
          </>
        )
      })()}

      {/* ── det annotation at origin ── */}
      <text
        x={toSVG(0, 0)[0] + 4} y={toSVG(0, 0)[1] - 5}
        fontSize={fs * 0.75}
        fill="var(--color-muted)"
        fontFamily="var(--font-mono, monospace)">
        {dt < 0 ? 'orientation flipped' : dt === 0 ? 'rank-deficient' : ''}
      </text>
    </svg>
  )
}

// ── Main Component ────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return Math.abs(n) < 1e4 && (Math.abs(n) >= 0.01 || n === 0)
    ? n.toFixed(3).replace(/\.?0+$/, '')
    : n.toExponential(2)
}

function fmtEig(λ: number, imag: number): string {
  if (imag === 0) return fmt(λ)
  return `${fmt(λ)} ± ${fmt(imag)}i`
}

export function LinearTransformViz() {
  const [a, setA] = useState(1)
  const [b, setB] = useState(0)
  const [c, setC] = useState(0)
  const [d, setD] = useState(1)

  const m: Matrix = { a, b, c, d }
  const dt   = det(m)
  const tr   = trace(m)
  const eig  = eigenvalues(m)

  const applyPreset = (p: Preset) => {
    setA(p.a); setB(p.b); setC(p.c); setD(p.d)
  }

  return (
    <div className="flex flex-col sm:flex-row h-full min-h-0">

      {/* ── Controls ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 p-5 sm:w-60 shrink-0 border-b sm:border-b-0 sm:border-r border-border bg-elevated overflow-y-auto">

        {/* Matrix display */}
        <div>
          <p className="label-xs mb-2">Matrix A</p>
          <div className="font-mono text-xs text-text-secondary bg-surface border border-border rounded px-3 py-2 leading-relaxed select-none text-center">
            <div>⎡ {a.toFixed(2)}  {b.toFixed(2)} ⎤</div>
            <div>⎣ {c.toFixed(2)}  {d.toFixed(2)} ⎦</div>
          </div>
        </div>

        {/* Sliders */}
        <div className="space-y-2.5">
          <p className="label-xs">Matrix entries</p>
          <Slider label="a" value={a} onChange={setA} />
          <Slider label="b" value={b} onChange={setB} />
          <Slider label="c" value={c} onChange={setC} />
          <Slider label="d" value={d} onChange={setD} />
        </div>

        {/* Presets */}
        <div>
          <p className="label-xs mb-2">Presets</p>
          <div className="grid grid-cols-2 gap-1">
            {PRESETS.map(p => (
              <button
                key={p.label}
                onClick={() => applyPreset(p)}
                className="text-[10px] px-2 py-1 rounded border border-border text-text-muted hover:bg-surface hover:text-text-secondary transition-colors text-left"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Invariants */}
        <div className="rounded border border-border bg-surface px-3 py-2.5 text-xs space-y-1.5">
          <p className="label-xs mb-2">Invariants</p>
          {([
            ['det(A)',    fmt(dt),  dt > 0 ? 'area preserved' : dt < 0 ? 'orientation flipped' : 'rank-deficient'],
            ['tr(A)',     fmt(tr),  '= λ₁ + λ₂'],
          ] as [string, string, string][]).map(([k, v, note]) => (
            <div key={k}>
              <div className="flex justify-between">
                <span className="text-text-muted font-mono">{k}</span>
                <span className="font-mono text-text-secondary">{v}</span>
              </div>
              <span className="text-[10px] text-text-muted">{note}</span>
            </div>
          ))}

          <div className="border-t border-border pt-1.5">
            <div className="flex justify-between">
              <span className="text-text-muted font-mono">λ₁</span>
              <span className="font-mono text-text-secondary">{fmtEig(eig.λ1, eig.imag)}</span>
            </div>
            {eig.imag === 0 && (
              <div className="flex justify-between mt-0.5">
                <span className="text-text-muted font-mono">λ₂</span>
                <span className="font-mono text-text-secondary">{fmt(eig.λ2)}</span>
              </div>
            )}
            {eig.imag !== 0 && (
              <p className="text-[10px] text-text-muted mt-0.5">complex conjugate pair — pure rotation component</p>
            )}
          </div>

          <div className="border-t border-border pt-1.5 text-[10px] text-text-muted space-y-0.5">
            <div>|det| = {Math.abs(dt) < 1e-6 ? '0' : Math.abs(dt).toPrecision(3)} — area scaling factor</div>
            <div>{Math.abs(dt) < 1e-9 ? 'collapses to a line' : dt < 0 ? 'reverses orientation' : 'preserves orientation'}</div>
          </div>
        </div>
      </div>

      {/* ── Visualization ────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4 bg-surface min-h-0">
        <TransformPlot m={m} />
        <div className="text-[11px] text-text-muted text-center max-w-sm space-y-1 leading-relaxed">
          <p>
            <span style={{ color: '#E15759' }}>Red</span> = image of e₁ &nbsp;
            <span style={{ color: '#59A14F' }}>Green</span> = image of e₂ &nbsp;
            <span style={{ color: 'var(--color-accent)' }}>Blue</span> = image of unit circle
          </p>
          <p>Dashed → original; solid → transformed. Grid lines show the full linear map.</p>
        </div>
      </div>

    </div>
  )
}
