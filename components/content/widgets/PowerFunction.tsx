'use client'

import { useState, useMemo } from 'react'

// ── Math ───────────────────────────────────────────────────────────────────────

function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x))
  const p = t*(0.254829592 + t*(-0.284496736 + t*(1.421413741 + t*(-1.453152027 + t*1.061405429))))
  const v = 1 - p * Math.exp(-x*x)
  return x >= 0 ? v : -v
}

function Phi(x: number) { return 0.5*(1+erf(x/Math.SQRT2)) }
function PhiInv(p: number): number {
  // Rational approximation (A&S 26.2.23)
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  const q = p < 0.5 ? p : 1-p
  const t = Math.sqrt(-2*Math.log(q))
  const a = [2.515517,0.802853,0.010328]
  const b = [1.432788,0.189269,0.001308]
  const x = t - (a[0]+a[1]*t+a[2]*t*t)/(1+b[0]*t+b[1]*t*t+b[2]*t*t*t)
  return p < 0.5 ? -x : x
}

// Non-central t CDF approximation via normal approximation to NCP
function powerT(delta: number, df: number, alpha: number, twoSided: boolean): number {
  // Exact power via numerical non-central t integration is complex.
  // Use accurate approximation: non-central t with ncp delta ≈ normal with same ncp
  const ta = PhiInv(1 - (twoSided ? alpha/2 : alpha))
  if (twoSided) {
    return Phi(-ta + delta) + Phi(-ta - delta)
  }
  return Phi(-ta + delta)
}

// ── Test configurations ────────────────────────────────────────────────────────

type TestType = 'z-one' | 'z-two' | 't-one' | 't-two' | 'np-simple'

interface TestDef {
  label: string
  description: string
  params: { key:string; label:string; min:number; max:number; step:number; default:number }[]
  powerFn: (theta:number, p:Record<string,number>) => number
  thetaLabel: string
  thetaRange: (p:Record<string,number>) => [number,number]
  nullTheta: (p:Record<string,number>) => number
  altDescription: (p:Record<string,number>) => string
}

const TESTS: Record<TestType, TestDef> = {
  'z-one': {
    label: 'One-sided Z-test',
    description: 'H₀: μ = μ₀  vs  H₁: μ > μ₀. Assumes σ known.',
    params: [
      { key:'mu0', label:'μ₀ (null mean)', min:-3, max:3, step:0.1, default:0 },
      { key:'sigma', label:'σ (known std)', min:0.5, max:4, step:0.1, default:1 },
      { key:'n', label:'n (sample size)', min:5, max:200, step:5, default:30 },
      { key:'alpha', label:'α (size)', min:0.01, max:0.2, step:0.01, default:0.05 },
    ],
    powerFn: (theta, p) => {
      const delta = Math.sqrt(p.n)*(theta - p.mu0)/p.sigma
      return Phi(-PhiInv(1-p.alpha) + delta)
    },
    thetaLabel: 'μ',
    thetaRange: (p) => [p.mu0 - 2*p.sigma, p.mu0 + 3*p.sigma],
    nullTheta: (p) => p.mu0,
    altDescription: (p) => `μ > ${p.mu0.toFixed(1)}`,
  },
  'z-two': {
    label: 'Two-sided Z-test',
    description: 'H₀: μ = μ₀  vs  H₁: μ ≠ μ₀. Assumes σ known.',
    params: [
      { key:'mu0', label:'μ₀ (null mean)', min:-3, max:3, step:0.1, default:0 },
      { key:'sigma', label:'σ (known std)', min:0.5, max:4, step:0.1, default:1 },
      { key:'n', label:'n (sample size)', min:5, max:200, step:5, default:30 },
      { key:'alpha', label:'α (size)', min:0.01, max:0.2, step:0.01, default:0.05 },
    ],
    powerFn: (theta, p) => {
      const delta = Math.sqrt(p.n)*(theta - p.mu0)/p.sigma
      const z = PhiInv(1-p.alpha/2)
      return Phi(-z + delta) + Phi(-z - delta)
    },
    thetaLabel: 'μ',
    thetaRange: (p) => [p.mu0 - 3*p.sigma, p.mu0 + 3*p.sigma],
    nullTheta: (p) => p.mu0,
    altDescription: (p) => `μ ≠ ${p.mu0.toFixed(1)}`,
  },
  't-one': {
    label: 'One-sided t-test',
    description: 'H₀: μ = μ₀  vs  H₁: μ > μ₀. σ unknown.',
    params: [
      { key:'mu0', label:'μ₀ (null mean)', min:-3, max:3, step:0.1, default:0 },
      { key:'sigma', label:'σ (true std)', min:0.5, max:4, step:0.1, default:1 },
      { key:'n', label:'n (sample size)', min:5, max:200, step:5, default:30 },
      { key:'alpha', label:'α (size)', min:0.01, max:0.2, step:0.01, default:0.05 },
    ],
    powerFn: (theta, p) => {
      const delta = Math.sqrt(p.n)*(theta - p.mu0)/p.sigma
      return powerT(delta, p.n-1, p.alpha, false)
    },
    thetaLabel: 'μ',
    thetaRange: (p) => [p.mu0 - 2*p.sigma, p.mu0 + 3*p.sigma],
    nullTheta: (p) => p.mu0,
    altDescription: (p) => `μ > ${p.mu0.toFixed(1)}`,
  },
  't-two': {
    label: 'Two-sided t-test',
    description: 'H₀: μ = μ₀  vs  H₁: μ ≠ μ₀. σ unknown.',
    params: [
      { key:'mu0', label:'μ₀ (null mean)', min:-3, max:3, step:0.1, default:0 },
      { key:'sigma', label:'σ (true std)', min:0.5, max:4, step:0.1, default:1 },
      { key:'n', label:'n (sample size)', min:5, max:200, step:5, default:30 },
      { key:'alpha', label:'α (size)', min:0.01, max:0.2, step:0.01, default:0.05 },
    ],
    powerFn: (theta, p) => {
      const delta = Math.sqrt(p.n)*(theta - p.mu0)/p.sigma
      return powerT(delta, p.n-1, p.alpha, true)
    },
    thetaLabel: 'μ',
    thetaRange: (p) => [p.mu0 - 3*p.sigma, p.mu0 + 3*p.sigma],
    nullTheta: (p) => p.mu0,
    altDescription: (p) => `μ ≠ ${p.mu0.toFixed(1)}`,
  },
  'np-simple': {
    label: 'Neyman-Pearson (Normal)',
    description: 'Most powerful test. Simple H₀: μ=μ₀ vs simple H₁: μ=μ₁.',
    params: [
      { key:'mu0', label:'μ₀ (H₀ mean)', min:-3, max:3, step:0.1, default:0 },
      { key:'mu1', label:'μ₁ (H₁ mean)', min:-3, max:5, step:0.1, default:1.5 },
      { key:'sigma', label:'σ', min:0.5, max:4, step:0.1, default:1 },
      { key:'n', label:'n', min:5, max:200, step:5, default:30 },
      { key:'alpha', label:'α', min:0.01, max:0.2, step:0.01, default:0.05 },
    ],
    powerFn: (theta, p) => {
      // Power at theta: uses the test designed for mu0 vs mu1 direction
      const sign = p.mu1 > p.mu0 ? 1 : -1
      const delta = sign*Math.sqrt(p.n)*(theta - p.mu0)/p.sigma
      return Phi(-PhiInv(1-p.alpha) + delta)
    },
    thetaLabel: 'μ',
    thetaRange: (p) => {
      const lo = Math.min(p.mu0,p.mu1) - 2*p.sigma
      const hi = Math.max(p.mu0,p.mu1) + 2*p.sigma
      return [lo, hi]
    },
    nullTheta: (p) => p.mu0,
    altDescription: (p) => `μ = ${p.mu1.toFixed(1)}`,
  },
}

// ── Power SVG Plot ─────────────────────────────────────────────────────────────

function PowerPlot({
  powerFn, thetaRange, alpha, nullTheta, thetaLabel, altTheta,
}: {
  powerFn: (t:number)=>number
  thetaRange: [number,number]
  alpha: number
  nullTheta: number
  thetaLabel: string
  altTheta?: number
}) {
  const W=500, H=220, PL=44, PR=16, PT=16, PB=36
  const pw=W-PL-PR, ph=H-PT-PB
  const [lo, hi] = thetaRange

  const pts = useMemo(() => {
    const n = 300
    return Array.from({length:n}, (_,i) => {
      const t = lo + (hi-lo)*i/(n-1)
      return { t, beta: powerFn(t) }
    })
  }, [powerFn, lo, hi])

  const sx = (t:number) => PL + (t-lo)/(hi-lo)*pw
  const sy = (b:number) => PT + (1-b)*ph

  const pathD = pts.reduce((acc,p,i) =>
    acc + (i===0 ? `M${sx(p.t).toFixed(1)},${sy(p.beta).toFixed(1)}`
                 : ` L${sx(p.t).toFixed(1)},${sy(p.beta).toFixed(1)}`), '')

  // α horizontal line
  const alphaPts = `M${PL},${sy(alpha).toFixed(1)} L${PL+pw},${sy(alpha).toFixed(1)}`

  const xTicks = 5
  const yTicks = [0,0.2,0.4,0.6,0.8,1.0]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto', display:'block' }}>
      {/* Horizontal grid */}
      {yTicks.map(b => (
        <line key={b} x1={PL} y1={sy(b)} x2={PL+pw} y2={sy(b)}
          stroke="var(--color-border)" strokeWidth="0.5" />
      ))}
      {/* α level line */}
      <path d={alphaPts} stroke="var(--color-accent)" strokeWidth="1"
        strokeDasharray="4,3" opacity="0.7" fill="none" />
      <text x={PL+pw+2} y={sy(alpha)+3} fontSize="9" fill="var(--color-accent)">α</text>

      {/* Power curve */}
      <path d={pathD} fill="none" stroke="var(--color-text-secondary)" strokeWidth="2" />

      {/* Null marker */}
      {isFinite(sx(nullTheta)) && (
        <>
          <line x1={sx(nullTheta)} y1={PT} x2={sx(nullTheta)} y2={PT+ph}
            stroke="var(--color-text-muted)" strokeWidth="1" strokeDasharray="3,3" />
          <text x={sx(nullTheta)+3} y={PT+10} fontSize="9" fill="var(--color-text-muted)">H₀</text>
        </>
      )}
      {/* Alt marker */}
      {altTheta !== undefined && isFinite(sx(altTheta)) && (
        <>
          <line x1={sx(altTheta)} y1={PT} x2={sx(altTheta)} y2={PT+ph}
            stroke="#c0392b" strokeWidth="1.5" strokeDasharray="4,3" />
          <circle cx={sx(altTheta)} cy={sy(powerFn(altTheta))} r="4" fill="#c0392b" />
          <text x={sx(altTheta)+4} y={PT+10} fontSize="9" fill="#c0392b">H₁</text>
        </>
      )}

      {/* Axes */}
      <line x1={PL} y1={PT} x2={PL} y2={PT+ph} stroke="var(--color-border-strong)" strokeWidth="1" />
      <line x1={PL} y1={PT+ph} x2={PL+pw} y2={PT+ph} stroke="var(--color-border-strong)" strokeWidth="1" />

      {Array.from({length:xTicks+1},(_,i)=>{
        const t = lo+(hi-lo)*i/xTicks
        const x = sx(t)
        return (
          <g key={i}>
            <line x1={x} y1={PT+ph} x2={x} y2={PT+ph+4} stroke="var(--color-border-strong)" strokeWidth="1"/>
            <text x={x} y={PT+ph+13} textAnchor="middle" fontSize="9" fill="var(--color-text-muted)">{t.toFixed(1)}</text>
          </g>
        )
      })}
      {yTicks.map(b => (
        <g key={b}>
          <line x1={PL-4} y1={sy(b)} x2={PL} y2={sy(b)} stroke="var(--color-border-strong)" strokeWidth="1"/>
          <text x={PL-6} y={sy(b)+3} textAnchor="end" fontSize="9" fill="var(--color-text-muted)">{b.toFixed(1)}</text>
        </g>
      ))}
      <text x={PL+pw/2} y={H-2} textAnchor="middle" fontSize="10" fill="var(--color-text-muted)">{thetaLabel}</text>
      <text x={10} y={PT+ph/2} textAnchor="middle" fontSize="10" fill="var(--color-text-muted)"
        transform={`rotate(-90,10,${PT+ph/2})`}>Power β(θ)</text>
    </svg>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────

export function PowerFunction() {
  const [testKey, setTestKey] = useState<TestType>('z-one')
  const [params, setParams] = useState<Record<string,number>>({mu0:0, sigma:1, n:30, alpha:0.05})

  const test = TESTS[testKey]

  function switchTest(key: TestType) {
    setTestKey(key)
    const def: Record<string,number> = {}
    TESTS[key].params.forEach(p => { def[p.key] = p.default })
    setParams(def)
  }

  function setParam(key:string, val:number) {
    setParams(prev => ({...prev, [key]:val}))
  }

  const nullTheta = test.nullTheta(params)
  const altTheta = params.mu1
  const powerAtAlt = altTheta !== undefined ? test.powerFn(altTheta, params) : null
  const powerAtNull = test.powerFn(nullTheta, params)

  // Sample size for 80% power
  const targetPower = 0.8
  const nFor80 = useMemo(() => {
    for (let n = 2; n <= 5000; n++) {
      const p2 = {...params, n}
      const theta2 = altTheta ?? (nullTheta + params.sigma)
      if (test.powerFn(theta2, p2) >= targetPower) return n
    }
    return null
  }, [test, params, nullTheta, altTheta])

  return (
    <div className="flex h-full min-h-0 text-xs" style={{ fontFamily: 'var(--font-inter, system-ui, sans-serif)' }}>

      {/* Left panel */}
      <div className="flex flex-col w-56 shrink-0 border-r border-border bg-elevated overflow-y-auto">

        <div className="px-3 pt-3 pb-2">
          <p className="label-xs mb-2">Test</p>
          <div className="space-y-0.5">
            {(Object.entries(TESTS) as [TestType,TestDef][]).map(([key, t]) => (
              <button key={key} onClick={() => switchTest(key)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors ${
                  testKey===key ? 'bg-accent-light text-accent font-medium' : 'text-text-secondary hover:bg-border/50'
                }`}
              >{t.label}</button>
            ))}
          </div>
        </div>

        <div className="mx-3 border-t border-border" />

        <div className="px-3 py-2 flex-1">
          <p className="label-xs mb-2">Parameters</p>
          {test.params.map(ps => (
            <div key={ps.key} className="mb-2.5">
              <div className="flex justify-between mb-0.5">
                <span className="font-mono text-text-muted">{ps.label}</span>
                <span className="font-mono text-text-secondary tabular-nums">
                  {(params[ps.key]??ps.default).toFixed(ps.step<0.1?2:ps.step<1?2:0)}
                </span>
              </div>
              <input type="range" min={ps.min} max={ps.max} step={ps.step}
                value={params[ps.key]??ps.default}
                onChange={e=>setParam(ps.key, parseFloat(e.target.value))}
                className="w-full h-1 cursor-pointer accent-accent"
              />
            </div>
          ))}
        </div>

        <div className="px-3 py-2 border-t border-border text-[10px] text-text-muted leading-relaxed">
          {test.description}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 p-4 border-b border-border">
          <div className="rounded-md bg-elevated border border-border px-3 py-2">
            <p className="label-xs mb-1">Size (Type I error)</p>
            <p className="font-mono text-base text-accent">{powerAtNull.toFixed(4)}</p>
            <p className="text-text-muted text-[10px] mt-0.5">P(reject | H₀) = α</p>
          </div>
          <div className="rounded-md bg-elevated border border-border px-3 py-2">
            <p className="label-xs mb-1">Power at H₁</p>
            <p className="font-mono text-base text-accent">
              {powerAtAlt !== null ? powerAtAlt.toFixed(4) : '—'}
            </p>
            <p className="text-text-muted text-[10px] mt-0.5">P(reject | {test.altDescription(params)})</p>
          </div>
          <div className="rounded-md bg-elevated border border-border px-3 py-2">
            <p className="label-xs mb-1">n for 80% power</p>
            <p className="font-mono text-base text-accent">
              {nFor80 !== null ? nFor80 : '>5000'}
            </p>
            <p className="text-text-muted text-[10px] mt-0.5">current n = {params.n}</p>
          </div>
        </div>

        {/* Power curve */}
        <div className="p-4 border-b border-border">
          <p className="label-xs mb-2">Power function β(θ)</p>
          <div className="bg-surface rounded-md border border-border p-2 overflow-hidden">
            <PowerPlot
              powerFn={(t) => test.powerFn(t, params)}
              thetaRange={test.thetaRange(params)}
              alpha={params.alpha??0.05}
              nullTheta={nullTheta}
              thetaLabel={test.thetaLabel}
              altTheta={altTheta}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-text-muted text-center">
            Blue dashed = size α · Power curve = P(reject H₀ | true θ)
          </p>
        </div>

        {/* Type II error table */}
        <div className="p-4">
          <p className="label-xs mb-2">Error summary</p>
          <div className="rounded-md border border-border overflow-hidden">
            <div className="grid grid-cols-3 bg-elevated px-4 py-1.5 border-b border-border">
              <span className="text-text-muted">Effect size δ/σ</span>
              <span className="text-text-muted text-center">Power (1−β)</span>
              <span className="text-text-muted text-center">Type II error β</span>
            </div>
            {[0.2,0.5,0.8,1.0,1.5,2.0].map(d => {
              const theta = nullTheta + d*(params.sigma??1)
              const pow = test.powerFn(theta, params)
              return (
                <div key={d} className="grid grid-cols-3 px-4 py-2 border-b border-border last:border-0 bg-surface">
                  <span className="text-text-secondary font-mono">{d.toFixed(1)}</span>
                  <span className="font-mono text-center text-accent">{pow.toFixed(3)}</span>
                  <span className="font-mono text-center text-text-muted">{(1-pow).toFixed(3)}</span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
