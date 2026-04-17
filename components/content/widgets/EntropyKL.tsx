'use client'

import { useState, useMemo } from 'react'

// ── Distributions ─────────────────────────────────────────────────────────────

type DistId = 'gaussian' | 'laplace' | 'uniform'

interface DistParams { mu: number; sigma: number; a: number; b: number }

function pdf(id: DistId, x: number, p: DistParams): number {
  switch (id) {
    case 'gaussian': {
      const z = (x - p.mu) / p.sigma
      return Math.exp(-0.5 * z * z) / (p.sigma * Math.sqrt(2 * Math.PI))
    }
    case 'laplace':
      return Math.exp(-Math.abs(x - p.mu) / p.sigma) / (2 * p.sigma)
    case 'uniform':
      return (x >= p.a && x <= p.b) ? 1 / (p.b - p.a) : 0
  }
}

// Analytic entropy (nats)
function analyticH(id: DistId, p: DistParams): number | null {
  switch (id) {
    case 'gaussian': return 0.5 * (1 + Math.log(2 * Math.PI * p.sigma * p.sigma))
    case 'laplace':  return 1 + Math.log(2 * p.sigma)
    case 'uniform':  return p.b > p.a ? Math.log(p.b - p.a) : null
  }
}

// Analytic KL(P||Q) for same-family Gaussians
function analyticKL_GG(pmu: number, ps: number, qmu: number, qs: number): number {
  return Math.log(qs / ps) + (ps * ps + (pmu - qmu) ** 2) / (2 * qs * qs) - 0.5
}

// ── Numerical integration ─────────────────────────────────────────────────────

const N_INT = 600

function numericalKL(
  pid: DistId, pp: DistParams,
  qid: DistId, qp: DistParams,
  lo: number, hi: number,
): number {
  const dx = (hi - lo) / N_INT
  let kl = 0
  for (let i = 0; i < N_INT; i++) {
    const x = lo + (i + 0.5) * dx
    const p = pdf(pid, x, pp), q = pdf(qid, x, qp)
    if (p > 1e-15 && q > 1e-15) kl += p * Math.log(p / q) * dx
    else if (p > 1e-15 && q <= 1e-15) return Infinity
  }
  return Math.max(kl, 0)
}

function numericalH(id: DistId, p: DistParams, lo: number, hi: number): number {
  const dx = (hi - lo) / N_INT
  let h = 0
  for (let i = 0; i < N_INT; i++) {
    const x = lo + (i + 0.5) * dx
    const pv = pdf(id, x, p)
    if (pv > 1e-15) h -= pv * Math.log(pv) * dx
  }
  return h
}

// Pointwise KL integrand p(x) log(p(x)/q(x)) on a grid
function klPointwise(
  pid: DistId, pp: DistParams,
  qid: DistId, qp: DistParams,
  xs: number[],
): number[] {
  return xs.map(x => {
    const p = pdf(pid, x, pp), q = pdf(qid, x, qp)
    if (p < 1e-15) return 0
    if (q < 1e-15) return Infinity
    return p * Math.log(p / q)
  })
}

// Jensen-Shannon divergence (always finite and symmetric)
function jsd(pid: DistId, pp: DistParams, qid: DistId, qp: DistParams, lo: number, hi: number): number {
  const dx = (hi - lo) / N_INT
  let d = 0
  for (let i = 0; i < N_INT; i++) {
    const x = lo + (i + 0.5) * dx
    const p = pdf(pid, x, pp), q = pdf(qid, x, qp)
    const m = (p + q) / 2
    if (p > 1e-15 && m > 1e-15) d += p * Math.log(p / m) * dx * 0.5
    if (q > 1e-15 && m > 1e-15) d += q * Math.log(q / m) * dx * 0.5
  }
  return Math.max(d, 0)
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

const VW = 520
const PH1 = 150, PH2 = 110
const PAD = { top: 18, right: 22, bottom: 22, left: 52 }
const PW = VW - PAD.left - PAD.right

function sx(x: number, lo: number, hi: number): number {
  return PAD.left + ((x - lo) / (hi - lo)) * PW
}

function syDens(y: number, yMax: number, height: number): number {
  return PAD.top + (1 - y / yMax) * (height - PAD.top - PAD.bottom)
}

// ── Distribution controls ─────────────────────────────────────────────────────

const DISTS: { id: DistId; label: string }[] = [
  { id: 'gaussian', label: 'Gaussian' },
  { id: 'laplace',  label: 'Laplace'  },
  { id: 'uniform',  label: 'Uniform'  },
]

function defaultParams(id: DistId): DistParams {
  switch (id) {
    case 'gaussian': return { mu: 0, sigma: 1, a: -1, b: 1 }
    case 'laplace':  return { mu: 0, sigma: 1, a: -1, b: 1 }
    case 'uniform':  return { mu: 0, sigma: 1, a: -2, b: 2 }
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

const COLOR_P = '#4E79A7'
const COLOR_Q = '#E15759'
const COLOR_POS = '#59A14F'
const COLOR_NEG = '#E15759'

export function EntropyKL() {
  const [pId,  setPId]  = useState<DistId>('gaussian')
  const [qId,  setQId]  = useState<DistId>('gaussian')
  const [pMu,  setPMu]  = useState(0.0)
  const [pSig, setPSig] = useState(1.0)
  const [qMu,  setQMu]  = useState(1.5)
  const [qSig, setQSig] = useState(1.0)
  const [pA,   setPA]   = useState(-2.0)
  const [pB,   setPB]   = useState(2.0)
  const [qA,   setQA]   = useState(-1.0)
  const [qB,   setQB]   = useState(3.0)
  const [tab,  setTab]  = useState<'density' | 'kl' | 'entropy'>('density')
  const [showQ2P, setShowQ2P] = useState(false)

  const pp: DistParams = { mu: pMu, sigma: Math.max(pSig, 0.05), a: pA, b: Math.max(pB, pA + 0.1) }
  const qp: DistParams = { mu: qMu, sigma: Math.max(qSig, 0.05), a: qA, b: Math.max(qB, qA + 0.1) }

  const { lo, hi, xs, pyVals, qyVals, klPQ, klQP, jsdVal, hP, hQ, klPtwise, klPtwiseQP } = useMemo(() => {
    // Compute integration range covering both distributions
    const pCenter = pId==='uniform' ? (pp.a+pp.b)/2 : pp.mu
    const qCenter = qId==='uniform' ? (qp.a+qp.b)/2 : qp.mu
    const pSpread = pId==='uniform' ? (pp.b-pp.a) : 5*pp.sigma
    const qSpread = qId==='uniform' ? (qp.b-qp.a) : 5*qp.sigma
    const lo = Math.min(pCenter-pSpread, qCenter-qSpread) - 0.5
    const hi = Math.max(pCenter+pSpread, qCenter+qSpread) + 0.5

    const N = 300
    const xs = Array.from({ length: N }, (_, i) => lo + (hi - lo) * i / (N - 1))
    const pyVals = xs.map(x => pdf(pId, x, pp))
    const qyVals = xs.map(x => pdf(qId, x, qp))

    const klPQ   = numericalKL(pId, pp, qId, qp, lo, hi)
    const klQP   = numericalKL(qId, qp, pId, pp, lo, hi)
    const jsdVal = jsd(pId, pp, qId, qp, lo, hi)
    const hP     = numericalH(pId, pp, lo, hi)
    const hQ     = numericalH(qId, qp, lo, hi)

    const klPtwise   = klPointwise(pId, pp, qId, qp, xs)
    const klPtwiseQP = klPointwise(qId, qp, pId, pp, xs)

    return { lo, hi, xs, pyVals, qyVals, klPQ, klQP, jsdVal, hP, hQ, klPtwise, klPtwiseQP }
  }, [pId, qId, pMu, pSig, qMu, qSig, pA, pB, qA, qB])

  const densMax = Math.max(...pyVals, ...qyVals) * 1.15
  const klVals  = showQ2P ? klPtwiseQP : klPtwise
  const klMax   = Math.max(...klVals.filter(isFinite), 0.01)
  const klMin   = Math.min(...klVals.filter(isFinite), -0.001)
  const klRange = Math.max(klMax, Math.abs(klMin)) * 1.2

  const analH_P = analyticH(pId, pp)
  const analH_Q = analyticH(qId, qp)
  const analKL  = pId==='gaussian' && qId==='gaussian'
    ? analyticKL_GG(pp.mu, pp.sigma, qp.mu, qp.sigma) : null

  function ptsLine(xs: number[], ys: number[], yMax: number, h: number): string {
    return xs.map((x, i) => {
      if (!isFinite(ys[i])) return null
      return `${sx(x, lo, hi).toFixed(1)},${syDens(Math.min(ys[i], yMax), yMax, h).toFixed(1)}`
    }).filter(Boolean).join(' ')
  }

  // Band path for positive/negative regions
  function bandPath(xs: number[], ys: number[], yMax: number, h: number, positive: boolean): string {
    const zero = syDens(0, yMax, h)
    const segments: string[] = []
    let inSeg = false, cur: string[] = []

    for (let i = 0; i < xs.length; i++) {
      const v = isFinite(ys[i]) ? Math.min(Math.max(ys[i], -yMax), yMax) : 0
      const inside = positive ? v > 0 : v < 0
      if (inside) {
        if (!inSeg) { inSeg = true; cur = [] }
        cur.push(`${sx(xs[i], lo, hi).toFixed(1)},${syDens(v, yMax, h).toFixed(1)}`)
      } else if (inSeg) {
        inSeg = false
        if (cur.length > 1) {
          const x0 = cur[0].split(',')[0], xN = cur[cur.length-1].split(',')[0]
          segments.push(`M ${x0},${zero} L ${cur.join(' L ')} L ${xN},${zero} Z`)
        }
        cur = []
      }
    }
    if (inSeg && cur.length > 1) {
      const x0 = cur[0].split(',')[0], xN = cur[cur.length-1].split(',')[0]
      segments.push(`M ${x0},${zero} L ${cur.join(' L ')} L ${xN},${zero} Z`)
    }
    return segments.join(' ')
  }

  const xTicks = [lo, (lo+hi)/2, hi].map(v => parseFloat(v.toFixed(1)))

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, userSelect: 'none' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {(['density','kl','entropy'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '3px 12px', borderRadius: 4, border: 'none', cursor: 'pointer',
            background: tab===t ? '#555' : '#ddd',
            color: tab===t ? '#fff' : '#444', fontSize: 12,
          }}>{t==='density' ? 'Densities P & Q' : t==='kl' ? 'KL Integrand' : 'Entropy'}</button>
        ))}
      </div>

      {/* Density plot */}
      <svg width={VW} height={PH1+PAD.top+PAD.bottom} viewBox={`0 0 ${VW} ${PH1+PAD.top+PAD.bottom}`}
        style={{ display: 'block', background: '#fafafa', borderRadius: 6, border: '1px solid #e0e0e0' }}>
        <defs>
          <clipPath id="ekl-dens-clip">
            <rect x={PAD.left} y={PAD.top} width={PW} height={PH1} />
          </clipPath>
        </defs>
        <line x1={PAD.left} x2={PAD.left+PW} y1={PAD.top+PH1} y2={PAD.top+PH1} stroke="#aaa" />
        <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top+PH1} stroke="#aaa" />
        {xTicks.map(v=>(
          <text key={v} x={sx(v,lo,hi)} y={PAD.top+PH1+16} textAnchor="middle" fill="#888" fontSize={9}>{v}</text>
        ))}
        <g clipPath="url(#ekl-dens-clip)">
          {/* Fill */}
          <path d={(() => {
            const top = xs.map((x,i) => `${sx(x,lo,hi).toFixed(1)},${syDens(pyVals[i], densMax, PH1+PAD.top+PAD.bottom).toFixed(1)}`).join(' L ')
            const base = `L ${sx(hi,lo,hi)},${PAD.top+PH1} L ${sx(lo,lo,hi)},${PAD.top+PH1} Z`
            return `M ${top} ${base}`
          })()} fill={COLOR_P} opacity={0.12} />
          <path d={(() => {
            const top = xs.map((x,i) => `${sx(x,lo,hi).toFixed(1)},${syDens(qyVals[i], densMax, PH1+PAD.top+PAD.bottom).toFixed(1)}`).join(' L ')
            const base = `L ${sx(hi,lo,hi)},${PAD.top+PH1} L ${sx(lo,lo,hi)},${PAD.top+PH1} Z`
            return `M ${top} ${base}`
          })()} fill={COLOR_Q} opacity={0.12} />
          {/* Lines */}
          <polyline points={ptsLine(xs, pyVals, densMax, PH1+PAD.top+PAD.bottom)}
            fill="none" stroke={COLOR_P} strokeWidth={2.2} />
          <polyline points={ptsLine(xs, qyVals, densMax, PH1+PAD.top+PAD.bottom)}
            fill="none" stroke={COLOR_Q} strokeWidth={2.2} />
        </g>
        {/* Legend */}
        <line x1={PAD.left+8} x2={PAD.left+26} y1={PAD.top+14} y2={PAD.top+14} stroke={COLOR_P} strokeWidth={2} />
        <text x={PAD.left+30} y={PAD.top+18} fill={COLOR_P} fontSize={11} fontWeight={600}>P</text>
        <line x1={PAD.left+46} x2={PAD.left+64} y1={PAD.top+14} y2={PAD.top+14} stroke={COLOR_Q} strokeWidth={2} />
        <text x={PAD.left+68} y={PAD.top+18} fill={COLOR_Q} fontSize={11} fontWeight={600}>Q</text>
        <rect x={PAD.left} y={PAD.top} width={PW} height={PH1} fill="none" stroke="#ccc" />
      </svg>

      {/* KL integrand / entropy panel */}
      {(tab === 'kl' || tab === 'entropy') && (
        <svg width={VW} height={PH2+PAD.top+PAD.bottom} viewBox={`0 0 ${VW} ${PH2+PAD.top+PAD.bottom}`}
          style={{ display:'block', background:'#fafafa', borderRadius:6, border:'1px solid #e0e0e0', marginTop:6 }}>
          <defs>
            <clipPath id="ekl-kl-clip">
              <rect x={PAD.left} y={PAD.top} width={PW} height={PH2} />
            </clipPath>
          </defs>
          <line x1={PAD.left} x2={PAD.left+PW} y1={PAD.top+PH2} y2={PAD.top+PH2} stroke="#aaa" />
          <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top+PH2} stroke="#aaa" />
          {xTicks.map(v=>(
            <text key={v} x={sx(v,lo,hi)} y={PAD.top+PH2+16} textAnchor="middle" fill="#888" fontSize={9}>{v}</text>
          ))}

          {tab === 'kl' && (
            <g clipPath="url(#ekl-kl-clip)">
              {/* Zero line */}
              <line x1={PAD.left} x2={PAD.left+PW}
                y1={syDens(0, klRange, PH2+PAD.top+PAD.bottom)}
                y2={syDens(0, klRange, PH2+PAD.top+PAD.bottom)}
                stroke="#ccc" strokeDasharray="3,2" />
              {/* Positive region (P heavier) */}
              <path d={bandPath(xs, klVals, klRange, PH2+PAD.top+PAD.bottom, true)}
                fill={COLOR_POS} opacity={0.25} />
              {/* Negative region (Q heavier) */}
              <path d={bandPath(xs, klVals, klRange, PH2+PAD.top+PAD.bottom, false)}
                fill={COLOR_NEG} opacity={0.25} />
              {/* Integrand line */}
              <polyline points={ptsLine(xs, klVals.map(v=>isFinite(v)?Math.min(v,klRange):-klRange), klRange, PH2+PAD.top+PAD.bottom)}
                fill="none" stroke={showQ2P ? COLOR_Q : COLOR_P} strokeWidth={2} />
              <text x={PAD.left+8} y={PAD.top+16} fill="#444" fontSize={10}>
                {showQ2P ? 'q(x) log(q/p)' : 'p(x) log(p/q)'}  — shaded area = KL
              </text>
            </g>
          )}

          {tab === 'entropy' && (
            <g clipPath="url(#ekl-kl-clip)">
              {/* -p log p */}
              {[{vals: pyVals, col: COLOR_P, label: '−p log p'},
                {vals: qyVals, col: COLOR_Q, label: '−q log q'}].map(({vals, col, label}) => {
                  const negLogP = vals.map(v => v > 1e-15 ? -v * Math.log(v) : 0)
                  const nMax = Math.max(...negLogP) * 1.2
                  return (
                    <g key={col}>
                      <polyline
                        points={ptsLine(xs, negLogP, nMax, PH2+PAD.top+PAD.bottom)}
                        fill="none" stroke={col} strokeWidth={1.8} />
                    </g>
                  )
                })}
            </g>
          )}
          <rect x={PAD.left} y={PAD.top} width={PW} height={PH2} fill="none" stroke="#ccc" />
        </svg>
      )}

      {/* Stats row */}
      <div style={{ display:'flex', gap:18, marginTop:10, flexWrap:'wrap' }}>
        <StatCard label="H(P)" value={hP.toFixed(4)} analytic={analH_P?.toFixed(4)} color={COLOR_P} unit="nats" />
        <StatCard label="H(Q)" value={hQ.toFixed(4)} analytic={analH_Q?.toFixed(4)} color={COLOR_Q} unit="nats" />
        <StatCard label="KL(P‖Q)" value={isFinite(klPQ)?klPQ.toFixed(4):'∞'} analytic={analKL?.toFixed(4)} color={COLOR_P} />
        <StatCard label="KL(Q‖P)" value={isFinite(klQP)?klQP.toFixed(4):'∞'} analytic={null} color={COLOR_Q} />
        <StatCard label="JSD(P,Q)" value={jsdVal.toFixed(4)} analytic={null} color="#9467BD" note="≤ log 2" />
        {isFinite(klPQ) && isFinite(klQP) && Math.abs(klPQ - klQP) > 0.001 && (
          <div style={{ fontSize:11, color:'#888', alignSelf:'center' }}>
            KL(P‖Q) ≠ KL(Q‖P) — asymmetry = {Math.abs(klPQ-klQP).toFixed(4)}
          </div>
        )}
      </div>

      {/* KL direction toggle */}
      {tab === 'kl' && (
        <div style={{ marginTop:8 }}>
          <button onClick={() => setShowQ2P(v=>!v)} style={{
            padding:'3px 12px', borderRadius:4, border:'1.5px solid #888',
            background: showQ2P ? '#888' : 'transparent', color: showQ2P ? '#fff' : '#666',
            cursor:'pointer', fontSize:12,
          }}>Show KL(Q‖P)</button>
          <span style={{ marginLeft:10, fontSize:11, color:'#888' }}>
            {showQ2P ? 'KL(Q‖P): mode-seeking (Q avoids where P is small)' : 'KL(P‖Q): zero-forcing (penalizes where P>0, Q≈0)'}
          </span>
        </div>
      )}

      {/* Dist controls */}
      <div style={{ display:'flex', gap:20, marginTop:12, flexWrap:'wrap' }}>
        <DistControl
          label="P" color={COLOR_P} id={pId} setId={id=>{setPId(id); const d=defaultParams(id); setPMu(d.mu); setPSig(d.sigma); setPA(d.a); setPB(d.b)}}
          mu={pMu} setMu={setPMu} sigma={pSig} setSigma={setPSig}
          a={pA} setA={setPA} b={pB} setB={setPB}
        />
        <DistControl
          label="Q" color={COLOR_Q} id={qId} setId={id=>{setQId(id); const d=defaultParams(id); setQMu(d.mu); setQSig(d.sigma); setQA(d.a); setQB(d.b)}}
          mu={qMu} setMu={setQMu} sigma={qSig} setSigma={setQSig}
          a={qA} setA={setQA} b={qB} setB={setQB}
        />
      </div>

      <div style={{ marginTop:12, background:'#f5f5f5', borderRadius:6, padding:'10px 14px', fontSize:12, color:'#444', lineHeight:1.6 }}>
        <strong>KL divergence:</strong> KL(P‖Q) = ∫p(x) log(p(x)/q(x)) dx ≥ 0 (Jensen's inequality).
        The green/red shading shows where P is heavier/lighter than Q in the KL integrand.
        KL = 0 iff P = Q a.e. <strong>Asymmetry:</strong> KL(P‖Q) ≠ KL(Q‖P) in general — KL is not a metric.
        JSD = (KL(P‖M)+KL(Q‖M))/2, M=(P+Q)/2 — symmetric and bounded ≤ log 2.
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, analytic, color, unit, note }: {
  label: string; value: string; analytic?: string | null; color: string; unit?: string; note?: string
}) {
  return (
    <div style={{ minWidth: 90 }}>
      <div style={{ fontSize: 10, color: '#888' }}>{label}{unit ? ` (${unit})` : ''}</div>
      <div style={{ fontWeight: 700, fontSize: 15, color }}>{value}</div>
      {analytic != null && (
        <div style={{ fontSize: 9, color: '#aaa' }}>analytic: {analytic}</div>
      )}
      {note && <div style={{ fontSize: 9, color: '#aaa' }}>{note}</div>}
    </div>
  )
}

function DistControl({ label, color, id, setId, mu, setMu, sigma, setSigma, a, setA, b, setB }: {
  label: string; color: string; id: DistId; setId: (v: DistId) => void
  mu: number; setMu: (v: number) => void; sigma: number; setSigma: (v: number) => void
  a: number; setA: (v: number) => void; b: number; setB: (v: number) => void
}) {
  return (
    <div style={{ border: `1.5px solid ${color}`, borderRadius: 6, padding: '8px 12px', minWidth: 220 }}>
      <div style={{ fontWeight: 700, color, marginBottom: 6 }}>{label}:</div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {(['gaussian','laplace','uniform'] as DistId[]).map(did => (
          <button key={did} onClick={() => setId(did)} style={{
            padding: '2px 8px', borderRadius: 3, border: `1px solid ${color}`,
            background: id===did ? color : 'transparent', color: id===did ? '#fff' : color,
            cursor: 'pointer', fontSize: 10,
          }}>{did}</button>
        ))}
      </div>
      {id !== 'uniform' && <>
        <SliderRow label={`μ = ${mu.toFixed(2)}`} min={-4} max={4} step={0.05} value={mu} onChange={setMu} color={color} />
        <SliderRow label={`σ = ${sigma.toFixed(2)}`} min={0.1} max={4} step={0.05} value={sigma} onChange={setSigma} color={color} />
      </>}
      {id === 'uniform' && <>
        <SliderRow label={`a = ${a.toFixed(1)}`} min={-6} max={0} step={0.1} value={a} onChange={setA} color={color} />
        <SliderRow label={`b = ${b.toFixed(1)}`} min={0} max={6} step={0.1} value={b} onChange={setB} color={color} />
      </>}
    </div>
  )
}

function SliderRow({ label, min, max, step, value, onChange, color }: {
  label: string; min: number; max: number; step: number;
  value: number; onChange: (v: number) => void; color: string
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 4 }}>
      <span style={{ color: '#666', fontSize: 10 }}>{label}</span>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        style={{ accentColor: color, width: 180 }} />
    </label>
  )
}
