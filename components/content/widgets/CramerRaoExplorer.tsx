'use client'

import { useState, useMemo } from 'react'

// ── Math helpers ───────────────────────────────────────────────────────────────

function lgamma(z: number): number {
  const c = [76.18009172947146,-86.50532032941677,24.01409824083091,
    -1.231739572450155,1.208650973866179e-3,-5.395239384953e-6]
  let x = z, y = z
  const tmp = x + 5.5
  const ser = c.reduce((s, ci, i) => s + ci / (y + i + 1), 1.000000000190015)
  return (Math.log(2.5066282746310005) + Math.log(ser) - tmp + (x + 0.5) * Math.log(tmp))
}

function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x))
  const p = t*(0.254829592 + t*(-0.284496736 + t*(1.421413741 + t*(-1.453152027 + t*1.061405429))))
  const v = 1 - p * Math.exp(-x*x)
  return x >= 0 ? v : -v
}

function normPDF(x: number) { return Math.exp(-0.5*x*x) / Math.sqrt(2*Math.PI) }
function normCDF(x: number) { return 0.5 * (1 + erf(x / Math.SQRT2)) }

// ── Distribution definitions ───────────────────────────────────────────────────

interface DistDef {
  name: string
  params: { key: string; label: string; min: number; max: number; step: number; default: number }[]
  fisherInfo: (p: Record<string,number>) => number
  crlb: (p: Record<string,number>, n: number) => number
  mleFormula: string
  fisherFormula: string
  crlbFormula: string
  sufficiency: string
  logLik: (data: number[], theta: number, p: Record<string,number>) => number
  thetaRange: (p: Record<string,number>) => [number,number]
  thetaLabel: string
  sample: (p: Record<string,number>, n: number) => number[]
  mleCompute: (data: number[], p: Record<string,number>) => number
}

function rnorm(mu=0, sigma=1) {
  const u1 = Math.random(), u2 = Math.random()
  return mu + sigma * Math.sqrt(-2*Math.log(u1)) * Math.cos(2*Math.PI*u2)
}
function rgamma(shape: number, rate=1): number {
  if (shape < 1) return rgamma(shape+1,rate) * Math.pow(Math.random(), 1/shape)
  const d = shape-1/3, c = 1/Math.sqrt(9*d)
  while(true){
    let x=rnorm(), v=1+c*x
    if(v<=0) continue
    v=v*v*v
    const u=Math.random()
    if(u<1-0.0331*(x*x)*(x*x)) return d*v/rate
    if(Math.log(u)<0.5*x*x+d*(1-v+Math.log(v))) return d*v/rate
  }
}

const DISTS: Record<string, DistDef> = {
  normal: {
    name: 'Normal (μ, σ² known)',
    params: [
      { key:'mu', label:'μ (mean)', min:-3, max:3, step:0.1, default:0 },
      { key:'sigma', label:'σ (std)', min:0.2, max:4, step:0.1, default:1 },
    ],
    fisherInfo: (p) => 1 / (p.sigma ** 2),
    crlb: (p,n) => p.sigma**2 / n,
    mleFormula: 'μ̂ = X̄',
    fisherFormula: 'I(μ) = 1/σ²',
    crlbFormula: 'CRLB = σ²/n',
    sufficiency: 'T = X̄ is complete sufficient (normal family). MLE = UMVUE.',
    logLik: (data, theta, p) => data.reduce((s,x) => s - (x-theta)**2/(2*p.sigma**2), 0),
    thetaRange: (p) => [p.mu - 4*p.sigma, p.mu + 4*p.sigma],
    thetaLabel: 'μ',
    sample: (p,n) => Array.from({length:n}, () => rnorm(p.mu, p.sigma)),
    mleCompute: (data) => data.reduce((s,x)=>s+x,0)/data.length,
  },
  exponential: {
    name: 'Exponential (λ)',
    params: [
      { key:'lambda', label:'λ (rate)', min:0.2, max:5, step:0.1, default:1 },
    ],
    fisherInfo: (p) => 1 / (p.lambda**2),
    crlb: (p,n) => p.lambda**2 / n,
    mleFormula: 'λ̂ = n / Σxᵢ = 1/X̄',
    fisherFormula: 'I(λ) = 1/λ²',
    crlbFormula: 'CRLB = λ²/n',
    sufficiency: 'T = Σxᵢ is complete sufficient. λ̂ = 1/X̄ is UMVUE for λ.',
    logLik: (data, theta) => theta>0 ? data.length*Math.log(theta) - theta*data.reduce((s,x)=>s+x,0) : -Infinity,
    thetaRange: (p) => [Math.max(0.05, p.lambda*0.1), p.lambda*3],
    thetaLabel: 'λ',
    sample: (p,n) => Array.from({length:n}, () => -Math.log(Math.random())/p.lambda),
    mleCompute: (data) => data.length / data.reduce((s,x)=>s+x,0),
  },
  poisson: {
    name: 'Poisson (λ)',
    params: [
      { key:'lambda', label:'λ (rate)', min:0.5, max:10, step:0.1, default:3 },
    ],
    fisherInfo: (p) => 1 / p.lambda,
    crlb: (p,n) => p.lambda / n,
    mleFormula: 'λ̂ = X̄',
    fisherFormula: 'I(λ) = 1/λ',
    crlbFormula: 'CRLB = λ/n',
    sufficiency: 'T = Σxᵢ is complete sufficient. X̄ is UMVUE for λ.',
    logLik: (data, theta) => {
      if(theta<=0) return -Infinity
      return data.reduce((s,x) => s + x*Math.log(theta) - theta - lgamma(x+1), 0)
    },
    thetaRange: (p) => [Math.max(0.1, p.lambda*0.2), p.lambda*2.5],
    thetaLabel: 'λ',
    sample: (p,n) => {
      const L = Math.exp(-p.lambda)
      return Array.from({length:n}, () => {
        let k=0, prob=1
        do { k++; prob*=Math.random() } while(prob>L)
        return k-1
      })
    },
    mleCompute: (data) => data.reduce((s,x)=>s+x,0)/data.length,
  },
  bernoulli: {
    name: 'Bernoulli (p)',
    params: [
      { key:'p', label:'p (success prob)', min:0.05, max:0.95, step:0.01, default:0.4 },
    ],
    fisherInfo: (p) => 1 / (p.p * (1-p.p)),
    crlb: (p,n) => p.p*(1-p.p) / n,
    mleFormula: 'p̂ = X̄ (sample proportion)',
    fisherFormula: 'I(p) = 1/[p(1−p)]',
    crlbFormula: 'CRLB = p(1−p)/n',
    sufficiency: 'T = Σxᵢ is complete sufficient. p̂ = X̄ is UMVUE for p.',
    logLik: (data, theta) => {
      if(theta<=0||theta>=1) return -Infinity
      return data.reduce((s,x) => s + x*Math.log(theta)+(1-x)*Math.log(1-theta), 0)
    },
    thetaRange: () => [0.01, 0.99],
    thetaLabel: 'p',
    sample: (p,n) => Array.from({length:n}, () => Math.random()<p.p?1:0),
    mleCompute: (data) => data.reduce((s,x)=>s+x,0)/data.length,
  },
  gamma: {
    name: 'Gamma (α fixed, β)',
    params: [
      { key:'alpha', label:'α (shape, fixed)', min:1, max:8, step:0.5, default:2 },
      { key:'beta', label:'β (rate)', min:0.2, max:5, step:0.1, default:1 },
    ],
    fisherInfo: (p) => p.alpha / (p.beta**2),
    crlb: (p,n) => p.beta**2 / (n*p.alpha),
    mleFormula: 'β̂ = α/X̄',
    fisherFormula: 'I(β) = α/β²',
    crlbFormula: 'CRLB = β²/(nα)',
    sufficiency: 'T = Σxᵢ is sufficient for β. β̂ = α/X̄ is UMVUE.',
    logLik: (data, theta, p) => {
      if(theta<=0) return -Infinity
      return data.reduce((s,x) => s + (p.alpha-1)*Math.log(x)-theta*x+p.alpha*Math.log(theta)-lgamma(p.alpha), 0)
    },
    thetaRange: (p) => [p.beta*0.15, p.beta*3.5],
    thetaLabel: 'β',
    sample: (p,n) => Array.from({length:n}, () => rgamma(p.alpha, p.beta)),
    mleCompute: (data, p) => p.alpha / (data.reduce((s,x)=>s+x,0)/data.length),
  },
  uniform: {
    name: 'Uniform (0, θ)',
    params: [
      { key:'theta', label:'θ (upper bound)', min:0.5, max:5, step:0.1, default:2 },
    ],
    fisherInfo: (p) => 1 / (p.theta**2),
    crlb: (p,n) => p.theta**2 / n,
    mleFormula: 'θ̂ = X_(n) (sample maximum)',
    fisherFormula: 'I(θ) = 1/θ² (non-regular)',
    crlbFormula: 'CRLB = θ²/n (non-regular; MLE variance = θ²/(n(n+2)))',
    sufficiency: 'T = X_(n) is complete sufficient. MLE is biased: E[X_(n)] = nθ/(n+1).',
    logLik: (data, theta) => {
      const maxD = Math.max(...data)
      if(theta<maxD) return -Infinity
      return -data.length*Math.log(theta)
    },
    thetaRange: (p) => [p.theta*0.5, p.theta*2.0],
    thetaLabel: 'θ',
    sample: (p,n) => Array.from({length:n}, () => Math.random()*p.theta),
    mleCompute: (data) => Math.max(...data),
  },
}

// ── SVG Log-likelihood plot ────────────────────────────────────────────────────

function LogLikPlot({
  logLikFn, thetaRange, mle, trueTheta, thetaLabel,
}: {
  logLikFn: (t: number) => number
  thetaRange: [number,number]
  mle: number | null
  trueTheta: number
  thetaLabel: string
}) {
  const W = 500, H = 200, PL = 48, PR = 16, PT = 12, PB = 36

  const pts = useMemo(() => {
    const n = 200
    const [lo, hi] = thetaRange
    return Array.from({length: n}, (_, i) => {
      const t = lo + (hi-lo)*i/(n-1)
      return { t, ll: logLikFn(t) }
    }).filter(p => isFinite(p.ll))
  }, [logLikFn, thetaRange])

  if (!pts.length) return null

  const xMin = thetaRange[0], xMax = thetaRange[1]
  const llMin = Math.min(...pts.map(p=>p.ll))
  const llMax = Math.max(...pts.map(p=>p.ll))
  const llRange = llMax - llMin || 1
  const yLo = llMax - 3.5*llRange
  const yHi = llMax + 0.3*llRange

  const pw = W - PL - PR, ph = H - PT - PB
  const sx = (t: number) => PL + (t - xMin)/(xMax - xMin) * pw
  const sy = (ll: number) => PT + (1 - (ll - yLo)/(yHi - yLo)) * ph

  const pathD = pts.filter(p => p.ll >= yLo).reduce((acc, p, i) => {
    const x = sx(p.t), y = sy(p.ll)
    return acc + (i === 0 ? `M${x.toFixed(1)},${y.toFixed(1)}` : ` L${x.toFixed(1)},${y.toFixed(1)}`)
  }, '')

  // Axis ticks
  const xTicks = 5
  const yTicks = 4

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* Grid */}
      {Array.from({length: yTicks+1}, (_,i) => {
        const y = PT + i * ph/yTicks
        return <line key={i} x1={PL} y1={y} x2={PL+pw} y2={y} stroke="var(--color-border)" strokeWidth="0.5" />
      })}
      {/* Curve */}
      <path d={pathD} fill="none" stroke="var(--color-accent)" strokeWidth="2" />
      {/* True param line */}
      {isFinite(sx(trueTheta)) && (
        <>
          <line x1={sx(trueTheta)} y1={PT} x2={sx(trueTheta)} y2={PT+ph}
            stroke="var(--color-text-muted)" strokeWidth="1" strokeDasharray="3,3" />
          <text x={sx(trueTheta)+3} y={PT+10} fontSize="9" fill="var(--color-text-muted)">true</text>
        </>
      )}
      {/* MLE line */}
      {mle !== null && isFinite(sx(mle)) && (
        <>
          <line x1={sx(mle)} y1={PT} x2={sx(mle)} y2={PT+ph}
            stroke="#c0392b" strokeWidth="1.5" strokeDasharray="4,3" />
          <text x={sx(mle)+3} y={PT+20} fontSize="9" fill="#c0392b">MLE</text>
          <circle cx={sx(mle)} cy={sy(logLikFn(mle))} r="3.5" fill="#c0392b" />
        </>
      )}
      {/* X axis */}
      <line x1={PL} y1={PT+ph} x2={PL+pw} y2={PT+ph} stroke="var(--color-border-strong)" strokeWidth="1" />
      <line x1={PL} y1={PT} x2={PL} y2={PT+ph} stroke="var(--color-border-strong)" strokeWidth="1" />
      {Array.from({length: xTicks+1}, (_,i) => {
        const t = xMin + (xMax-xMin)*i/xTicks
        const x = sx(t)
        return (
          <g key={i}>
            <line x1={x} y1={PT+ph} x2={x} y2={PT+ph+4} stroke="var(--color-border-strong)" strokeWidth="1" />
            <text x={x} y={PT+ph+13} textAnchor="middle" fontSize="9" fill="var(--color-text-muted)">{t.toFixed(2)}</text>
          </g>
        )
      })}
      <text x={PL+pw/2} y={H-2} textAnchor="middle" fontSize="10" fill="var(--color-text-muted)">{thetaLabel}</text>
      <text x={10} y={PT+ph/2} textAnchor="middle" fontSize="10" fill="var(--color-text-muted)"
        transform={`rotate(-90,10,${PT+ph/2})`}>log L</text>
    </svg>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function CramerRaoExplorer() {
  const [distKey, setDistKey] = useState('normal')
  const [params, setParams] = useState<Record<string,number>>({mu:0, sigma:1})
  const [n, setN] = useState(30)
  const [sample, setSample] = useState<number[]>([])

  const dist = DISTS[distKey]

  function switchDist(key: string) {
    setDistKey(key)
    const def: Record<string,number> = {}
    DISTS[key].params.forEach(p => { def[p.key] = p.default })
    setParams(def)
    setSample([])
  }

  function setParam(key: string, val: number) {
    setParams(prev => ({...prev, [key]: val}))
  }

  const fisher = dist.fisherInfo(params)
  const crlb = dist.crlb(params, n)
  const mle = sample.length > 0 ? dist.mleCompute(sample, params) : null
  const trueTheta = params[dist.params[0].key]

  const logLikFn = useMemo(
    () => (theta: number) => dist.logLik(sample.length > 0 ? sample : [trueTheta], theta, params),
    [dist, sample, params, trueTheta]
  )

  function drawSample() {
    setSample(dist.sample(params, n))
  }

  return (
    <div className="flex h-full min-h-0 text-xs" style={{ fontFamily: 'var(--font-inter, system-ui, sans-serif)' }}>

      {/* Left panel */}
      <div className="flex flex-col w-52 shrink-0 border-r border-border bg-elevated overflow-y-auto">

        {/* Distribution selector */}
        <div className="px-3 pt-3 pb-2">
          <p className="label-xs mb-2">Distribution</p>
          <div className="space-y-0.5">
            {Object.entries(DISTS).map(([key, d]) => (
              <button key={key} onClick={() => switchDist(key)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs transition-colors truncate ${
                  distKey===key ? 'bg-accent-light text-accent font-medium' : 'text-text-secondary hover:bg-border/50'
                }`}
              >{d.name}</button>
            ))}
          </div>
        </div>

        <div className="mx-3 border-t border-border" />

        {/* Parameter sliders */}
        <div className="px-3 py-2">
          <p className="label-xs mb-2">Parameters</p>
          {dist.params.map(ps => (
            <div key={ps.key} className="mb-2.5">
              <div className="flex justify-between mb-0.5">
                <span className="font-mono text-text-muted">{ps.label}</span>
                <span className="font-mono text-text-secondary tabular-nums">
                  {(params[ps.key] ?? ps.default).toFixed(ps.step < 0.1 ? 3 : 2)}
                </span>
              </div>
              <input type="range" min={ps.min} max={ps.max} step={ps.step}
                value={params[ps.key] ?? ps.default}
                onChange={e => setParam(ps.key, parseFloat(e.target.value))}
                className="w-full h-1 cursor-pointer accent-accent"
              />
            </div>
          ))}
        </div>

        <div className="mx-3 border-t border-border" />

        {/* Sample size */}
        <div className="px-3 py-2">
          <p className="label-xs mb-2">Sample size n = {n}</p>
          <input type="range" min={5} max={200} step={5} value={n}
            onChange={e => setN(parseInt(e.target.value))}
            className="w-full h-1 cursor-pointer accent-accent"
          />
          <button onClick={drawSample}
            className="mt-2 w-full py-1.5 rounded border border-border bg-surface text-text-secondary hover:bg-elevated transition-colors text-xs font-medium"
          >
            Draw sample
          </button>
          {sample.length > 0 && (
            <p className="mt-1 text-text-muted text-[10px]">n={sample.length} drawn</p>
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 p-4 border-b border-border">
          <div className="rounded-md bg-elevated border border-border px-3 py-2">
            <p className="label-xs mb-1">Fisher Information</p>
            <p className="font-mono text-base text-accent">{fisher.toFixed(5)}</p>
            <p className="text-text-muted text-[10px] mt-0.5 font-mono">{dist.fisherFormula}</p>
          </div>
          <div className="rounded-md bg-elevated border border-border px-3 py-2">
            <p className="label-xs mb-1">CR Lower Bound</p>
            <p className="font-mono text-base text-accent">{crlb.toFixed(6)}</p>
            <p className="text-text-muted text-[10px] mt-0.5 font-mono">{dist.crlbFormula}</p>
          </div>
          <div className="rounded-md bg-elevated border border-border px-3 py-2">
            <p className="label-xs mb-1">MLE</p>
            <p className="font-mono text-base text-accent">
              {mle !== null ? mle.toFixed(4) : '—'}
            </p>
            <p className="text-text-muted text-[10px] mt-0.5 font-mono">{dist.mleFormula}</p>
          </div>
        </div>

        {/* Log-likelihood plot */}
        <div className="p-4 border-b border-border">
          <p className="label-xs mb-2">Log-Likelihood  ℓ(θ; data)</p>
          <div className="bg-surface rounded-md border border-border p-2 overflow-hidden">
            <LogLikPlot
              logLikFn={logLikFn}
              thetaRange={dist.thetaRange(params)}
              mle={mle}
              trueTheta={trueTheta}
              thetaLabel={dist.thetaLabel}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-text-muted text-center">
            Dashed red = MLE · Dashed grey = true θ · Draw a sample to see empirical log-likelihood
          </p>
        </div>

        {/* Sufficiency info */}
        <div className="p-4">
          <p className="label-xs mb-2">Sufficiency & UMVUE</p>
          <p className="text-xs text-text-secondary leading-relaxed">{dist.sufficiency}</p>

          {/* Efficiency bar */}
          {mle !== null && (
            <div className="mt-3 rounded-md bg-elevated border border-border px-3 py-2.5">
              <p className="label-xs mb-1.5">Effective information used</p>
              <div className="h-2 bg-border rounded-full overflow-hidden">
                <div className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{ width: '100%' }}
                />
              </div>
              <p className="text-[10px] text-text-muted mt-1">
                MLE is asymptotically efficient — achieves CRLB as n→∞
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
