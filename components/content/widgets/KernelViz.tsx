'use client'

import { useState, useCallback, useRef } from 'react'

// ── Kernels ───────────────────────────────────────────────────────────────────

type KernelId = 'gaussian' | 'epanechnikov' | 'laplacian' | 'uniform'

function kernel(id: KernelId, u: number): number {
  // u = (x - x_i) / h, already divided outside
  switch (id) {
    case 'gaussian':
      return Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI)
    case 'epanechnikov':
      return Math.abs(u) <= 1 ? 0.75 * (1 - u * u) : 0
    case 'laplacian':
      return 0.5 * Math.exp(-Math.abs(u))
    case 'uniform':
      return Math.abs(u) <= 1 ? 0.5 : 0
  }
}

// Nadaraya-Watson estimator
function nadarayaWatson(
  xTest: number[],
  xObs: number[],
  yObs: number[],
  h: number,
  kernId: KernelId,
): number[] {
  return xTest.map(xt => {
    let num = 0, den = 0
    for (let i = 0; i < xObs.length; i++) {
      const w = kernel(kernId, (xt - xObs[i]) / h)
      num += w * yObs[i]
      den += w
    }
    return den < 1e-12 ? NaN : num / den
  })
}

// Kernel density estimate (for RKHS panel)
function kde(xTest: number[], xObs: number[], h: number, kernId: KernelId): number[] {
  const n = xObs.length
  return xTest.map(xt =>
    xObs.reduce((s, xi) => s + kernel(kernId, (xt - xi) / h), 0) / (n * h)
  )
}

// ── Layout ────────────────────────────────────────────────────────────────────

const VW = 520, VH = 210
const PAD = { top: 22, right: 20, bottom: 38, left: 50 }
const PW = VW - PAD.left - PAD.right
const PH = VH - PAD.top - PAD.bottom

const X_MIN = 0, X_MAX = 1
const Y_MIN = -2.5, Y_MAX = 2.5
const N_TEST = 200

const xTest = Array.from({ length: N_TEST }, (_, i) => X_MIN + (X_MAX - X_MIN) * i / (N_TEST - 1))

function sx(x: number) { return PAD.left + ((x - X_MIN) / (X_MAX - X_MIN)) * PW }
function sy(y: number) { return PAD.top + ((Y_MAX - y) / (Y_MAX - Y_MIN)) * PH }

function pts(xs: number[], ys: number[]): string {
  const pairs: string[] = []
  for (let i = 0; i < xs.length; i++) {
    if (!isNaN(ys[i])) pairs.push(`${sx(xs[i]).toFixed(1)},${sy(ys[i]).toFixed(1)}`)
  }
  return pairs.join(' ')
}

// Segment NaN-safe polyline into contiguous spans
function safePolylines(xs: number[], ys: number[]): string[] {
  const lines: string[] = []
  let cur: string[] = []
  for (let i = 0; i < xs.length; i++) {
    if (!isNaN(ys[i])) {
      cur.push(`${sx(xs[i]).toFixed(1)},${sy(ys[i]).toFixed(1)}`)
    } else if (cur.length > 1) {
      lines.push(cur.join(' '))
      cur = []
    } else {
      cur = []
    }
  }
  if (cur.length > 1) lines.push(cur.join(' '))
  return lines
}

// ── Kernel metadata ───────────────────────────────────────────────────────────

const KERNELS: { id: KernelId; label: string; color: string }[] = [
  { id: 'gaussian',     label: 'Gaussian',      color: '#4E79A7' },
  { id: 'epanechnikov', label: 'Epanechnikov',  color: '#59A14F' },
  { id: 'laplacian',    label: 'Laplacian',     color: '#E15759' },
  { id: 'uniform',      label: 'Uniform',       color: '#9467BD' },
]

// ── True function options ─────────────────────────────────────────────────────

type FnId = 'sine' | 'bumpy' | 'linear' | 'step'

const FNS: { id: FnId; label: string; f: (x: number) => number }[] = [
  { id: 'sine',   label: 'Sine',   f: x => 1.5 * Math.sin(2 * Math.PI * x) },
  { id: 'bumpy',  label: 'Bumpy',  f: x => Math.sin(4 * Math.PI * x) + 0.5 * Math.cos(8 * Math.PI * x) },
  { id: 'linear', label: 'Linear', f: x => 2 * x - 1 },
  { id: 'step',   label: 'Step',   f: x => x < 0.5 ? -1 : 1 },
]

function randNormal(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// ── RKHS kernel profile panel ─────────────────────────────────────────────────

const KERN_VW = 200, KERN_VH = 80
const KP = { top: 10, right: 10, bottom: 18, left: 16 }

function KernelProfile({ kernId, h, color }: { kernId: KernelId; h: number; color: string }) {
  const uMin = -3, uMax = 3
  const uTest = Array.from({ length: 100 }, (_, i) => uMin + (uMax - uMin) * i / 99)
  const kVals = uTest.map(u => kernel(kernId, u / h) / h)
  const kMax = Math.max(...kVals)
  const pw = KERN_VW - KP.left - KP.right
  const ph = KERN_VH - KP.top - KP.bottom

  function ksx(u: number) { return KP.left + ((u - uMin) / (uMax - uMin)) * pw }
  function ksy(v: number) { return KP.top + (1 - v / (kMax * 1.1)) * ph }

  const kpts = uTest.map((u, i) => `${ksx(u).toFixed(1)},${ksy(kVals[i]).toFixed(1)}`).join(' ')

  return (
    <svg width={KERN_VW} height={KERN_VH} viewBox={`0 0 ${KERN_VW} ${KERN_VH}`}
      style={{ display: 'block' }}>
      <line x1={KP.left} x2={KP.left + pw} y1={KP.top + ph} y2={KP.top + ph} stroke="#ccc" />
      <line x1={ksx(0)} x2={ksx(0)} y1={KP.top} y2={KP.top + ph} stroke="#e0e0e0" />
      {[-2, 0, 2].map(v => (
        <text key={v} x={ksx(v)} y={KP.top + ph + 13} textAnchor="middle" fill="#aaa" fontSize={8}>{v}</text>
      ))}
      <polyline points={kpts} fill="none" stroke={color} strokeWidth={1.5} />
      <path d={`M ${ksx(uMin)},${KP.top + ph} ${kpts} L ${ksx(uMax)},${KP.top + ph} Z`}
        fill={color} opacity={0.15} />
    </svg>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export function KernelViz() {
  const [kernelId, setKernelId] = useState<KernelId>('gaussian')
  const [fnId,     setFnId]     = useState<FnId>('sine')
  const [h,        setH]        = useState(0.15)
  const [noiseSd,  setNoiseSd]  = useState(0.2)
  const [obs,      setObs]      = useState<{ x: number; y: number }[]>([])
  const [tab,      setTab]      = useState<'regression' | 'density' | 'kernels'>('regression')
  const [showTrue, setShowTrue] = useState(true)
  const svgRef = useRef<SVGSVGElement>(null)

  const kernMeta = KERNELS.find(k => k.id === kernelId)!
  const fnMeta   = FNS.find(f => f.id === fnId)!

  const xObs = obs.map(o => o.x)
  const yObs = obs.map(o => o.y)

  const fHat   = obs.length >= 2 ? nadarayaWatson(xTest, xObs, yObs, h, kernelId) : null
  const trueY  = xTest.map(x => fnMeta.f(x))

  const handleClick = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (tab !== 'regression') return
    const rect = svgRef.current!.getBoundingClientRect()
    const px = e.clientX - rect.left
    const py = e.clientY - rect.top
    const x = X_MIN + ((px - PAD.left) / PW) * (X_MAX - X_MIN)
    const y = Y_MAX - ((py - PAD.top) / PH) * (Y_MAX - Y_MIN)
    if (x < X_MIN || x > X_MAX || y < Y_MIN || y > Y_MAX) return
    setObs(prev => [...prev, { x, y }])
  }, [tab])

  const addNoisySamples = useCallback(() => {
    const n = 15
    const newPts = Array.from({ length: n }, () => {
      const x = Math.random()
      const y = fnMeta.f(x) + noiseSd * randNormal()
      return { x, y }
    })
    setObs(prev => [...prev, ...newPts])
  }, [fnMeta, noiseSd])

  // KDE data
  const densVals = obs.length >= 2 ? kde(xTest, xObs, h, kernelId) : null
  const densMax = densVals ? Math.max(...densVals.filter(isFinite), 0.01) : 1

  function syDens(v: number) { return PAD.top + (1 - v / (densMax * 1.1)) * PH }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, userSelect: 'none' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {(['regression', 'density', 'kernels'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '3px 12px', borderRadius: 4, border: 'none', cursor: 'pointer',
            background: tab === t ? kernMeta.color : '#ddd',
            color: tab === t ? '#fff' : '#444', fontSize: 12,
          }}>{t === 'regression' ? 'NW Regression' : t === 'density' ? 'KDE' : 'Kernel profiles'}</button>
        ))}
      </div>

      {/* Kernel profiles view */}
      {tab === 'kernels' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {KERNELS.map(k => (
            <div key={k.id} style={{ border: '1px solid #e0e0e0', borderRadius: 6, padding: 8,
              background: '#fafafa' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: k.color, marginBottom: 4 }}>
                {k.label}
              </div>
              <KernelProfile kernId={k.id} h={h} color={k.color} />
              <div style={{ fontSize: 10, color: '#888', marginTop: 4 }}>
                {k.id === 'gaussian'     && 'K(u) = (2π)⁻¹/² exp(−u²/2), infinite support'}
                {k.id === 'epanechnikov' && 'K(u) = ¾(1−u²)𝟏|u|≤1, optimal MSE'}
                {k.id === 'laplacian'    && 'K(u) = ½ exp(−|u|), double-exp'}
                {k.id === 'uniform'      && 'K(u) = ½𝟏|u|≤1, flat / top-hat'}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Regression / density plots */}
      {tab !== 'kernels' && (
        <svg
          ref={svgRef}
          width={VW} height={VH} viewBox={`0 0 ${VW} ${VH}`}
          onClick={handleClick}
          style={{ display: 'block', cursor: tab === 'regression' ? 'crosshair' : 'default',
            background: '#fafafa', borderRadius: 6, border: '1px solid #e0e0e0' }}
        >
          <defs>
            <clipPath id="kv-clip">
              <rect x={PAD.left} y={PAD.top} width={PW} height={PH} />
            </clipPath>
          </defs>

          {/* Grid lines */}
          {[-2, -1, 0, 1, 2].map(v => (
            <line key={v} x1={PAD.left} x2={PAD.left + PW}
              y1={tab === 'regression' ? sy(v) : syDens(v < 0 ? 0 : v)}
              y2={tab === 'regression' ? sy(v) : syDens(v < 0 ? 0 : v)}
              stroke="#eee" strokeWidth={0.8} />
          ))}

          {/* Axis */}
          <line x1={PAD.left} x2={PAD.left + PW} y1={PAD.top + PH} y2={PAD.top + PH} stroke="#999" />
          <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + PH} stroke="#999" />
          <text x={PAD.left + PW / 2} y={VH - 4} textAnchor="middle" fill="#666" fontSize={10}>x</text>
          {[0, 0.5, 1].map(v => (
            <text key={v} x={sx(v)} y={PAD.top + PH + 14} textAnchor="middle" fill="#666" fontSize={10}>
              {v.toFixed(1)}
            </text>
          ))}

          <g clipPath="url(#kv-clip)">
            {tab === 'regression' && (
              <>
                {/* True function */}
                {showTrue && (
                  <polyline points={pts(xTest, trueY)} fill="none"
                    stroke="#aaa" strokeWidth={1.5} strokeDasharray="5,4" />
                )}
                {/* NW estimate */}
                {fHat && safePolylines(xTest, fHat).map((p, i) => (
                  <polyline key={i} points={p} fill="none" stroke={kernMeta.color} strokeWidth={2.5} />
                ))}
                {/* Influence visualization: kernel at hovered point */}
                {/* Observations */}
                {obs.map((o, i) => (
                  <circle key={i} cx={sx(o.x)} cy={sy(o.y)} r={4}
                    fill="#fff" stroke={kernMeta.color} strokeWidth={2} />
                ))}
                {obs.length === 0 && (
                  <text x={PAD.left + PW / 2} y={PAD.top + PH / 2 + 6}
                    textAnchor="middle" fill="#bbb" fontSize={12}>Click or use &quot;Add samples&quot;</text>
                )}
              </>
            )}

            {tab === 'density' && (
              <>
                {/* KDE curve */}
                {densVals && (
                  <>
                    <path d={(() => {
                      const top = xTest.map((x, i) =>
                        `${sx(x).toFixed(1)},${syDens(densVals[i]).toFixed(1)}`).join(' L ')
                      const base = `L ${sx(X_MAX).toFixed(1)},${syDens(0).toFixed(1)} L ${sx(X_MIN).toFixed(1)},${syDens(0).toFixed(1)} Z`
                      return `M ${top} ${base}`
                    })()} fill={kernMeta.color} opacity={0.2} />
                    <polyline
                      points={xTest.map((x, i) => `${sx(x).toFixed(1)},${syDens(densVals[i]).toFixed(1)}`).join(' ')}
                      fill="none" stroke={kernMeta.color} strokeWidth={2} />
                  </>
                )}
                {/* Rug plot */}
                {obs.map((o, i) => (
                  <line key={i} x1={sx(o.x)} x2={sx(o.x)}
                    y1={PAD.top + PH} y2={PAD.top + PH - 8}
                    stroke={kernMeta.color} strokeWidth={1.5} opacity={0.7} />
                ))}
                {/* Constituent kernels (up to 20) */}
                {obs.slice(0, 20).map((o, i) => {
                  const kpts = xTest.map((x, ti) => {
                    const kv = kernel(kernelId, (x - o.x) / h) / (obs.length * h)
                    return `${sx(x).toFixed(1)},${syDens(kv).toFixed(1)}`
                  }).join(' ')
                  return (
                    <polyline key={i} points={kpts}
                      fill="none" stroke={kernMeta.color} strokeWidth={0.7} opacity={0.35} />
                  )
                })}
                {obs.length === 0 && (
                  <text x={PAD.left + PW / 2} y={PAD.top + PH / 2 + 6}
                    textAnchor="middle" fill="#bbb" fontSize={12}>Add samples to see KDE</text>
                )}
              </>
            )}
          </g>
          <rect x={PAD.left} y={PAD.top} width={PW} height={PH} fill="none" stroke="#ccc" />
        </svg>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 12, alignItems: 'flex-start' }}>
        {/* Kernel selector */}
        <div>
          <div style={{ fontWeight: 600, marginBottom: 4, color: '#444', fontSize: 12 }}>Kernel</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {KERNELS.map(k => (
              <button key={k.id} onClick={() => setKernelId(k.id)} style={{
                padding: '3px 10px', borderRadius: 4, border: `1.5px solid ${k.color}`,
                background: kernelId === k.id ? k.color : 'transparent',
                color: kernelId === k.id ? '#fff' : k.color,
                cursor: 'pointer', fontSize: 11, textAlign: 'left',
              }}>{k.label}</button>
            ))}
          </div>
        </div>

        {/* True function selector */}
        {tab === 'regression' && (
          <div>
            <div style={{ fontWeight: 600, marginBottom: 4, color: '#444', fontSize: 12 }}>True f(x)</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {FNS.map(f => (
                <button key={f.id} onClick={() => setFnId(f.id)} style={{
                  padding: '3px 10px', borderRadius: 4, border: '1.5px solid #888',
                  background: fnId === f.id ? '#888' : 'transparent',
                  color: fnId === f.id ? '#fff' : '#888',
                  cursor: 'pointer', fontSize: 11, textAlign: 'left',
                }}>{f.label}</button>
              ))}
            </div>
          </div>
        )}

        {/* Sliders + actions */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SliderRow label={`h (bandwidth) = ${h.toFixed(3)}`}
            min={0.02} max={0.5} step={0.005} value={h} onChange={setH} color={kernMeta.color} />
          <SliderRow label={`Noise σ = ${noiseSd.toFixed(2)}`}
            min={0.01} max={0.8} step={0.01} value={noiseSd} onChange={setNoiseSd} color="#888" />

          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={addNoisySamples} style={{
              padding: '5px 12px', borderRadius: 4, border: 'none',
              background: kernMeta.color, color: '#fff', cursor: 'pointer', fontSize: 12,
            }}>Add 15 samples</button>
            {obs.length > 0 && (
              <button onClick={() => setObs([])} style={{
                padding: '5px 12px', borderRadius: 4, border: 'none',
                background: '#888', color: '#fff', cursor: 'pointer', fontSize: 12,
              }}>Clear</button>
            )}
            {tab === 'regression' && (
              <button onClick={() => setShowTrue(v => !v)} style={{
                padding: '5px 12px', borderRadius: 4, border: '1.5px solid #aaa',
                background: showTrue ? '#aaa' : 'transparent', color: showTrue ? '#fff' : '#888',
                cursor: 'pointer', fontSize: 12,
              }}>True f</button>
            )}
          </div>

          {obs.length > 0 && (
            <div style={{ fontSize: 11, color: '#888' }}>{obs.length} points</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 12, background: '#f5f5f5', borderRadius: 6,
        padding: '10px 14px', fontSize: 12, color: '#444', lineHeight: 1.6 }}>
        <strong>Nadaraya-Watson:</strong> f̂(x) = Σ K_h(x−xᵢ)yᵢ / Σ K_h(x−xᵢ).
        Small h → undersmoothing (overfits). Large h → oversmoothing (underfits).
        KDE panel shows faint individual kernel contributions summing to the estimate.
        RKHS: the kernel implicitly defines a feature space where regression is linear.
      </div>
    </div>
  )
}

// ── Slider helper ─────────────────────────────────────────────────────────────

function SliderRow({ label, min, max, step, value, onChange, color }: {
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
