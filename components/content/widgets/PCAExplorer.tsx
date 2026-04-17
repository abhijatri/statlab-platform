'use client'

import { useState, useMemo } from 'react'

// ── Random / linear algebra ───────────────────────────────────────────────────

function randNormal(): number {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function genData2D(n: number, rho: number): [number, number][] {
  return Array.from({ length: n }, () => {
    const z1 = randNormal(), z2 = randNormal()
    return [z1, rho * z1 + Math.sqrt(Math.max(1 - rho * rho, 0)) * z2]
  })
}

function genDataND(n: number, d: number, signal: number, noise: number): number[][] {
  // 2-factor model embedded in d dimensions
  // w1[k] = cos(πk/d), w2[k] = sin(πk/d) — orthogonal loading vectors
  const raw1 = Array.from({ length: d }, (_, k) => Math.cos(Math.PI * k / d))
  const raw2 = Array.from({ length: d }, (_, k) => Math.sin(Math.PI * k / d))
  const n1 = Math.sqrt(raw1.reduce((s, v) => s + v * v, 0))
  const n2 = Math.sqrt(raw2.reduce((s, v) => s + v * v, 0))
  const w1 = raw1.map(v => v / n1), w2 = raw2.map(v => v / n2)

  return Array.from({ length: n }, () => {
    const f1 = signal * randNormal()
    const f2 = signal * 0.55 * randNormal()
    return Array.from({ length: d }, (_, k) => w1[k] * f1 + w2[k] * f2 + noise * randNormal())
  })
}

function colMeans(X: number[][]): number[] {
  const n = X.length, d = X[0].length
  return Array.from({ length: d }, (_, j) => X.reduce((s, r) => s + r[j], 0) / n)
}

function centerData(X: number[][], means: number[]): number[][] {
  return X.map(row => row.map((v, j) => v - means[j]))
}

function sampleCov(Xc: number[][]): number[][] {
  const n = Xc.length, d = Xc[0].length
  return Array.from({ length: d }, (_, i) =>
    Array.from({ length: d }, (_, j) => Xc.reduce((s, r) => s + r[i] * r[j], 0) / (n - 1))
  )
}

// Analytic 2×2 symmetric eigendecomposition
function eigen2x2(C: number[][]): { l1: number; l2: number; v1: [number,number]; v2: [number,number] } {
  const a = C[0][0], b = C[0][1], c = C[1][1]
  const tr = a + c, disc = Math.sqrt(Math.max((a - c) ** 2 + 4 * b * b, 0))
  const l1 = (tr + disc) / 2, l2 = (tr - disc) / 2
  let v1: [number, number]
  if (Math.abs(b) > 1e-10) {
    const nm = Math.sqrt(b * b + (l1 - a) ** 2)
    v1 = [b / nm, (l1 - a) / nm]
  } else {
    v1 = a >= c ? [1, 0] : [0, 1]
  }
  return { l1, l2, v1, v2: [-v1[1], v1[0]] }
}

// Power iteration with deflation for top-k eigenvectors of symmetric matrix
function topKEigen(C: number[][], k: number): { values: number[]; vectors: number[][] } {
  const d = C.length
  const A = C.map(row => [...row])
  const values: number[] = [], vectors: number[][] = []

  for (let ki = 0; ki < Math.min(k, d); ki++) {
    let v: number[] = Array.from({ length: d }, (_, i) => i === ki ? 1 : 0.01)
    let nrm = Math.sqrt(v.reduce((s, x) => s + x * x, 0))
    v = v.map(x => x / nrm)

    for (let it = 0; it < 400; it++) {
      const w = A.map(row => row.reduce((s, aij, j) => s + aij * v[j], 0))
      nrm = Math.sqrt(w.reduce((s, x) => s + x * x, 0))
      if (nrm < 1e-14) break
      const vn = w.map(x => x / nrm)
      if (vn.reduce((s, vi, i) => s + (vi - v[i]) ** 2, 0) < 1e-18) { v = vn; break }
      v = vn
    }

    const Av = A.map(row => row.reduce((s, aij, j) => s + aij * v[j], 0))
    const lam = v.reduce((s, vi, i) => s + vi * Av[i], 0)
    if (lam < 1e-10) break

    values.push(lam)
    vectors.push(v)
    for (let i = 0; i < d; i++)
      for (let j = 0; j < d; j++) A[i][j] -= lam * v[i] * v[j]
  }
  return { values, vectors }
}

function project(Xc: number[][], vecs: number[][]): number[][] {
  return Xc.map(row => vecs.map(v => v.reduce((s, vi, i) => s + vi * row[i], 0)))
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

const VW = 520, VH = 218
const PAD = { top: 24, right: 22, bottom: 40, left: 52 }
const PW = VW - PAD.left - PAD.right
const PH = VH - PAD.top - PAD.bottom

const D_RANGE = 4 // fixed ±4 for 2D scatter

function sx2(x: number): number { return PAD.left + ((x + D_RANGE) / (2 * D_RANGE)) * PW }
function sy2(y: number): number { return PAD.top + ((D_RANGE - y) / (2 * D_RANGE)) * PH }

function ellipsePath(v1: [number,number], v2: [number,number], l1: number, l2: number, scale: number): string {
  // 95% CI for bivariate normal: chi²(2, 0.95) = 5.991, sqrt ≈ 2.45
  const a = scale * Math.sqrt(l1), b = scale * Math.sqrt(l2)
  const npts = 80
  const pts = Array.from({ length: npts + 1 }, (_, i) => {
    const t = (2 * Math.PI * i) / npts
    const x = a * Math.cos(t) * v1[0] + b * Math.sin(t) * v2[0]
    const y = a * Math.cos(t) * v1[1] + b * Math.sin(t) * v2[1]
    return `${sx2(x).toFixed(1)},${sy2(y).toFixed(1)}`
  })
  return 'M ' + pts.join(' L ')
}

// ── Component ─────────────────────────────────────────────────────────────────

const DIMS = [2, 3, 5, 10, 20]

export function PCAExplorer() {
  const [d,       setD]      = useState(2)
  const [n,       setN]      = useState(150)
  const [rho,     setRho]    = useState(0.7)
  const [signal,  setSignal] = useState(2.0)
  const [noise,   setNoise]  = useState(0.5)
  const [tab,     setTab]    = useState<'scatter' | 'scree' | 'proj'>('scatter')
  const [seed,    setSeed]   = useState(0) // trigger resample

  const { data2d, dataNd, C, eigen2, topK, projPC, varExp, totalVar } = useMemo(() => {
    void seed
    if (d === 2) {
      const data2d = genData2D(n, rho)
      const means = colMeans(data2d as unknown as number[][])
      const Xc = centerData(data2d as unknown as number[][], means)
      const C = sampleCov(Xc)
      const eigen2 = eigen2x2(C)
      const projPC = Xc.map(r => [r[0] * eigen2.v1[0] + r[1] * eigen2.v1[1], r[0] * eigen2.v2[0] + r[1] * eigen2.v2[1]])
      const totalVar = eigen2.l1 + eigen2.l2
      const varExp = [eigen2.l1 / totalVar, eigen2.l2 / totalVar]
      return { data2d, dataNd: null, C, eigen2, topK: null, projPC, varExp, totalVar }
    } else {
      const dataNd = genDataND(n, d, signal, noise)
      const means = colMeans(dataNd)
      const Xc = centerData(dataNd, means)
      const C = sampleCov(Xc)
      const k = Math.min(d, 10)
      const topK = topKEigen(C, k)
      const totalVar = topK.values.reduce((s, v) => s + v, 0)
      // Estimate remaining variance (trace - sum of top-k)
      const traceFull = C.reduce((s, _, i) => s + C[i][i], 0)
      const varExp = topK.values.map(v => v / traceFull)
      const projPC = topK.vectors.length >= 2 ? project(Xc, topK.vectors.slice(0, 2)) : []
      return { data2d: null, dataNd, C, eigen2: null, topK, projPC, varExp, totalVar }
    }
  }, [d, n, rho, signal, noise, seed])

  const color = '#4E79A7'

  // ── 2D Scatter ──────────────────────────────────────────────────────────────
  const ScatterView = () => {
    if (!data2d || !eigen2) return null
    const { l1, l2, v1, v2 } = eigen2
    const scale = Math.sqrt(5.991) // 95% CI
    const arrowScale = Math.sqrt(l1) * 1.8
    const arrowScale2 = Math.sqrt(l2) * 1.8

    return (
      <svg width={VW} height={VH} viewBox={`0 0 ${VW} ${VH}`}
        style={{ display: 'block', background: '#fafafa', borderRadius: 6, border: '1px solid #e0e0e0' }}>
        <defs>
          <clipPath id="pca-scatter-clip"><rect x={PAD.left} y={PAD.top} width={PW} height={PH} /></clipPath>
          <marker id="pca-arrow1" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <polygon points="0 0,6 3,0 6" fill={color} />
          </marker>
          <marker id="pca-arrow2" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <polygon points="0 0,6 3,0 6" fill="#E15759" />
          </marker>
        </defs>

        {/* Grid */}
        {[-3,-2,-1,0,1,2,3].map(v => (
          <g key={v}>
            <line x1={PAD.left} x2={PAD.left+PW} y1={sy2(v)} y2={sy2(v)}
              stroke="#e8e8e8" strokeWidth={v===0?1.2:0.6} />
            <line x1={sx2(v)} x2={sx2(v)} y1={PAD.top} y2={PAD.top+PH}
              stroke="#e8e8e8" strokeWidth={v===0?1.2:0.6} />
          </g>
        ))}
        {[-2,0,2].map(v=>(
          <g key={v}>
            <text x={PAD.left-5} y={sy2(v)+4} textAnchor="end" fill="#888" fontSize={9}>{v}</text>
            <text x={sx2(v)} y={PAD.top+PH+14} textAnchor="middle" fill="#888" fontSize={9}>{v}</text>
          </g>
        ))}

        <g clipPath="url(#pca-scatter-clip)">
          {/* Data points */}
          {(data2d as [number,number][]).map(([x,y],i) => (
            <circle key={i} cx={sx2(x)} cy={sy2(y)} r={2.5} fill={color} opacity={0.35} />
          ))}
          {/* 95% confidence ellipse */}
          <path d={ellipsePath(v1, v2, l1, l2, scale)}
            fill="none" stroke={color} strokeWidth={1.8} strokeDasharray="5,3" />
          {/* 1σ ellipse */}
          <path d={ellipsePath(v1, v2, l1, l2, 1)}
            fill="none" stroke={color} strokeWidth={0.8} opacity={0.4} />
          {/* PC1 arrow */}
          <line x1={sx2(0)} y1={sy2(0)} x2={sx2(arrowScale*v1[0])} y2={sy2(arrowScale*v1[1])}
            stroke={color} strokeWidth={2.5} markerEnd="url(#pca-arrow1)" />
          {/* PC2 arrow */}
          <line x1={sx2(0)} y1={sy2(0)} x2={sx2(arrowScale2*v2[0])} y2={sy2(arrowScale2*v2[1])}
            stroke="#E15759" strokeWidth={2} markerEnd="url(#pca-arrow2)" />
        </g>

        {/* Labels */}
        <text x={sx2(arrowScale*v1[0]+0.2)} y={sy2(arrowScale*v1[1])+4} fill={color} fontSize={11} fontWeight={600}>
          PC1 ({(varExp[0]*100).toFixed(1)}%)
        </text>
        <text x={sx2(arrowScale2*v2[0]+0.1)} y={sy2(arrowScale2*v2[1])+4} fill="#E15759" fontSize={11} fontWeight={600}>
          PC2 ({(varExp[1]*100).toFixed(1)}%)
        </text>
        <rect x={PAD.left} y={PAD.top} width={PW} height={PH} fill="none" stroke="#ccc" />
      </svg>
    )
  }

  // ── Scree plot ──────────────────────────────────────────────────────────────
  const ScreeView = () => {
    const vals = d === 2 ? [eigen2!.l1, eigen2!.l2] : (topK?.values ?? [])
    const total = C.reduce((s, _, i) => s + C[i][i], 0)
    const cumulative = vals.reduce<number[]>((acc, v) => {
      acc.push((acc.length === 0 ? 0 : acc[acc.length-1]) + v/total)
      return acc
    }, [])
    const barW = Math.floor(PW / (vals.length + 1))
    const barGap = Math.floor(PW / vals.length)

    return (
      <svg width={VW} height={VH} viewBox={`0 0 ${VW} ${VH}`}
        style={{ display: 'block', background: '#fafafa', borderRadius: 6, border: '1px solid #e0e0e0' }}>
        <defs>
          <clipPath id="pca-scree-clip"><rect x={PAD.left} y={PAD.top} width={PW} height={PH} /></clipPath>
        </defs>
        <line x1={PAD.left} x2={PAD.left+PW} y1={PAD.top+PH} y2={PAD.top+PH} stroke="#aaa" />
        <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top+PH} stroke="#aaa" />
        {[0,0.25,0.5,0.75,1].map(v=>(
          <g key={v}>
            <line x1={PAD.left} x2={PAD.left+PW} y1={PAD.top+PH*(1-v)} y2={PAD.top+PH*(1-v)}
              stroke="#eee" strokeWidth={0.8} />
            <text x={PAD.left-5} y={PAD.top+PH*(1-v)+4} textAnchor="end" fill="#888" fontSize={9}>
              {(v*100).toFixed(0)}%
            </text>
          </g>
        ))}
        <text x={PAD.left-32} y={PAD.top+PH/2} textAnchor="middle" fill="#666" fontSize={10}
          transform={`rotate(-90,${PAD.left-32},${PAD.top+PH/2})`}>Variance explained</text>
        <text x={PAD.left+PW/2} y={VH-4} textAnchor="middle" fill="#666" fontSize={10}>Component</text>

        <g clipPath="url(#pca-scree-clip)">
          {vals.map((v, i) => {
            const bx = PAD.left + i*barGap + barGap/2 - barW/2
            const bh = (v/total) * PH
            return (
              <g key={i}>
                <rect x={bx} y={PAD.top+PH-bh} width={barW} height={bh}
                  fill={color} opacity={0.8} />
                <text x={bx+barW/2} y={PAD.top+PH+14} textAnchor="middle" fill="#888" fontSize={9}>
                  {i+1}
                </text>
              </g>
            )
          })}
          {/* Cumulative line */}
          <polyline
            points={cumulative.map((v, i) =>
              `${PAD.left + i*barGap + barGap/2},${PAD.top + PH*(1-v)}`
            ).join(' ')}
            fill="none" stroke="#E15759" strokeWidth={2} />
          {cumulative.map((v,i) => (
            <circle key={i} cx={PAD.left+i*barGap+barGap/2} cy={PAD.top+PH*(1-v)} r={3}
              fill="#E15759" />
          ))}
        </g>
        <rect x={PAD.left} y={PAD.top} width={PW} height={PH} fill="none" stroke="#ccc" />
      </svg>
    )
  }

  // ── Projection view ─────────────────────────────────────────────────────────
  const ProjView = () => {
    if (d === 2 && eigen2) {
      // 1D histogram of projection onto PC1
      const pc1proj = projPC.map(r => r[0])
      const lo = -4, hi = 4, bins = 30
      const bw = (hi-lo)/bins
      const counts = new Array(bins).fill(0)
      for (const v of pc1proj) { const b = Math.floor((v-lo)/bw); if (b>=0&&b<bins) counts[b]++ }
      const maxC = Math.max(...counts, 1)
      // Overlay N(0, l1) density
      const l1 = eigen2.l1
      const densX = Array.from({length:100}, (_,i)=>lo+(hi-lo)*i/99)
      const densY = densX.map(x => pc1proj.length * bw * Math.exp(-0.5*x*x/l1) / Math.sqrt(2*Math.PI*l1))
      const densMax = Math.max(...densY, maxC)

      function bsx(x:number){return PAD.left+((x-lo)/(hi-lo))*PW}
      function bsy(y:number){return PAD.top+PH*(1-y/densMax)}

      return (
        <svg width={VW} height={VH} viewBox={`0 0 ${VW} ${VH}`}
          style={{ display: 'block', background: '#fafafa', borderRadius: 6, border: '1px solid #e0e0e0' }}>
          <defs>
            <clipPath id="pca-proj-clip"><rect x={PAD.left} y={PAD.top} width={PW} height={PH} /></clipPath>
          </defs>
          <line x1={PAD.left} x2={PAD.left+PW} y1={PAD.top+PH} y2={PAD.top+PH} stroke="#aaa" />
          <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top+PH} stroke="#aaa" />
          {[-3,-2,-1,0,1,2,3].map(v=>(
            <text key={v} x={bsx(v)} y={PAD.top+PH+14} textAnchor="middle" fill="#888" fontSize={9}>{v}</text>
          ))}
          <text x={PAD.left+PW/2} y={VH-4} textAnchor="middle" fill="#666" fontSize={10}>
            Projection onto PC1
          </text>
          <g clipPath="url(#pca-proj-clip)">
            {counts.map((c,i)=>{
              const bx=bsx(lo+i*bw), bwpx=PW/bins
              const bh=(c/densMax)*PH
              return <rect key={i} x={bx} y={PAD.top+PH-bh} width={bwpx-1} height={bh}
                fill={color} opacity={0.55} />
            })}
            <polyline points={densX.map((x,i)=>`${bsx(x).toFixed(1)},${bsy(densY[i]).toFixed(1)}`).join(' ')}
              fill="none" stroke={color} strokeWidth={2.2} />
          </g>
          <text x={PAD.left+8} y={PAD.top+16} fill={color} fontSize={10} fontWeight={600}>
            N(0, λ₁={l1.toFixed(3)}) overlay
          </text>
          <rect x={PAD.left} y={PAD.top} width={PW} height={PH} fill="none" stroke="#ccc" />
        </svg>
      )
    }

    // d > 2: PC1 vs PC2 scatter
    if (!topK || projPC.length === 0) return null
    const xs = projPC.map(r=>r[0]), ys = projPC.map(r=>r[1])
    const xR = Math.max(...xs.map(Math.abs), 0.1)*1.2
    const yR = Math.max(...ys.map(Math.abs), 0.1)*1.2
    function psx(x:number){return PAD.left+((x+xR)/(2*xR))*PW}
    function psy(y:number){return PAD.top+((yR-y)/(2*yR))*PH}
    const cumVar = topK.values.reduce((s,v,i)=>i<2?s+v:s, 0) / C.reduce((s,_,i)=>s+C[i][i],0)

    return (
      <svg width={VW} height={VH} viewBox={`0 0 ${VW} ${VH}`}
        style={{ display: 'block', background: '#fafafa', borderRadius: 6, border: '1px solid #e0e0e0' }}>
        <defs>
          <clipPath id="pca-proj2-clip"><rect x={PAD.left} y={PAD.top} width={PW} height={PH} /></clipPath>
        </defs>
        <line x1={PAD.left} x2={PAD.left+PW} y1={PAD.top+PH/2} y2={PAD.top+PH/2} stroke="#ddd" />
        <line x1={PAD.left+PW/2} x2={PAD.left+PW/2} y1={PAD.top} y2={PAD.top+PH} stroke="#ddd" />
        <line x1={PAD.left} x2={PAD.left+PW} y1={PAD.top+PH} y2={PAD.top+PH} stroke="#aaa" />
        <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top+PH} stroke="#aaa" />
        <text x={PAD.left+PW/2} y={VH-4} textAnchor="middle" fill="#666" fontSize={10}>PC1</text>
        <text x={PAD.left-32} y={PAD.top+PH/2} textAnchor="middle" fill="#666" fontSize={10}
          transform={`rotate(-90,${PAD.left-32},${PAD.top+PH/2})`}>PC2</text>
        <g clipPath="url(#pca-proj2-clip)">
          {projPC.map(([x,y],i)=>(
            <circle key={i} cx={psx(x)} cy={psy(y)} r={2.5} fill={color} opacity={0.4} />
          ))}
        </g>
        <text x={PAD.left+8} y={PAD.top+16} fill={color} fontSize={10} fontWeight={600}>
          PC1+PC2 captures {(cumVar*100).toFixed(1)}% of variance (d={d})
        </text>
        <rect x={PAD.left} y={PAD.top} width={PW} height={PH} fill="none" stroke="#ccc" />
      </svg>
    )
  }

  const tabList: { id: 'scatter'|'scree'|'proj'; label: string; disabled?: boolean }[] = [
    { id: 'scatter', label: 'Scatter + PCs', disabled: d !== 2 },
    { id: 'scree',   label: 'Scree Plot' },
    { id: 'proj',    label: d===2 ? '1D Projection' : '2D Projection' },
  ]

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13, userSelect: 'none' }}>
      {/* Dimension selector */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, alignItems: 'center' }}>
        <span style={{ color: '#555', fontSize: 12 }}>d =</span>
        {DIMS.map(dv => (
          <button key={dv} onClick={() => { setD(dv); if (dv !== 2 && tab==='scatter') setTab('scree') }} style={{
            padding: '3px 12px', borderRadius: 4, border: `1.5px solid ${color}`,
            background: d===dv ? color : 'transparent',
            color: d===dv ? '#fff' : color, cursor: 'pointer', fontSize: 12,
          }}>{dv}</button>
        ))}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
        {tabList.map(t => (
          <button key={t.id} onClick={() => !t.disabled && setTab(t.id)}
            disabled={t.disabled} style={{
              padding: '3px 12px', borderRadius: 4, border: 'none', cursor: t.disabled?'default':'pointer',
              background: tab===t.id ? '#555' : '#ddd',
              color: tab===t.id ? '#fff' : t.disabled ? '#bbb' : '#444',
              fontSize: 12,
            }}>{t.label}</button>
        ))}
      </div>

      {tab === 'scatter' && <ScatterView />}
      {tab === 'scree'   && <ScreeView />}
      {tab === 'proj'    && <ProjView />}

      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 12, alignItems: 'flex-end' }}>
        <SliderRow label={`n = ${n}`} min={30} max={500} step={10} value={n} onChange={setN} color={color} />
        {d === 2
          ? <SliderRow label={`ρ = ${rho.toFixed(2)}`} min={-0.95} max={0.95} step={0.05} value={rho} onChange={setRho} color={color} />
          : <>
              <SliderRow label={`Signal = ${signal.toFixed(1)}`} min={0.5} max={4} step={0.1} value={signal} onChange={setSignal} color={color} />
              <SliderRow label={`Noise = ${noise.toFixed(2)}`} min={0.1} max={2} step={0.05} value={noise} onChange={setNoise} color={color} />
            </>
        }
        <button onClick={() => setSeed(s=>s+1)} style={{
          padding: '5px 14px', borderRadius: 4, border: 'none',
          background: color, color: '#fff', cursor: 'pointer', fontSize: 12,
        }}>Resample</button>
      </div>

      {/* Theory callout */}
      {d === 2 && eigen2 && (
        <div style={{ marginTop: 12, background: '#f5f5f5', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: '#444', lineHeight: 1.6 }}>
          <strong>Sample covariance:</strong> S = [[{C[0][0].toFixed(3)}, {C[0][1].toFixed(3)}], [{C[1][0].toFixed(3)}, {C[1][1].toFixed(3)}]] &nbsp;
          λ₁ = {eigen2.l1.toFixed(3)}, λ₂ = {eigen2.l2.toFixed(3)}.&nbsp;
          PC1 explains {(varExp[0]*100).toFixed(1)}%, PC2 explains {(varExp[1]*100).toFixed(1)}%.
          Ellipse = 95% confidence region (χ²(2) = 5.991 contour).
        </div>
      )}
      {d > 2 && topK && (
        <div style={{ marginTop: 12, background: '#f5f5f5', borderRadius: 6, padding: '10px 14px', fontSize: 12, color: '#444', lineHeight: 1.6 }}>
          <strong>Factor model:</strong> X = f₁w₁ᵀ + f₂w₂ᵀ + ε, d={d}, 2 latent factors.
          Top 2 PCs explain {(varExp.slice(0,2).reduce((s,v)=>s+v,0)*100).toFixed(1)}% of variance.
          Watch how the elbow in the scree sharpens as signal/noise increases.
        </div>
      )}
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
        style={{ accentColor: color, width: 160 }} />
    </label>
  )
}
