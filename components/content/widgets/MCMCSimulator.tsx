'use client'

import { useState, useCallback, useRef } from 'react'

// ── Log-target distributions ──────────────────────────────────────────────────

type TargetId = 'gaussian' | 'bimodal' | 'cauchy' | 'funnel'

interface TargetParams { mu: number; sigma: number; sep: number }

function logTarget(id: TargetId, x: number, p: TargetParams): number {
  switch (id) {
    case 'gaussian':
      return -0.5 * ((x - p.mu) / p.sigma) ** 2
    case 'bimodal': {
      const h = p.sep / 2
      const l1 = -0.5 * ((x - h) / p.sigma) ** 2
      const l2 = -0.5 * ((x + h) / p.sigma) ** 2
      const lmax = Math.max(l1, l2)
      return lmax + Math.log(Math.exp(l1 - lmax) + Math.exp(l2 - lmax)) - Math.log(2)
    }
    case 'cauchy':
      return -Math.log(1 + ((x - p.mu) / p.sigma) ** 2)
    case 'funnel':
      // Log-normal envelope: heavier right tail
      return x > 0 ? -((Math.log(x) - p.mu) ** 2) / (2 * p.sigma ** 2) - Math.log(x) : -Infinity
  }
}

// ── Metropolis-Hastings ───────────────────────────────────────────────────────

interface MCMCResult {
  chain: number[]
  accepted: number
}

function runMH(
  n: number,
  proposalSd: number,
  targetId: TargetId,
  params: TargetParams,
  seed0: number,
): MCMCResult {
  const chain = new Array<number>(n)
  chain[0] = seed0
  let accepted = 0
  let lCurrent = logTarget(targetId, seed0, params)

  // Simple LCG for reproducibility
  for (let i = 1; i < n; i++) {
    // Box-Muller proposal
    const u1 = Math.random(), u2 = Math.random()
    const z = Math.sqrt(-2 * Math.log(Math.max(u1, 1e-15))) * Math.cos(2 * Math.PI * u2)
    const proposal = chain[i - 1] + proposalSd * z
    const lProposal = logTarget(targetId, proposal, params)
    const logAlpha = lProposal - lCurrent
    if (Math.log(Math.random()) < logAlpha) {
      chain[i] = proposal
      lCurrent = lProposal
      accepted++
    } else {
      chain[i] = chain[i - 1]
    }
  }
  return { chain, accepted }
}

// ── ACF computation ───────────────────────────────────────────────────────────

function computeACF(chain: number[], maxLag: number): number[] {
  const n = chain.length
  const mean = chain.reduce((s, x) => s + x, 0) / n
  const demeaned = chain.map(x => x - mean)
  const var0 = demeaned.reduce((s, x) => s + x * x, 0) / n
  if (var0 < 1e-12) return new Array(maxLag + 1).fill(0)
  return Array.from({ length: maxLag + 1 }, (_, lag) => {
    let cov = 0
    for (let i = 0; i < n - lag; i++) cov += demeaned[i] * demeaned[i + lag]
    return cov / ((n - lag) * var0)
  })
}

function computeESS(acf: number[]): number {
  let sum = 0
  for (let k = 1; k < acf.length; k++) {
    if (acf[k] < 0.05) break
    sum += acf[k]
  }
  return acf.length > 0 ? Math.round((acf.length - 1) / (1 + 2 * sum)) : 0
}

// ── Histogram ────────────────────────────────────────────────────────────────

function histogram(data: number[], lo: number, hi: number, bins: number): number[] {
  const counts = new Array(bins).fill(0)
  const bw = (hi - lo) / bins
  for (const x of data) {
    const b = Math.floor((x - lo) / bw)
    if (b >= 0 && b < bins) counts[b]++
  }
  return counts
}

// ── SVG layout ────────────────────────────────────────────────────────────────

const VW = 520, VH = 180
const PAD = { top: 20, right: 20, bottom: 36, left: 44 }
const PW = VW - PAD.left - PAD.right
const PH = VH - PAD.top - PAD.bottom

const TRACE_W = 520, TRACE_H = 100
const TP = { top: 10, right: 20, bottom: 22, left: 44 }
const TPW = TRACE_W - TP.left - TP.right
const TPH = TRACE_H - TP.top - TP.bottom

function sx(x: number, xMin: number, xMax: number) {
  return PAD.left + ((x - xMin) / (xMax - xMin)) * PW
}
function sy(y: number, yMax: number) {
  return PAD.top + (1 - y / yMax) * PH
}

// ── Target metadata ───────────────────────────────────────────────────────────

const TARGETS: { id: TargetId; label: string; color: string; xMin: number; xMax: number }[] = [
  { id: 'gaussian', label: 'Gaussian',        color: '#4E79A7', xMin: -4,  xMax: 4  },
  { id: 'bimodal',  label: 'Bimodal',         color: '#59A14F', xMin: -6,  xMax: 6  },
  { id: 'cauchy',   label: 'Cauchy (heavy)',  color: '#E15759', xMin: -8,  xMax: 8  },
  { id: 'funnel',   label: 'Log-Normal',      color: '#9467BD', xMin: 0.01,xMax: 6  },
]

// ── Component ─────────────────────────────────────────────────────────────────

const N_SAMPLES = 4000
const BURN_IN   = 500
const MAX_LAG   = 60
const HIST_BINS = 40

export function MCMCSimulator() {
  const [targetId,    setTargetId]    = useState<TargetId>('bimodal')
  const [proposalSd,  setProposalSd]  = useState(1.0)
  const [sep,         setSep]         = useState(3.0)
  const [sigma,       setSigma]       = useState(1.0)
  const [tab,         setTab]         = useState<'trace' | 'hist' | 'acf'>('hist')
  const [result,      setResult]      = useState<MCMCResult | null>(null)
  const [running,     setRunning]     = useState(false)

  const targetMeta = TARGETS.find(t => t.id === targetId)!
  const params: TargetParams = { mu: 0, sigma, sep }

  const runChain = useCallback(() => {
    setRunning(true)
    setTimeout(() => {
      const r = runMH(N_SAMPLES, proposalSd, targetId, params, 0)
      setResult(r)
      setRunning(false)
    }, 0)
  }, [targetId, proposalSd, params])

  const postChain = result ? result.chain.slice(BURN_IN) : []
  const acceptRate = result ? (result.accepted / (N_SAMPLES - 1) * 100).toFixed(1) : '—'
  const acf = postChain.length > 0 ? computeACF(postChain, MAX_LAG) : []
  const ess = acf.length > 0 ? computeESS(acf) : 0

  const { xMin, xMax } = targetMeta
  const counts = postChain.length > 0 ? histogram(postChain, xMin, xMax, HIST_BINS) : []
  const maxCount = counts.length ? Math.max(...counts) : 1
  const binW = (xMax - xMin) / HIST_BINS

  // True density (unnormalized, for overlay)
  const N_DENSE = 200
  const denseTicks = Array.from({ length: N_DENSE }, (_, i) => xMin + (xMax - xMin) * i / (N_DENSE - 1))
  const logVals = denseTicks.map(x => logTarget(targetId, x, params))
  const logMax = Math.max(...logVals.filter(isFinite))
  const densVals = logVals.map(lv => Math.exp(lv - logMax))
  // Scale to match histogram height
  const dxSum = densVals.reduce((s, v) => s + v, 0) * (xMax - xMin) / N_DENSE
  const normFactor = postChain.length * binW / dxSum
  const scaledDens = densVals.map(v => v * normFactor)
  const densMax = Math.max(...scaledDens, maxCount)

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, userSelect: 'none' }}>
      {/* Target selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
        {TARGETS.map(t => (
          <button key={t.id} onClick={() => { setTargetId(t.id); setResult(null) }} style={{
            padding: '4px 12px', borderRadius: 4, border: `1.5px solid ${t.color}`,
            background: targetId === t.id ? t.color : 'transparent',
            color: targetId === t.id ? '#fff' : t.color,
            cursor: 'pointer', fontSize: 12,
          }}>{t.label}</button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {(['hist', 'trace', 'acf'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '3px 12px', borderRadius: 4, border: 'none', cursor: 'pointer',
            background: tab === t ? '#555' : '#ddd',
            color: tab === t ? '#fff' : '#444', fontSize: 12,
          }}>{t === 'hist' ? 'Histogram' : t === 'trace' ? 'Trace' : 'ACF'}</button>
        ))}
      </div>

      {/* Main plot */}
      {tab === 'hist' && (
        <svg width={VW} height={VH} viewBox={`0 0 ${VW} ${VH}`}
          style={{ display: 'block', background: '#fafafa', borderRadius: 6, border: '1px solid #e0e0e0' }}>
          <defs>
            <clipPath id="mcmc-hist-clip">
              <rect x={PAD.left} y={PAD.top} width={PW} height={PH} />
            </clipPath>
          </defs>
          {/* Axes */}
          <line x1={PAD.left} x2={PAD.left + PW} y1={PAD.top + PH} y2={PAD.top + PH} stroke="#999" />
          <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + PH} stroke="#999" />
          <text x={PAD.left + PW / 2} y={VH - 2} textAnchor="middle" fill="#666" fontSize={10}>x</text>
          {[xMin, 0, xMax].map(v => (
            <text key={v} x={sx(v, xMin, xMax)} y={PAD.top + PH + 14} textAnchor="middle" fill="#666" fontSize={10}>
              {v.toFixed(1)}
            </text>
          ))}

          <g clipPath="url(#mcmc-hist-clip)">
            {/* Histogram bars */}
            {counts.map((c, i) => {
              const bx = sx(xMin + i * binW, xMin, xMax)
              const bw = PW / HIST_BINS
              const bh = (c / densMax) * PH
              return <rect key={i} x={bx} y={PAD.top + PH - bh} width={bw - 1} height={bh}
                fill={targetMeta.color} opacity={0.5} />
            })}
            {/* True density overlay */}
            {postChain.length > 0 && (
              <polyline
                points={denseTicks.map((x, i) =>
                  `${sx(x, xMin, xMax).toFixed(1)},${sy(scaledDens[i], densMax).toFixed(1)}`
                ).join(' ')}
                fill="none" stroke={targetMeta.color} strokeWidth={2} />
            )}
          </g>

          {postChain.length === 0 && (
            <text x={PAD.left + PW / 2} y={PAD.top + PH / 2 + 6} textAnchor="middle" fill="#bbb" fontSize={13}>
              Press &quot;Run chain&quot; to sample
            </text>
          )}
          <rect x={PAD.left} y={PAD.top} width={PW} height={PH} fill="none" stroke="#ccc" />
        </svg>
      )}

      {tab === 'trace' && (
        <TraceView chain={postChain} color={targetMeta.color} xMin={xMin} xMax={xMax} />
      )}

      {tab === 'acf' && (
        <ACFView acf={acf} color={targetMeta.color} maxLag={MAX_LAG} />
      )}

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 24, marginTop: 10, fontSize: 12 }}>
        <Stat label="Acceptance rate" value={`${acceptRate}%`} note="Ideal: 23–44%" />
        <Stat label="ESS" value={ess > 0 ? String(ess) : '—'}
          note={`of ${postChain.length} post-burn samples`} />
        <Stat label="Burn-in" value={String(BURN_IN)} note="samples discarded" />
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 12, alignItems: 'flex-end' }}>
        <SliderRow label={`Proposal σ = ${proposalSd.toFixed(2)}`}
          min={0.05} max={5} step={0.05} value={proposalSd} onChange={setProposalSd} color={targetMeta.color} />
        {targetId === 'bimodal' && (
          <SliderRow label={`Mode separation = ${sep.toFixed(1)}`}
            min={1} max={6} step={0.1} value={sep} onChange={setSep} color={targetMeta.color} />
        )}
        <SliderRow label={`Target σ = ${sigma.toFixed(2)}`}
          min={0.2} max={3} step={0.05} value={sigma} onChange={setSigma} color={targetMeta.color} />
        <button onClick={runChain} disabled={running} style={{
          padding: '6px 18px', borderRadius: 4, border: 'none',
          background: running ? '#aaa' : targetMeta.color,
          color: '#fff', cursor: running ? 'default' : 'pointer',
          fontSize: 13, fontWeight: 600,
        }}>{running ? 'Running…' : 'Run chain'}</button>
      </div>

      <div style={{ marginTop: 12, background: '#f5f5f5', borderRadius: 6,
        padding: '10px 14px', fontSize: 12, color: '#444', lineHeight: 1.6 }}>
        <strong>Metropolis-Hastings:</strong> Propose x′ ~ N(x, σ²_prop). Accept with probability
        α = min(1, π(x′)/π(x)). Uses log-probabilities for numerical stability.
        Too-small σ_prop → high acceptance, slow mixing. Too-large → low acceptance, slow mixing.
        Optimal for Gaussian target: acceptance ≈ 23.4%.
      </div>
    </div>
  )
}

// ── Trace plot ────────────────────────────────────────────────────────────────

function TraceView({ chain, color, xMin, xMax }: {
  chain: number[]; color: string; xMin: number; xMax: number
}) {
  const N = Math.min(chain.length, 800)
  const sub = chain.slice(0, N)
  const yMin = Math.max(xMin, Math.min(...sub))
  const yMax = Math.min(xMax, Math.max(...sub))
  const yRange = Math.max(yMax - yMin, 0.1)

  const pts = sub.map((v, i) => {
    const cx = TP.left + (i / (N - 1)) * TPW
    const cy = TP.top + (1 - (v - yMin) / yRange) * TPH
    return `${cx.toFixed(1)},${cy.toFixed(1)}`
  }).join(' ')

  return (
    <svg width={TRACE_W} height={TRACE_H} viewBox={`0 0 ${TRACE_W} ${TRACE_H}`}
      style={{ display: 'block', background: '#fafafa', borderRadius: 6, border: '1px solid #e0e0e0' }}>
      <defs>
        <clipPath id="trace-clip">
          <rect x={TP.left} y={TP.top} width={TPW} height={TPH} />
        </clipPath>
      </defs>
      <line x1={TP.left} x2={TP.left + TPW} y1={TP.top + TPH} y2={TP.top + TPH} stroke="#ccc" />
      <text x={TP.left - 6} y={TP.top + 4} textAnchor="end" fill="#666" fontSize={9}>{yMax.toFixed(1)}</text>
      <text x={TP.left - 6} y={TP.top + TPH + 4} textAnchor="end" fill="#666" fontSize={9}>{yMin.toFixed(1)}</text>
      <text x={TP.left + TPW / 2} y={TRACE_H - 2} textAnchor="middle" fill="#666" fontSize={9}>
        iteration (first {N} post-burn)
      </text>
      <g clipPath="url(#trace-clip)">
        {chain.length > 0 && (
          <polyline points={pts} fill="none" stroke={color} strokeWidth={0.8} opacity={0.8} />
        )}
        {chain.length === 0 && (
          <text x={TP.left + TPW / 2} y={TP.top + TPH / 2 + 4}
            textAnchor="middle" fill="#bbb" fontSize={12}>Run chain first</text>
        )}
      </g>
      <rect x={TP.left} y={TP.top} width={TPW} height={TPH} fill="none" stroke="#ccc" />
    </svg>
  )
}

// ── ACF plot ──────────────────────────────────────────────────────────────────

function ACFView({ acf, color, maxLag }: { acf: number[]; color: string; maxLag: number }) {
  const H = 160
  const P = { top: 16, right: 20, bottom: 30, left: 44 }
  const pw = VW - P.left - P.right
  const ph = H - P.top - P.bottom
  const barW = pw / (maxLag + 1) - 1

  function acfY(v: number) { return P.top + (1 - (v + 0.1) / 1.1) * ph }

  return (
    <svg width={VW} height={H} viewBox={`0 0 ${VW} ${H}`}
      style={{ display: 'block', background: '#fafafa', borderRadius: 6, border: '1px solid #e0e0e0' }}>
      <defs>
        <clipPath id="acf-clip">
          <rect x={P.left} y={P.top} width={pw} height={ph} />
        </clipPath>
      </defs>
      {/* Zero line */}
      <line x1={P.left} x2={P.left + pw} y1={acfY(0)} y2={acfY(0)} stroke="#aaa" strokeDasharray="3,2" />
      {/* 95% CI line */}
      {acf.length > 0 && (
        <line x1={P.left} x2={P.left + pw}
          y1={acfY(1.96 / Math.sqrt(acf.length))} y2={acfY(1.96 / Math.sqrt(acf.length))}
          stroke="#E15759" strokeDasharray="4,3" strokeWidth={1} />
      )}
      {[-0.5, 0, 0.5, 1].map(v => (
        <text key={v} x={P.left - 6} y={acfY(v) + 4} textAnchor="end" fill="#666" fontSize={9}>
          {v.toFixed(1)}
        </text>
      ))}
      <text x={P.left + pw / 2} y={H - 2} textAnchor="middle" fill="#666" fontSize={9}>Lag</text>

      <g clipPath="url(#acf-clip)">
        {acf.map((v, lag) => {
          const bx = P.left + lag * (pw / (maxLag + 1))
          const zero = acfY(0)
          const yv = acfY(v)
          return <rect key={lag} x={bx} y={Math.min(yv, zero)} width={Math.max(barW, 1)}
            height={Math.abs(zero - yv)} fill={color} opacity={0.7} />
        })}
        {acf.length === 0 && (
          <text x={P.left + pw / 2} y={P.top + ph / 2 + 4}
            textAnchor="middle" fill="#bbb" fontSize={12}>Run chain first</text>
        )}
      </g>
      <rect x={P.left} y={P.top} width={pw} height={ph} fill="none" stroke="#ccc" />
    </svg>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div>
      <div style={{ color: '#666', fontSize: 11 }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: 16 }}>{value}</div>
      <div style={{ color: '#aaa', fontSize: 10 }}>{note}</div>
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
