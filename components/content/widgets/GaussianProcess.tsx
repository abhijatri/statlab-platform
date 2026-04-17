'use client'

import { useState, useCallback, useRef } from 'react'

// ── Numerical utilities ───────────────────────────────────────────────────────

function chol(A: number[][]): number[][] {
  const n = A.length
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j]
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k]
      L[i][j] = j === i ? Math.sqrt(Math.max(s, 1e-12)) : s / L[j][j]
    }
  }
  return L
}

function fwdSolve(L: number[][], b: number[]): number[] {
  const n = b.length
  const x = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    let s = b[i]
    for (let k = 0; k < i; k++) s -= L[i][k] * x[k]
    x[i] = s / L[i][i]
  }
  return x
}

function bwdSolve(L: number[][], b: number[]): number[] {
  const n = b.length
  const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i]
    for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k]
    x[i] = s / L[i][i]
  }
  return x
}

function cholSolve(L: number[][], b: number[]): number[] {
  return bwdSolve(L, fwdSolve(L, b))
}

function randNormal(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// ── Kernels ───────────────────────────────────────────────────────────────────

type KernelId = 'rbf' | 'matern32' | 'periodic' | 'linear'

interface KernelParams { l: number; sf: number; period: number }

function makeKernel(id: KernelId, p: KernelParams): (x1: number, x2: number) => number {
  const { l, sf, period } = p
  switch (id) {
    case 'rbf':
      return (x1, x2) => sf * sf * Math.exp(-0.5 * ((x1 - x2) / l) ** 2)
    case 'matern32': {
      const c = Math.sqrt(3) / l
      return (x1, x2) => {
        const r = Math.abs(x1 - x2)
        return sf * sf * (1 + c * r) * Math.exp(-c * r)
      }
    }
    case 'periodic':
      return (x1, x2) => {
        const d = Math.abs(x1 - x2)
        return sf * sf * Math.exp(-2 * Math.sin(Math.PI * d / period) ** 2 / (l * l))
      }
    case 'linear':
      return (x1, x2) => sf * sf * x1 * x2 / (l * l)
  }
}

// ── GP posterior ──────────────────────────────────────────────────────────────

interface GPResult { mean: number[]; std: number[] }

function gpPosterior(
  xTest: number[],
  xObs: number[],
  yObs: number[],
  kern: (a: number, b: number) => number,
  sn: number,
): GPResult {
  const n = xObs.length
  const m = xTest.length

  if (n === 0) {
    // prior
    const priorStd = xTest.map(x => Math.sqrt(kern(x, x)))
    return { mean: new Array(m).fill(0), std: priorStd }
  }

  // K_XX + σ²I
  const Kxx: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => kern(xObs[i], xObs[j]) + (i === j ? sn * sn : 0))
  )
  const L = chol(Kxx)
  const alpha = cholSolve(L, yObs)

  // K_*X  (m × n)
  const KsX: number[][] = Array.from({ length: m }, (_, i) =>
    Array.from({ length: n }, (_, j) => kern(xTest[i], xObs[j]))
  )

  const mean = KsX.map(row => row.reduce((s, k, j) => s + k * alpha[j], 0))

  const std = xTest.map((xt, i) => {
    const kss = kern(xt, xt)
    const v = fwdSolve(L, KsX[i])
    const variance = Math.max(kss - v.reduce((s, x) => s + x * x, 0), 0)
    return Math.sqrt(variance)
  })

  return { mean, std }
}

// ── Prior samples ─────────────────────────────────────────────────────────────

function samplePrior(xTest: number[], kern: (a: number, b: number) => number): number[] {
  const n = xTest.length
  const K: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => kern(xTest[i], xTest[j]) + (i === j ? 1e-8 : 0))
  )
  const L = chol(K)
  const z = Array.from({ length: n }, () => randNormal())
  return L.map(row => row.reduce((s, v, j) => s + v * z[j], 0))
}

// ── Layout constants ──────────────────────────────────────────────────────────

const VW = 520, VH = 210
const PAD = { top: 26, right: 22, bottom: 40, left: 54 }
const PW = VW - PAD.left - PAD.right
const PH = VH - PAD.top - PAD.bottom

const X_MIN = -3, X_MAX = 3
const Y_MIN = -3, Y_MAX = 3
const N_TEST = 120

const xTest = Array.from({ length: N_TEST }, (_, i) => X_MIN + (X_MAX - X_MIN) * i / (N_TEST - 1))

function sx(x: number) { return PAD.left + ((x - X_MIN) / (X_MAX - X_MIN)) * PW }
function sy(y: number) { return PAD.top + ((Y_MAX - y) / (Y_MAX - Y_MIN)) * PH }

function polyline(xs: number[], ys: number[]): string {
  return xs.map((x, i) => `${sx(x).toFixed(1)},${sy(ys[i]).toFixed(1)}`).join(' ')
}

function bandPath(xs: number[], lo: number[], hi: number[]): string {
  const top = xs.map((x, i) => `${sx(x).toFixed(1)},${sy(hi[i]).toFixed(1)}`).join(' L ')
  const bot = [...xs].reverse().map((x, i) => `${sx(x).toFixed(1)},${sy(lo[xs.length - 1 - i]).toFixed(1)}`).join(' L ')
  return `M ${top} L ${bot} Z`
}

// ── Kernel metadata ───────────────────────────────────────────────────────────

const KERNELS: { id: KernelId; label: string; color: string }[] = [
  { id: 'rbf',      label: 'RBF / Squared-Exp', color: '#4E79A7' },
  { id: 'matern32', label: 'Matérn 3/2',        color: '#59A14F' },
  { id: 'periodic', label: 'Periodic',           color: '#E15759' },
  { id: 'linear',   label: 'Linear',             color: '#9467BD' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function GaussianProcess() {
  const [kernelId, setKernelId] = useState<KernelId>('rbf')
  const [l, setL]             = useState(1.0)
  const [sf, setSf]           = useState(1.0)
  const [sn, setSn]           = useState(0.1)
  const [period, setPeriod]   = useState(2.0)
  const [obs, setObs]         = useState<{ x: number; y: number }[]>([])
  const [priorSamples, setPriorSamples] = useState<number[][]>([])
  const [tab, setTab]         = useState<'posterior' | 'prior'>('posterior')
  const svgRef = useRef<SVGSVGElement>(null)

  const kern = makeKernel(kernelId, { l, sf, period })
  const xObs = obs.map(o => o.x)
  const yObs = obs.map(o => o.y)
  const { mean, std } = gpPosterior(xTest, xObs, yObs, kern, sn)

  const lo = mean.map((m, i) => m - 2 * std[i])
  const hi = mean.map((m, i) => m + 2 * std[i])

  const handleSvgClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (tab !== 'posterior') return
    const rect = svgRef.current!.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const x = X_MIN + ((px - PAD.left) / PW) * (X_MAX - X_MIN)
    const y = Y_MAX - ((py - PAD.top) / PH) * (Y_MAX - Y_MIN)
    if (x < X_MIN || x > X_MAX || y < Y_MIN || y > Y_MAX) return
    setObs(prev => [...prev, { x, y }])
  }, [tab])

  const drawPriorSamples = useCallback(() => {
    const samples = Array.from({ length: 5 }, () => samplePrior(xTest, kern))
    setPriorSamples(samples)
  }, [kern])

  const COLORS = ['#4E79A7', '#59A14F', '#E15759', '#9467BD', '#F28E2B']

  const kernMeta = KERNELS.find(k => k.id === kernelId)!

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, userSelect: 'none' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        {(['posterior', 'prior'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '4px 14px', borderRadius: 4, border: 'none', cursor: 'pointer',
              background: tab === t ? kernMeta.color : '#e8e8e8',
              color: tab === t ? '#fff' : '#333', fontWeight: tab === t ? 600 : 400, fontSize: 12,
            }}
          >
            {t === 'posterior' ? 'Posterior' : 'Prior Samples'}
          </button>
        ))}
      </div>

      {/* SVG plot */}
      <svg
        ref={svgRef}
        width={VW} height={VH}
        viewBox={`0 0 ${VW} ${VH}`}
        style={{ display: 'block', cursor: tab === 'posterior' ? 'crosshair' : 'default',
          background: '#fafafa', borderRadius: 6, border: '1px solid #e0e0e0' }}
        onClick={handleSvgClick}
      >
        <defs>
          <clipPath id="gp-clip">
            <rect x={PAD.left} y={PAD.top} width={PW} height={PH} />
          </clipPath>
        </defs>

        {/* Grid */}
        {[-2, -1, 0, 1, 2].map(v => (
          <g key={v}>
            <line x1={PAD.left} x2={PAD.left + PW} y1={sy(v)} y2={sy(v)}
              stroke="#e0e0e0" strokeWidth={v === 0 ? 1.5 : 0.8} />
            <line x1={sx(v)} x2={sx(v)} y1={PAD.top} y2={PAD.top + PH}
              stroke="#e0e0e0" strokeWidth={v === 0 ? 1.5 : 0.8} />
          </g>
        ))}

        {/* Axis labels */}
        {[-2, 0, 2].map(v => (
          <text key={v} x={PAD.left - 6} y={sy(v) + 4} textAnchor="end"
            fill="#666" fontSize={10}>{v}</text>
        ))}
        {[-2, -1, 0, 1, 2].map(v => (
          <text key={v} x={sx(v)} y={PAD.top + PH + 16} textAnchor="middle"
            fill="#666" fontSize={10}>{v}</text>
        ))}
        <text x={PAD.left - 34} y={PAD.top + PH / 2} textAnchor="middle"
          fill="#666" fontSize={10} transform={`rotate(-90,${PAD.left - 34},${PAD.top + PH / 2})`}>f(x)</text>
        <text x={PAD.left + PW / 2} y={VH - 4} textAnchor="middle" fill="#666" fontSize={10}>x</text>

        <g clipPath="url(#gp-clip)">
          {tab === 'posterior' && (
            <>
              {/* Confidence band */}
              <path d={bandPath(xTest, lo, hi)} fill={kernMeta.color} opacity={0.15} />
              {/* Mean */}
              <polyline points={polyline(xTest, mean)}
                fill="none" stroke={kernMeta.color} strokeWidth={2} />
              {/* ±2σ boundaries */}
              <polyline points={polyline(xTest, lo)}
                fill="none" stroke={kernMeta.color} strokeWidth={1} strokeDasharray="4,3" opacity={0.6} />
              <polyline points={polyline(xTest, hi)}
                fill="none" stroke={kernMeta.color} strokeWidth={1} strokeDasharray="4,3" opacity={0.6} />
              {/* Observations */}
              {obs.map((o, i) => (
                <circle key={i} cx={sx(o.x)} cy={sy(o.y)} r={4}
                  fill="#fff" stroke={kernMeta.color} strokeWidth={2} />
              ))}
            </>
          )}
          {tab === 'prior' && priorSamples.map((s, i) => (
            <polyline key={i} points={polyline(xTest, s)}
              fill="none" stroke={COLORS[i % COLORS.length]} strokeWidth={1.5} opacity={0.85} />
          ))}
        </g>

        {/* Border */}
        <rect x={PAD.left} y={PAD.top} width={PW} height={PH}
          fill="none" stroke="#ccc" strokeWidth={1} />

        {tab === 'posterior' && obs.length === 0 && (
          <text x={PAD.left + PW / 2} y={PAD.top + PH / 2} textAnchor="middle"
            fill="#aaa" fontSize={12}>Click to add observations</text>
        )}
      </svg>

      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 14, alignItems: 'flex-start' }}>
        {/* Kernel selector */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 6, color: '#444' }}>Kernel</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {KERNELS.map(k => (
              <button key={k.id} onClick={() => setKernelId(k.id)} style={{
                padding: '3px 10px', borderRadius: 4, border: `1.5px solid ${k.color}`,
                background: kernelId === k.id ? k.color : 'transparent',
                color: kernelId === k.id ? '#fff' : k.color,
                cursor: 'pointer', fontSize: 12, textAlign: 'left',
              }}>{k.label}</button>
            ))}
          </div>
        </div>

        {/* Sliders */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 200 }}>
          <SliderRow label={`ℓ (length scale) = ${l.toFixed(2)}`}
            min={0.1} max={3} step={0.05} value={l} onChange={setL} color={kernMeta.color} />
          <SliderRow label={`σ_f (signal std) = ${sf.toFixed(2)}`}
            min={0.1} max={3} step={0.05} value={sf} onChange={setSf} color={kernMeta.color} />
          <SliderRow label={`σ_n (noise std) = ${sn.toFixed(3)}`}
            min={0.001} max={1} step={0.001} value={sn} onChange={setSn} color={kernMeta.color} />
          {kernelId === 'periodic' && (
            <SliderRow label={`p (period) = ${period.toFixed(2)}`}
              min={0.5} max={5} step={0.1} value={period} onChange={setPeriod} color={kernMeta.color} />
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {tab === 'prior' && (
            <button onClick={drawPriorSamples} style={{
              padding: '5px 14px', borderRadius: 4, border: 'none',
              background: kernMeta.color, color: '#fff', cursor: 'pointer', fontSize: 12,
            }}>Draw 5 samples</button>
          )}
          {tab === 'posterior' && obs.length > 0 && (
            <button onClick={() => setObs([])} style={{
              padding: '5px 14px', borderRadius: 4, border: 'none',
              background: '#888', color: '#fff', cursor: 'pointer', fontSize: 12,
            }}>Clear points</button>
          )}
        </div>
      </div>

      {/* Theory callout */}
      <div style={{ marginTop: 14, background: '#f5f5f5', borderRadius: 6,
        padding: '10px 14px', fontSize: 12, color: '#444', lineHeight: 1.6 }}>
        <strong>GP posterior:</strong> μ* = K<sub>*X</sub>(K<sub>XX</sub> + σ<sub>n</sub>²I)⁻¹y,&nbsp;
        Σ* = K<sub>**</sub> − K<sub>*X</sub>(K<sub>XX</sub> + σ<sub>n</sub>²I)⁻¹K<sub>X*</sub>.&nbsp;
        Shaded region = mean ± 2σ (≈ 95% credible interval). Computed via Cholesky decomposition O(n³).
      </div>
    </div>
  )
}

// ── Slider helper ─────────────────────────────────────────────────────────────

function SliderRow({
  label, min, max, step, value, onChange, color,
}: {
  label: string; min: number; max: number; step: number;
  value: number; onChange: (v: number) => void; color: string
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ color: '#555', fontSize: 11 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ accentColor: color, width: 200 }} />
    </label>
  )
}
