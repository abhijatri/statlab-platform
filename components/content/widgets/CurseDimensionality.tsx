'use client'

import { useState, useMemo } from 'react'

// ── Mathematical formulas ─────────────────────────────────────────────────────

// log Γ(d/2 + 1) using the recurrence Γ(n+1) = n·Γ(n), Γ(1/2) = √π, Γ(1) = 1
function logGammaHalfPlus1(d: number): number {
  // d even: Γ(d/2+1) = (d/2)!
  // d odd:  Γ(d/2+1) = Γ((d+2)/2) = ((d)/2)·((d-2)/2)·...·(3/2)·(1/2)·Γ(1/2)
  if (d === 0) return 0 // Γ(1) = 1
  if (d % 2 === 0) {
    let lg = 0
    for (let k = 1; k <= d / 2; k++) lg += Math.log(k)
    return lg
  } else {
    let lg = 0.5 * Math.log(Math.PI) // log Γ(1/2)
    for (let k = 1; k <= d; k += 2) lg += Math.log(k / 2)
    return lg
  }
}

// log volume of unit d-ball: (d/2)log(π) - logΓ(d/2+1)
function logBallVolume(d: number): number {
  return (d / 2) * Math.log(Math.PI) - logGammaHalfPlus1(d)
}

// log volume of hypercube [-1,1]^d = d·log(2)
function logCubeVolume(d: number): number {
  return d * Math.log(2)
}

// Fraction of unit ball volume in outer ε-shell: 1 - (1-ε)^d
function shellFraction(d: number, eps: number): number {
  return 1 - Math.pow(1 - eps, d)
}

// Coefficient of variation of pairwise L2 distance between uniform points in [0,1]^d
// CV[||x-y||] ≈ (1/2) · CV[||x-y||²] = (1/2) · √(7/180·d) / (d/6)
//             = (1/2) · (6/√d) · √(7/180) = (3/√d) · √(7/180)
// = √(7/20) / √d = √(0.35) / √d ≈ 0.5916/√d
function cvDistance(d: number): number {
  // Exact: Var[D²] = d·7/180, E[D²] = d/6
  // CV[D²] = √(7/180·d) / (d/6) = 6√(7/180) / √d
  // CV[D] ≈ (1/2)·CV[D²]  (delta method for sqrt)
  return (3 * Math.sqrt(7 / 180)) / Math.sqrt(d)
}

// Mean L2 distance from center to a uniform point in [0,1]^d ≈ √(d/6)
// This grows unboundedly — everything gets far away
function meanDistToCorner(d: number): number {
  // Mean distance from (0,0,...,0) to uniform point in [0,1]^d
  // Each coordinate contributes E[xi²] = 1/3, so E[||x||²] = d/3 → ||x|| ≈ √(d/3)
  return Math.sqrt(d / 3)
}

// Expected nearest-neighbor distance for n uniform points in [0,1]^d
// Using: E[r_1] ≈ Γ(1+1/d)·(V_d(1))^{-1/d} / n^{1/d}
//      ≈ Γ(1+1/d) / (π^{1/2} · (1/Γ(d/2+1))^{1/d}) / n^{1/d}
// For [0,1]^d we approximate by the formula for the d-cube:
// E[r_1^d] ≈ Γ(1+1/d) / n, so E[r_1] ≈ Γ(1+1/d)^{1} / n^{1/d}
// More simply: E[NN distance] ≈ 0.9/n^{1/d} for large d (rough scaling)
// We'll show the exact expected value via E[d_NN] = integral...
// Simpler formula: for Poisson process intensity n in [0,1]^d,
// E[d_NN] = Γ(1+1/d) / (n · V_d)^{1/d}  where V_d = volume of unit d-ball
function expectedNNDist(d: number, n: number): number {
  // Gamma(1+1/d) ≈ 1 for large d (approaches 1 as d→∞)
  // Use Sterling-style approx: Γ(1+x) ≈ 1 for x→0
  const x = 1 / d
  // Lanczos approximation for Γ(1+x) = x·Γ(x)
  // For our range (x = 1/d, d = 1..20), we compute numerically
  // Γ(1+1/d): use the product formula Γ(n) = ∫₀^∞ t^{n-1}e^{-t}dt
  // Approximate using: Γ(1+x) ≈ 1 - 0.5748646x + 0.9512363x² - 0.6998588x³ + 0.4245549x⁴ - 0.1010678x⁵
  // (Abramowitz & Stegun 6.1.35)
  const g1px = gammaApprox(1 + x)
  const logVd = logBallVolume(d)
  // E[r_1] = Γ(1+1/d) · (1 / (n · exp(logVd)))^(1/d)
  return g1px * Math.pow(1 / (n * Math.exp(logVd)), 1 / d)
}

function gammaApprox(z: number): number {
  // Stirling / rational approx for z near 1
  // For z = 1+x, x ∈ [0, 1]:
  if (z <= 1) return 1 / z * gammaApprox(z + 1)
  if (z >= 2) return (z - 1) * gammaApprox(z - 1)
  // z ∈ [1,2]: use Lanczos g=7 coefficients
  const x = z - 1
  const c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7]
  let s = c[0]
  for (let i = 1; i < 9; i++) s += c[i] / (x + i)
  return Math.sqrt(2 * Math.PI) * Math.pow(x + 7.5, x + 0.5) * Math.exp(-(x + 7.5)) * s
}

// ── SVG layout ────────────────────────────────────────────────────────────────

const VW = 520, VH = 210
const PAD = { top: 24, right: 22, bottom: 40, left: 56 }
const PW = VW - PAD.left - PAD.right
const PH = VH - PAD.top - PAD.bottom
const D_MAX = 20

function dx(d: number): number { return PAD.left + ((d - 1) / (D_MAX - 1)) * PW }

// ── Component ─────────────────────────────────────────────────────────────────

const DIMS = Array.from({ length: D_MAX }, (_, i) => i + 1)

export function CurseDimensionality() {
  const [tab, setTab] = useState<'volume' | 'shell' | 'distance'>('volume')
  const [n,   setN]   = useState(100)

  // ── Volume tab ──────────────────────────────────────────────────────────────
  const VolumeView = () => {
    // Two curves: log(V_ball) and log(ratio V_ball/V_cube)
    const logBalls  = DIMS.map(d => logBallVolume(d))
    const logCubes  = DIMS.map(d => logCubeVolume(d))
    const logRatios = DIMS.map(d => logBallVolume(d) - logCubeVolume(d))

    // V_ball peaks at d=5, then decreases
    const ballMax = Math.max(...logBalls)
    const ballMin = Math.min(...logBalls)
    // Ratio always decreasing
    const ratioMin = logRatios[D_MAX - 1]
    const yMin = Math.min(ballMin, ratioMin) - 1
    const yMax = Math.max(ballMax, logCubeVolume(D_MAX)) + 2
    const yRange = yMax - yMin

    function sy(y: number): number { return PAD.top + (1 - (y - yMin) / yRange) * PH }
    const zero_y = sy(0)

    return (
      <svg width={VW} height={VH} viewBox={`0 0 ${VW} ${VH}`}
        style={{ display: 'block', background: '#fafafa', borderRadius: 6, border: '1px solid #e0e0e0' }}>
        <defs><clipPath id="cod-vol-clip"><rect x={PAD.left} y={PAD.top} width={PW} height={PH} /></clipPath></defs>
        {/* Zero line */}
        <line x1={PAD.left} x2={PAD.left+PW} y1={zero_y} y2={zero_y} stroke="#ccc" strokeDasharray="3,2" />
        <line x1={PAD.left} x2={PAD.left+PW} y1={PAD.top+PH} y2={PAD.top+PH} stroke="#aaa" />
        <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top+PH} stroke="#aaa" />
        {[2,5,10,15,20].map(d=>(
          <text key={d} x={dx(d)} y={PAD.top+PH+14} textAnchor="middle" fill="#888" fontSize={9}>{d}</text>
        ))}
        <text x={PAD.left+PW/2} y={VH-4} textAnchor="middle" fill="#666" fontSize={10}>Dimension d</text>
        <text x={PAD.left-40} y={PAD.top+PH/2} textAnchor="middle" fill="#666" fontSize={10}
          transform={`rotate(-90,${PAD.left-40},${PAD.top+PH/2})`}>log Volume</text>

        <g clipPath="url(#cod-vol-clip)">
          {/* log V_ball */}
          <polyline points={DIMS.map(d=>`${dx(d).toFixed(1)},${sy(logBallVolume(d)).toFixed(1)}`).join(' ')}
            fill="none" stroke="#4E79A7" strokeWidth={2.2} />
          {/* log V_cube */}
          <polyline points={DIMS.map(d=>`${dx(d).toFixed(1)},${sy(logCubeVolume(d)).toFixed(1)}`).join(' ')}
            fill="none" stroke="#59A14F" strokeWidth={2.2} />
          {/* log ratio */}
          <polyline points={DIMS.map(d=>`${dx(d).toFixed(1)},${sy(logRatios[d-1]).toFixed(1)}`).join(' ')}
            fill="none" stroke="#E15759" strokeWidth={2.2} strokeDasharray="5,3" />
        </g>

        {/* Legend */}
        <Legend x={PAD.left+8} y={PAD.top+14} items={[
          { color: '#4E79A7', label: 'log V(d-ball)', dash: false },
          { color: '#59A14F', label: 'log V(d-cube)', dash: false },
          { color: '#E15759', label: 'log ratio → −∞', dash: true },
        ]} />
        <rect x={PAD.left} y={PAD.top} width={PW} height={PH} fill="none" stroke="#ccc" />
      </svg>
    )
  }

  // ── Shell tab ───────────────────────────────────────────────────────────────
  const ShellView = () => {
    const epsilons = [0.05, 0.1, 0.25, 0.5]
    const colors   = ['#4E79A7', '#59A14F', '#E15759', '#9467BD']

    function sy(y: number): number { return PAD.top + (1 - y) * PH }

    return (
      <svg width={VW} height={VH} viewBox={`0 0 ${VW} ${VH}`}
        style={{ display: 'block', background: '#fafafa', borderRadius: 6, border: '1px solid #e0e0e0' }}>
        <defs><clipPath id="cod-shell-clip"><rect x={PAD.left} y={PAD.top} width={PW} height={PH} /></clipPath></defs>
        <line x1={PAD.left} x2={PAD.left+PW} y1={PAD.top+PH} y2={PAD.top+PH} stroke="#aaa" />
        <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top+PH} stroke="#aaa" />
        {[0,0.25,0.5,0.75,1].map(v=>(
          <g key={v}>
            <line x1={PAD.left} x2={PAD.left+PW} y1={sy(v)} y2={sy(v)} stroke="#eee" strokeWidth={0.7} />
            <text x={PAD.left-5} y={sy(v)+4} textAnchor="end" fill="#888" fontSize={9}>{(v*100).toFixed(0)}%</text>
          </g>
        ))}
        {[2,5,10,15,20].map(d=>(
          <text key={d} x={dx(d)} y={PAD.top+PH+14} textAnchor="middle" fill="#888" fontSize={9}>{d}</text>
        ))}
        <text x={PAD.left+PW/2} y={VH-4} textAnchor="middle" fill="#666" fontSize={10}>Dimension d</text>
        <text x={PAD.left-40} y={PAD.top+PH/2} textAnchor="middle" fill="#666" fontSize={10}
          transform={`rotate(-90,${PAD.left-40},${PAD.top+PH/2})`}>Fraction in shell</text>

        <g clipPath="url(#cod-shell-clip)">
          {epsilons.map((eps, ei) => (
            <polyline key={eps}
              points={DIMS.map(d=>`${dx(d).toFixed(1)},${sy(shellFraction(d,eps)).toFixed(1)}`).join(' ')}
              fill="none" stroke={colors[ei]} strokeWidth={2} />
          ))}
        </g>

        <Legend x={PAD.left+8} y={PAD.top+14} items={epsilons.map((eps,ei)=>({
          color: colors[ei], label: `ε=${eps} shell: 1−(1−ε)^d`, dash: false,
        }))} />
        <rect x={PAD.left} y={PAD.top} width={PW} height={PH} fill="none" stroke="#ccc" />
      </svg>
    )
  }

  // ── Distance tab ────────────────────────────────────────────────────────────
  const DistanceView = () => {
    const cvs  = DIMS.map(d => cvDistance(d))
    const dists = DIMS.map(d => expectedNNDist(d, n))
    const means = DIMS.map(d => meanDistToCorner(d))

    const cvMax = cvs[0] * 1.1
    function svL(y: number): number { return PAD.top + (1 - y/cvMax) * PH }

    // Right axis for NN distance (scaled separately)
    const nnMax = Math.max(...dists.filter(isFinite), 1) * 1.15
    // means go up to sqrt(20/3) ≈ 2.58
    const mMax = Math.max(...means) * 1.1

    const H2 = 100, P2 = { top: 10, right: 22, bottom: 28, left: 56 }
    const PW2 = VW - P2.left - P2.right
    const PH2 = H2 - P2.top - P2.bottom
    function sy2(y: number, yMax: number): number { return P2.top + (1 - y/yMax) * PH2 }

    return (
      <div>
        {/* CV plot */}
        <svg width={VW} height={VH} viewBox={`0 0 ${VW} ${VH}`}
          style={{ display: 'block', background: '#fafafa', borderRadius: 6, border: '1px solid #e0e0e0', marginBottom: 8 }}>
          <defs><clipPath id="cod-cv-clip"><rect x={PAD.left} y={PAD.top} width={PW} height={PH} /></clipPath></defs>
          <line x1={PAD.left} x2={PAD.left+PW} y1={PAD.top+PH} y2={PAD.top+PH} stroke="#aaa" />
          <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top+PH} stroke="#aaa" />
          {[0,0.25,0.5,0.75,1].map(v=>(
            <g key={v}>
              <line x1={PAD.left} x2={PAD.left+PW} y1={svL(v*cvMax)} y2={svL(v*cvMax)} stroke="#eee" strokeWidth={0.7}/>
              <text x={PAD.left-5} y={svL(v*cvMax)+4} textAnchor="end" fill="#888" fontSize={9}>{(v*cvMax).toFixed(2)}</text>
            </g>
          ))}
          {[2,5,10,15,20].map(d=>(
            <text key={d} x={dx(d)} y={PAD.top+PH+14} textAnchor="middle" fill="#888" fontSize={9}>{d}</text>
          ))}
          <text x={PAD.left+PW/2} y={VH-4} textAnchor="middle" fill="#666" fontSize={10}>Dimension d</text>
          <text x={PAD.left-40} y={PAD.top+PH/2} textAnchor="middle" fill="#666" fontSize={10}
            transform={`rotate(-90,${PAD.left-40},${PAD.top+PH/2})`}>CV of distance</text>

          <g clipPath="url(#cod-cv-clip)">
            {/* Theoretical 1/√d curve */}
            <polyline points={DIMS.map(d=>`${dx(d).toFixed(1)},${svL(cvDistance(d)).toFixed(1)}`).join(' ')}
              fill="none" stroke="#4E79A7" strokeWidth={2.2} />
            {/* Annotation at d=2 */}
            <text x={dx(2)+4} y={svL(cvs[0])-4} fill="#4E79A7" fontSize={10}>
              CV ≈ 0.59/√d
            </text>
          </g>

          {/* NN distance on same plot, secondary axis */}
          <g clipPath="url(#cod-cv-clip)">
            <polyline
              points={DIMS.map(d=>`${dx(d).toFixed(1)},${svL(dists[d-1]*cvMax/nnMax).toFixed(1)}`).join(' ')}
              fill="none" stroke="#E15759" strokeWidth={2} strokeDasharray="5,3" />
            <polyline
              points={DIMS.map(d=>`${dx(d).toFixed(1)},${svL(means[d-1]*cvMax/mMax).toFixed(1)}`).join(' ')}
              fill="none" stroke="#9467BD" strokeWidth={1.8} strokeDasharray="3,2" />
          </g>

          <Legend x={PAD.left+8} y={PAD.top+14} items={[
            { color: '#4E79A7', label: 'CV[dist] → 0  (concentration)', dash: false },
            { color: '#E15759', label: `E[NN dist], n=${n}  (empty space)`, dash: true },
            { color: '#9467BD', label: 'E[dist to origin]  (grows unboundedly)', dash: true },
          ]} />
          <rect x={PAD.left} y={PAD.top} width={PW} height={PH} fill="none" stroke="#ccc" />
        </svg>

        {/* n slider */}
        <label style={{ display:'flex', gap: 10, alignItems:'center', fontSize:12, color:'#555' }}>
          <span>n = {n} (sample size for NN)</span>
          <input type="range" min={10} max={1000} step={10} value={n}
            onChange={e=>setN(parseInt(e.target.value))}
            style={{ accentColor:'#E15759', width:150 }} />
        </label>
      </div>
    )
  }

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, userSelect: 'none' }}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {([['volume','Volume ratio'],['shell','Shell fraction'],['distance','Distance conc.']] as const).map(([id,label])=>(
          <button key={id} onClick={()=>setTab(id as typeof tab)} style={{
            padding:'3px 12px', borderRadius:4, border:'none', cursor:'pointer',
            background: tab===id ? '#555' : '#ddd',
            color: tab===id ? '#fff' : '#444', fontSize:12,
          }}>{label}</button>
        ))}
      </div>

      {tab==='volume'   && <VolumeView />}
      {tab==='shell'    && <ShellView />}
      {tab==='distance' && <DistanceView />}

      <div style={{ marginTop:12, background:'#f5f5f5', borderRadius:6, padding:'10px 14px', fontSize:12, color:'#444', lineHeight:1.6 }}>
        {tab==='volume'   && <><strong>Volume:</strong> V(d-ball) = π^(d/2)/Γ(d/2+1) peaks at d=5 then → 0. V(d-cube) = 2^d grows exponentially. The ball vanishes inside its bounding cube: vol ratio → 0 doubly-exponentially fast.</>}
        {tab==='shell'    && <><strong>Shell:</strong> Fraction of unit ball volume within ε of the surface = 1−(1−ε)^d → 1 as d → ∞. At d=100 with ε=0.05: 99.4% of all volume lies within 5% of the surface. High-d distributions are "hollow".</>}
        {tab==='distance' && <><strong>Distance concentration:</strong> For uniform points in [0,1]^d, CV[‖x−y‖] ≈ 0.59/√d → 0. All pairwise distances become nearly equal. Simultaneously, the mean distance grows as √(d/6): the space empties out but all points are equidistant.</>}
      </div>
    </div>
  )
}

// ── Legend helper ─────────────────────────────────────────────────────────────

function Legend({ x, y, items }: { x: number; y: number; items: { color: string; label: string; dash: boolean }[] }) {
  return (
    <g>
      {items.map((item, i) => (
        <g key={i}>
          <line x1={x} x2={x+18} y1={y+i*14-1} y2={y+i*14-1}
            stroke={item.color} strokeWidth={2} strokeDasharray={item.dash?'5,3':undefined} />
          <text x={x+22} y={y+i*14+3} fill="#444" fontSize={9}>{item.label}</text>
        </g>
      ))}
    </g>
  )
}
