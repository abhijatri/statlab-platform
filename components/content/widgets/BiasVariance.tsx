'use client'

import { useState, useCallback } from 'react'

// ── Numerical utilities ───────────────────────────────────────────────────────

function chol(A: number[][]): number[][] {
  const n = A.length
  const L: number[][] = Array.from({ length: n }, () => new Array(n).fill(0))
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let s = A[i][j]
      for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k]
      L[i][j] = j === i ? Math.sqrt(Math.max(s, 1e-14)) : s / L[j][j]
    }
  }
  return L
}

function fwdSolve(L: number[][], b: number[]): number[] {
  const n = b.length; const x = new Array(n).fill(0)
  for (let i = 0; i < n; i++) {
    let s = b[i]
    for (let k = 0; k < i; k++) s -= L[i][k] * x[k]
    x[i] = s / L[i][i]
  }
  return x
}

function bwdSolve(L: number[][], b: number[]): number[] {
  const n = b.length; const x = new Array(n).fill(0)
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i]
    for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k]
    x[i] = s / L[i][i]
  }
  return x
}

// Solve (X^TX + λI)β = X^Ty via Cholesky — returns β
function ridgeSolve(X: number[][], y: number[], lambda: number): number[] {
  const n = X.length, p = X[0].length
  // XtX
  const XtX: number[][] = Array.from({ length: p }, (_, i) =>
    Array.from({ length: p }, (_, j) => {
      let s = 0
      for (let k = 0; k < n; k++) s += X[k][i] * X[k][j]
      return s + (i === j ? lambda : 0)
    })
  )
  const Xty = Array.from({ length: p }, (_, i) => {
    let s = 0
    for (let k = 0; k < n; k++) s += X[k][i] * y[k]
    return s
  })
  const L = chol(XtX)
  return bwdSolve(L, fwdSolve(L, Xty))
}

// Polynomial design matrix at xs, degree d
function polyDesign(xs: number[], d: number): number[][] {
  return xs.map(x => Array.from({ length: d + 1 }, (_, k) => Math.pow(x, k)))
}

function predict(X: number[][], beta: number[]): number[] {
  return X.map(row => row.reduce((s, v, j) => s + v * beta[j], 0))
}

function randNormal(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

// ── True functions ────────────────────────────────────────────────────────────

type FnId = 'sine' | 'cubic' | 'step' | 'linear'

function trueF(id: FnId, x: number): number {
  switch (id) {
    case 'sine':   return Math.sin(2 * Math.PI * x)
    case 'cubic':  return 4 * x * (x - 0.5) * (x - 1)
    case 'step':   return x < 0.5 ? -0.5 : 0.5
    case 'linear': return 2 * x - 1
  }
}

// ── Simulation ────────────────────────────────────────────────────────────────

const N_DATASETS = 40
const N_TRAIN    = 20
const N_TEST     = 80
const LAMBDA     = 1e-8
const MAX_DEGREE = 12

const xTest = Array.from({ length: N_TEST }, (_, i) => i / (N_TEST - 1))

interface SimResult {
  meanPred:   number[]    // E[f̂(x)] over datasets
  biasSq:     number[]    // (E[f̂(x)] - f(x))²
  variance:   number[]    // Var[f̂(x)]
  mse:        number[]    // bias² + var + noise²
  avgBiasSq:  number
  avgVar:     number
  avgMSE:     number
}

function simulate(degree: number, noiseSd: number, fnId: FnId): SimResult {
  const trueVals = xTest.map(x => trueF(fnId, x))
  const allPreds: number[][] = []

  for (let d = 0; d < N_DATASETS; d++) {
    // Sample training set
    const xTrain = Array.from({ length: N_TRAIN }, () => Math.random())
    const yTrain = xTrain.map(x => trueF(fnId, x) + noiseSd * randNormal())
    const X = polyDesign(xTrain, degree)
    const beta = ridgeSolve(X, yTrain, LAMBDA)
    const Xtest = polyDesign(xTest, degree)
    allPreds.push(predict(Xtest, beta))
  }

  const meanPred = xTest.map((_, i) =>
    allPreds.reduce((s, p) => s + p[i], 0) / N_DATASETS
  )

  const biasSq = xTest.map((_, i) => (meanPred[i] - trueVals[i]) ** 2)

  const variance = xTest.map((_, i) =>
    allPreds.reduce((s, p) => s + (p[i] - meanPred[i]) ** 2, 0) / N_DATASETS
  )

  const noiseSq = noiseSd * noiseSd
  const mse = xTest.map((_, i) => biasSq[i] + variance[i] + noiseSq)

  const avg = (arr: number[]) => arr.reduce((s, v) => s + v, 0) / arr.length

  return {
    meanPred,
    biasSq,
    variance,
    mse,
    avgBiasSq: avg(biasSq),
    avgVar:    avg(variance),
    avgMSE:    avg(mse),
  }
}

// Cache results across all degrees
function sweepDegrees(maxDeg: number, noiseSd: number, fnId: FnId): SimResult[] {
  return Array.from({ length: maxDeg }, (_, i) => simulate(i + 1, noiseSd, fnId))
}

// ── SVG layout ────────────────────────────────────────────────────────────────

const VW = 520, VH = 200
const PAD = { top: 22, right: 22, bottom: 38, left: 52 }
const PW = VW - PAD.left - PAD.right
const PH = VH - PAD.top - PAD.bottom

function sx(x: number) { return PAD.left + x * PW }
function sy(y: number, yMax: number) { return PAD.top + (1 - y / yMax) * PH }

const TRUE_COLOR  = '#555'
const MEAN_COLOR  = '#4E79A7'
const BIAS_COLOR  = '#E15759'
const VAR_COLOR   = '#59A14F'
const MSE_COLOR   = '#9467BD'
const NOISE_COLOR = '#F28E2B'

// ── Component ─────────────────────────────────────────────────────────────────

const FNS: { id: FnId; label: string }[] = [
  { id: 'sine',   label: 'sin(2πx)' },
  { id: 'cubic',  label: 'Cubic'    },
  { id: 'step',   label: 'Step'     },
  { id: 'linear', label: 'Linear'   },
]

export function BiasVariance() {
  const [degree,   setDegree]   = useState(3)
  const [noiseSd,  setNoiseSd]  = useState(0.2)
  const [fnId,     setFnId]     = useState<FnId>('sine')
  const [tab,      setTab]      = useState<'fit' | 'decomp'>('fit')
  const [results,  setResults]  = useState<SimResult[] | null>(null)
  const [current,  setCurrent]  = useState<SimResult | null>(null)
  const [running,  setRunning]  = useState(false)

  const runSim = useCallback(() => {
    setRunning(true)
    setTimeout(() => {
      const all = sweepDegrees(MAX_DEGREE, noiseSd, fnId)
      setResults(all)
      setCurrent(all[degree - 1])
      setRunning(false)
    }, 0)
  }, [degree, noiseSd, fnId])

  const handleDegreeChange = useCallback((d: number) => {
    setDegree(d)
    if (results) setCurrent(results[d - 1])
  }, [results])

  const trueVals = xTest.map(x => trueF(fnId, x))
  const yMin = Math.min(...trueVals) - 0.5
  const yMax = Math.max(...trueVals) + 0.5
  const yRange = yMax - yMin

  function syFit(y: number) { return PAD.top + (1 - (y - yMin) / yRange) * PH }

  function pts(ys: number[]) {
    return xTest.map((x, i) => `${sx(x).toFixed(1)},${syFit(ys[i]).toFixed(1)}`).join(' ')
  }

  // Decomposition sweep data
  const sweepX = Array.from({ length: MAX_DEGREE }, (_, i) => (i + 1) / MAX_DEGREE)
  const biasSqArr = results ? results.map(r => r.avgBiasSq) : []
  const varArr    = results ? results.map(r => r.avgVar)    : []
  const mseArr    = results ? results.map(r => r.avgMSE)    : []
  const noiseArr  = results ? results.map(() => noiseSd ** 2) : []
  const decompMax = results ? Math.max(...mseArr, 0.5) * 1.1 : 1

  function decompPts(ys: number[]) {
    return sweepX.map((x, i) => `${sx(x).toFixed(1)},${sy(ys[i], decompMax).toFixed(1)}`).join(' ')
  }

  const curDegreeX = sx(degree / MAX_DEGREE)

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, userSelect: 'none' }}>
      {/* Function selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {FNS.map(f => (
          <button key={f.id} onClick={() => { setFnId(f.id); setResults(null); setCurrent(null) }} style={{
            padding: '3px 12px', borderRadius: 4, border: '1.5px solid #4E79A7',
            background: fnId === f.id ? '#4E79A7' : 'transparent',
            color: fnId === f.id ? '#fff' : '#4E79A7',
            cursor: 'pointer', fontSize: 12,
          }}>{f.label}</button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {(['fit', 'decomp'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '3px 12px', borderRadius: 4, border: 'none', cursor: 'pointer',
            background: tab === t ? '#555' : '#ddd',
            color: tab === t ? '#fff' : '#444', fontSize: 12,
          }}>{t === 'fit' ? 'Mean fit' : 'Bias²/Var/MSE curve'}</button>
        ))}
      </div>

      {/* Plot */}
      {tab === 'fit' && (
        <svg width="100%" height={VH} viewBox={`0 0 ${VW} ${VH}`}
          style={{ display: 'block', background: '#fafafa', borderRadius: 6, border: '1px solid #e0e0e0' }}>
          <defs>
            <clipPath id="bv-fit-clip">
              <rect x={PAD.left} y={PAD.top} width={PW} height={PH} />
            </clipPath>
          </defs>
          {/* Grid */}
          {[0, 0.25, 0.5, 0.75, 1].map(v => (
            <line key={v} x1={sx(v)} x2={sx(v)} y1={PAD.top} y2={PAD.top + PH}
              stroke="#eee" strokeWidth={0.8} />
          ))}
          {/* Axes */}
          <line x1={PAD.left} x2={PAD.left + PW} y1={PAD.top + PH} y2={PAD.top + PH} stroke="#999" />
          <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + PH} stroke="#999" />
          <text x={PAD.left + PW / 2} y={VH - 2} textAnchor="middle" fill="#666" fontSize={10}>x</text>

          <g clipPath="url(#bv-fit-clip)">
            {/* True function */}
            <polyline points={pts(trueVals)} fill="none" stroke={TRUE_COLOR}
              strokeWidth={1.5} strokeDasharray="5,4" />
            {/* Mean prediction */}
            {current && (
              <polyline points={pts(current.meanPred)} fill="none"
                stroke={MEAN_COLOR} strokeWidth={2} />
            )}
            {/* ±sqrt(variance) band */}
            {current && (() => {
              const hi = current.meanPred.map((m, i) => m + Math.sqrt(current.variance[i]))
              const lo = current.meanPred.map((m, i) => m - Math.sqrt(current.variance[i]))
              const top = xTest.map((x, i) => `${sx(x).toFixed(1)},${syFit(hi[i]).toFixed(1)}`).join(' L ')
              const bot = [...xTest].reverse().map((x, i) =>
                `${sx(x).toFixed(1)},${syFit(lo[xTest.length - 1 - i]).toFixed(1)}`).join(' L ')
              return <path d={`M ${top} L ${bot} Z`} fill={VAR_COLOR} opacity={0.15} />
            })()}
          </g>

          {/* Legend */}
          <LegendItem x={PAD.left + 8} y={PAD.top + 12} color={TRUE_COLOR}  dash label="True f(x)" />
          <LegendItem x={PAD.left + 8} y={PAD.top + 26} color={MEAN_COLOR}  label={`E[f̂(x)], deg=${degree}`} />
          <LegendItem x={PAD.left + 8} y={PAD.top + 40} color={VAR_COLOR}   band label="±√Var band" />

          {!current && (
            <text x={PAD.left + PW / 2} y={PAD.top + PH / 2 + 6}
              textAnchor="middle" fill="#bbb" fontSize={13}>Press &quot;Run simulation&quot;</text>
          )}
          <rect x={PAD.left} y={PAD.top} width={PW} height={PH} fill="none" stroke="#ccc" />
        </svg>
      )}

      {tab === 'decomp' && (
        <svg width="100%" height={VH} viewBox={`0 0 ${VW} ${VH}`}
          style={{ display: 'block', background: '#fafafa', borderRadius: 6, border: '1px solid #e0e0e0' }}>
          <defs>
            <clipPath id="bv-decomp-clip">
              <rect x={PAD.left} y={PAD.top} width={PW} height={PH} />
            </clipPath>
          </defs>
          {/* Axes */}
          <line x1={PAD.left} x2={PAD.left + PW} y1={PAD.top + PH} y2={PAD.top + PH} stroke="#999" />
          <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + PH} stroke="#999" />
          <text x={PAD.left + PW / 2} y={VH - 2} textAnchor="middle" fill="#666" fontSize={10}>Polynomial degree</text>

          {Array.from({ length: MAX_DEGREE }, (_, i) => i + 1).map(d => (
            <text key={d} x={sx(d / MAX_DEGREE)} y={PAD.top + PH + 14}
              textAnchor="middle" fill="#666" fontSize={9}>{d}</text>
          ))}
          {[0, 0.5, 1].map(v => (
            <text key={v} x={PAD.left - 6} y={sy(v * decompMax, decompMax) + 4}
              textAnchor="end" fill="#666" fontSize={9}>{(v * decompMax).toFixed(2)}</text>
          ))}

          <g clipPath="url(#bv-decomp-clip)">
            {results && (
              <>
                <polyline points={decompPts(biasSqArr)} fill="none" stroke={BIAS_COLOR} strokeWidth={2} />
                <polyline points={decompPts(varArr)}    fill="none" stroke={VAR_COLOR}  strokeWidth={2} />
                <polyline points={decompPts(mseArr)}    fill="none" stroke={MSE_COLOR}  strokeWidth={2.5} />
                <polyline points={decompPts(noiseArr)}  fill="none" stroke={NOISE_COLOR} strokeWidth={1.5} strokeDasharray="4,3" />
              </>
            )}
            {/* Vertical line at current degree */}
            {results && (
              <line x1={curDegreeX} x2={curDegreeX} y1={PAD.top} y2={PAD.top + PH}
                stroke="#555" strokeWidth={1.5} strokeDasharray="4,3" opacity={0.7} />
            )}
            {!results && (
              <text x={PAD.left + PW / 2} y={PAD.top + PH / 2 + 6}
                textAnchor="middle" fill="#bbb" fontSize={13}>Press &quot;Run simulation&quot;</text>
            )}
          </g>

          {/* Legend */}
          <LegendItem x={PAD.left + 8} y={PAD.top + 12} color={BIAS_COLOR}  label="Bias²"         />
          <LegendItem x={PAD.left + 8} y={PAD.top + 26} color={VAR_COLOR}   label="Variance"       />
          <LegendItem x={PAD.left + 8} y={PAD.top + 40} color={MSE_COLOR}   label="MSE"            />
          <LegendItem x={PAD.left + 8} y={PAD.top + 54} color={NOISE_COLOR} dash label="Noise σ²"  />

          <rect x={PAD.left} y={PAD.top} width={PW} height={PH} fill="none" stroke="#ccc" />
        </svg>
      )}

      {/* Stats row */}
      {current && (
        <div style={{ display: 'flex', gap: 24, marginTop: 10, fontSize: 12 }}>
          <Stat label="Avg Bias²"   value={current.avgBiasSq.toFixed(4)} color={BIAS_COLOR}  />
          <Stat label="Avg Var"     value={current.avgVar.toFixed(4)}    color={VAR_COLOR}   />
          <Stat label="Noise σ²"    value={(noiseSd**2).toFixed(4)}      color={NOISE_COLOR} />
          <Stat label="Avg MSE"     value={current.avgMSE.toFixed(4)}    color={MSE_COLOR}   />
        </div>
      )}

      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12, alignItems: 'flex-end' }}>
        <SliderRow label={`Degree = ${degree}`}
          min={1} max={MAX_DEGREE} step={1} value={degree} onChange={handleDegreeChange} color="#4E79A7" />
        <SliderRow label={`Noise σ = ${noiseSd.toFixed(2)}`}
          min={0.05} max={1} step={0.01} value={noiseSd} onChange={v => { setNoiseSd(v); setResults(null); setCurrent(null) }} color="#F28E2B" />
        <button onClick={runSim} disabled={running} style={{
          padding: '6px 18px', borderRadius: 4, border: 'none',
          background: running ? '#aaa' : '#4E79A7',
          color: '#fff', cursor: running ? 'default' : 'pointer',
          fontSize: 13, fontWeight: 600,
        }}>{running ? 'Simulating…' : 'Run simulation'}</button>
      </div>

      <div style={{ marginTop: 12, background: '#f5f5f5', borderRadius: 6,
        padding: '10px 14px', fontSize: 12, color: '#444', lineHeight: 1.6 }}>
        <strong>Decomposition:</strong> E[(f̂−y)²] = Bias² + Variance + σ².&nbsp;
        Low degree → high bias, low variance. High degree → low bias, high variance.
        Each curve = average over {N_DATASETS} independently-sampled training sets of size {N_TRAIN}.
        Ridge regularization λ={LAMBDA} for numerical stability.
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function LegendItem({ x, y, color, label, dash, band }: {
  x: number; y: number; color: string; label: string; dash?: boolean; band?: boolean
}) {
  return (
    <g>
      {band
        ? <rect x={x} y={y - 6} width={20} height={10} fill={color} opacity={0.25} />
        : <line x1={x} x2={x + 20} y1={y - 1} y2={y - 1} stroke={color} strokeWidth={2}
            strokeDasharray={dash ? '4,3' : undefined} />
      }
      <text x={x + 25} y={y + 3} fill="#444" fontSize={10}>{label}</text>
    </g>
  )
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ color: '#888', fontSize: 10 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 15, color }}>{value}</div>
    </div>
  )
}

function SliderRow({ label, min, max, step, value, onChange, color }: {
  label: string; min: number; max: number; step: number;
  value: number; onChange: (v: number) => void; color: string
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <span style={{ color: '#555', fontSize: 11 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ accentColor: color, width: 180 }} />
    </label>
  )
}
