'use client'

import { useState, useMemo, useId } from 'react'

// ── Math ──────────────────────────────────────────────────────────────────────
// All computations for a 2×2 real symmetric matrix A = [[a, b], [b, c]].
// Characteristic polynomial: λ² - tr(A)λ + det(A) = 0
// Discriminant:              ((a-c)/2)² + b²
// Eigenvalues:               (tr ± √disc) / 2
// Eigenvectors (b ≠ 0):      [b, λᵢ − a]  (normalised)

function normalize(v: [number, number]): [number, number] {
  const len = Math.hypot(v[0], v[1])
  return len < 1e-10 ? [1, 0] : [v[0] / len, v[1] / len]
}

interface EigenResult {
  λ1: number; λ2: number
  v1: [number, number]; v2: [number, number]
  trace: number; det: number
}

function computeEigen(a: number, b: number, c: number): EigenResult {
  const trace = a + c
  const det   = a * c - b * b
  const disc  = Math.sqrt(Math.max(0, ((a - c) / 2) ** 2 + b * b))
  const λ1    = trace / 2 + disc   // larger
  const λ2    = trace / 2 - disc   // smaller

  let v1: [number, number], v2: [number, number]
  if (Math.abs(b) > 1e-9) {
    v1 = normalize([b, λ1 - a])
    v2 = normalize([b, λ2 - a])
  } else if (Math.abs(a - c) > 1e-9) {
    // b = 0 but a ≠ c — diagonal, eigvecs are standard basis
    v1 = a >= c ? [1, 0] : [0, 1]
    v2 = a >= c ? [0, 1] : [1, 0]
  } else {
    // Scalar multiple of I — all directions are eigenvectors
    v1 = [1, 0]; v2 = [0, 1]
  }

  return { λ1, λ2, v1, v2, trace, det }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function EigendecompositionExplorer() {
  const uid = useId()
  const [a, setA] = useState(2)
  const [b, setB] = useState(1)
  const [c, setC] = useState(1)

  const { λ1, λ2, v1, v2, trace, det } = useMemo(
    () => computeEigen(a, b, c),
    [a, b, c]
  )

  // ── Geometry ──────────────────────────────────────────────────────────────

  // Image of the unit circle: A·[cos t, sin t] = [a·cos+b·sin, b·cos+c·sin]
  const ellipsePoints = useMemo(() => {
    return Array.from({ length: 121 }, (_, i) => {
      const t = (i / 120) * 2 * Math.PI
      const x = a * Math.cos(t) + b * Math.sin(t)
      const y = b * Math.cos(t) + c * Math.sin(t)
      return [x, y] as [number, number]
    })
  }, [a, b, c])

  // Dynamic viewport: always fits the ellipse + eigenvectors with 25% margin
  const VIEW = useMemo(() => {
    const ellipseMax = ellipsePoints.reduce(
      (m, [x, y]) => Math.max(m, Math.abs(x), Math.abs(y)), 0
    )
    const vecMax = Math.max(Math.abs(λ1), Math.abs(λ2))
    return Math.max(2.5, Math.max(ellipseMax, vecMax) * 1.3)
  }, [ellipsePoints, λ1, λ2])

  // SVG uses y-downward; math uses y-upward → negate y
  const toSVGPts = (pts: [number, number][]) =>
    pts.map(([x, y]) => `${x.toFixed(3)},${(-y).toFixed(3)}`).join(' ')

  const unitCirclePts = useMemo(() =>
    Array.from({ length: 81 }, (_, i) => {
      const t = (i / 80) * 2 * Math.PI
      return [Math.cos(t), -Math.sin(t)] as [number, number]  // -y = SVG y
    }).map(([x, y]) => `${x.toFixed(3)},${y.toFixed(3)}`).join(' ')
  , [])

  // Grid lines (integer values within viewport)
  const gridLines = Array.from(
    { length: Math.floor(VIEW) * 2 + 1 },
    (_, i) => i - Math.floor(VIEW)
  ).filter(i => i !== 0)

  const sw = VIEW / 60   // adaptive stroke width
  const fs = VIEW / 8    // adaptive font size

  // ── Render ────────────────────────────────────────────────────────────────

  const fmt3 = (n: number) => n.toFixed(3)

  return (
    <div className="flex flex-col sm:flex-row h-full min-h-0">

      {/* ── Left: controls ── */}
      <div className="flex flex-col gap-4 p-5 sm:w-56 shrink-0 border-b sm:border-b-0 sm:border-r border-border bg-elevated overflow-y-auto">

        {/* Matrix display */}
        <div>
          <p className="label-xs mb-2">A (symmetric 2×2)</p>
          <div className="font-mono text-xs text-text-secondary bg-surface border border-border rounded px-3 py-2 leading-relaxed select-none">
            ⎡ {pad(a)}  {pad(b)} ⎤<br />
            ⎣ {pad(b)}  {pad(c)} ⎦
          </div>
        </div>

        {/* Sliders */}
        <div className="space-y-2.5">
          <p className="label-xs">Matrix entries</p>
          <Slider label="a" value={a} onChange={setA} min={-3} max={3} />
          <Slider label="b" value={b} onChange={setB} min={-2} max={2} />
          <Slider label="c" value={c} onChange={setC} min={-3} max={3} />
        </div>

        {/* Eigenvalue readout */}
        <div className="space-y-1.5">
          <p className="label-xs">Spectral decomposition</p>
          <EigenRow label="λ₁" value={λ1} color="var(--color-accent)" vec={v1} />
          <EigenRow label="λ₂" value={λ2} color="#B0392B"            vec={v2} />
        </div>

        {/* Scalar invariants — verify tr = λ₁+λ₂, det = λ₁λ₂ */}
        <div className="rounded border border-border bg-surface px-3 py-2 text-xs space-y-1">
          <p className="label-xs mb-1.5">Invariants</p>
          {([
            ['tr(A)',  fmt3(trace),       fmt3(λ1 + λ2)],
            ['det(A)', fmt3(det),         fmt3(λ1 * λ2)],
          ] as [string, string, string][]).map(([k, v, check]) => (
            <div key={k} className="flex items-center justify-between gap-1">
              <span className="text-text-muted font-mono">{k}</span>
              <span className="text-text-secondary font-mono">{v}</span>
              <span className="text-text-muted text-[10px]">= {check} ✓</span>
            </div>
          ))}
          <div className="flex justify-between pt-0.5 border-t border-border mt-1">
            <span className="text-text-muted font-mono">pos-def?</span>
            <span className={`font-mono font-medium ${λ2 > 1e-9 ? 'text-forest' : λ2 < -1e-9 ? 'text-crimson' : 'text-text-muted'}`}>
              {λ2 > 1e-9 ? 'yes' : λ2 < -1e-9 ? 'no' : 'semidefinite'}
            </span>
          </div>
        </div>
      </div>

      {/* ── Right: visualization ── */}
      <div className="flex-1 flex flex-col items-center justify-center gap-3 p-4 bg-surface min-h-0">
        <svg
          width="100%"
          style={{ maxWidth: 320, aspectRatio: '1' }}
          viewBox={`${-VIEW} ${-VIEW} ${2 * VIEW} ${2 * VIEW}`}
          aria-label="Eigendecomposition: unit circle and its image under A"
        >
          <defs>
            {(['accent', 'crimson', 'muted'] as const).map(name => {
              const fill = name === 'accent' ? 'var(--color-accent)'
                : name === 'crimson' ? '#B0392B'
                : 'var(--color-muted)'
              return (
                <marker
                  key={name}
                  id={`${uid}-${name}`}
                  markerWidth="6" markerHeight="6"
                  refX="5" refY="3"
                  orient="auto"
                  markerUnits="strokeWidth"
                >
                  <path d="M0,0 L0,6 L6,3 z" fill={fill} />
                </marker>
              )
            })}
          </defs>

          {/* Grid */}
          {gridLines.map(i => (
            <g key={i} stroke="var(--color-border)" strokeWidth={sw * 0.5}>
              <line x1={i} y1={-VIEW} x2={i} y2={VIEW} />
              <line x1={-VIEW} y1={i} x2={VIEW} y2={i} />
            </g>
          ))}

          {/* Axes */}
          <line x1={-VIEW} y1={0} x2={VIEW} y2={0} stroke="var(--color-border-strong)" strokeWidth={sw} />
          <line x1={0} y1={-VIEW} x2={0} y2={VIEW} stroke="var(--color-border-strong)" strokeWidth={sw} />

          {/* Unit circle (dashed) */}
          <polyline
            points={unitCirclePts}
            fill="none"
            stroke="var(--color-muted)"
            strokeWidth={sw}
            strokeDasharray={`${VIEW / 14} ${VIEW / 18}`}
            opacity="0.5"
          />

          {/* Image ellipse A(unit circle) */}
          <polyline
            points={toSVGPts(ellipsePoints)}
            fill="var(--color-accent-light)"
            fillOpacity="0.3"
            stroke="var(--color-accent)"
            strokeWidth={sw * 1.4}
            opacity="0.8"
          />

          {/* Eigenvectors λᵢqᵢ */}
          <SVGArrow
            x1={0} y1={0} x2={λ1 * v1[0]} y2={λ1 * v1[1]}
            color="var(--color-accent)" markerId={`${uid}-accent`} sw={sw * 1.6}
          />
          <SVGArrow
            x1={0} y1={0} x2={λ2 * v2[0]} y2={λ2 * v2[1]}
            color="#B0392B" markerId={`${uid}-crimson`} sw={sw * 1.6}
          />

          {/* Vector labels */}
          <VecLabel
            wx={λ1 * v1[0]} wy={λ1 * v1[1]}
            label="λ₁q₁" color="var(--color-accent)"
            fs={fs} VIEW={VIEW}
          />
          <VecLabel
            wx={λ2 * v2[0]} wy={λ2 * v2[1]}
            label="λ₂q₂" color="#B0392B"
            fs={fs} VIEW={VIEW}
          />
        </svg>

        <p className="text-xs text-text-muted text-center max-w-xs leading-relaxed">
          Dashed circle = unit circle &nbsp;·&nbsp; Shaded ellipse = A(unit circle) &nbsp;·&nbsp; Arrows = λᵢqᵢ
        </p>
      </div>
    </div>
  )
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

function SVGArrow({
  x1, y1, x2, y2, color, markerId, sw,
}: {
  x1: number; y1: number; x2: number; y2: number
  color: string; markerId: string; sw: number
}) {
  if (Math.hypot(x2 - x1, y2 - y1) < 0.05) return null
  // Shorten line slightly so arrowhead doesn't overlap end-point
  const scale = 0.88
  const mx = x1 + (x2 - x1) * scale
  const my = y1 + (y2 - y1) * scale
  return (
    <line
      x1={x1} y1={-y1} x2={mx} y2={-my}
      stroke={color} strokeWidth={sw}
      markerEnd={`url(#${markerId})`}
    />
  )
}

function VecLabel({
  wx, wy, label, color, fs, VIEW,
}: {
  wx: number; wy: number; label: string
  color: string; fs: number; VIEW: number
}) {
  const offset = VIEW * 0.06
  return (
    <text
      x={wx + offset}
      y={-(wy - offset)}
      fill={color}
      fontSize={fs}
      fontFamily="monospace"
      opacity="0.9"
    >
      {label}
    </text>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function pad(n: number): string {
  const s = n.toFixed(1)
  return n >= 0 ? ` ${s}` : s
}

function Slider({
  label, value, onChange, min, max,
}: {
  label: string; value: number; onChange: (v: number) => void; min: number; max: number
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-3 shrink-0 font-mono text-xs italic text-text-muted">{label}</span>
      <input
        type="range" min={min} max={max} step={0.1}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="flex-1 accent-accent h-1 cursor-pointer"
      />
      <span className="w-9 shrink-0 text-right font-mono text-xs text-text-secondary">
        {value.toFixed(1)}
      </span>
    </div>
  )
}

function EigenRow({
  label, value, color, vec,
}: {
  label: string; value: number; color: string; vec: [number, number]
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="shrink-0 w-5 font-mono text-xs mt-0.5 font-medium" style={{ color }}>
        {label}
      </span>
      <div>
        <div className="font-mono text-xs text-text-secondary">{value.toFixed(4)}</div>
        <div className="font-mono text-[10px] text-text-muted leading-tight">
          q = [{vec[0].toFixed(3)}, {vec[1].toFixed(3)}]
        </div>
      </div>
    </div>
  )
}
