'use client'

import { useState, useMemo } from 'react'
import { niceTicks, fmtTick } from './distributions/math'

// ═══════════════════════════════════════════════════════════════════════════
// Tab 1 — σ-Algebra Builder
// ═══════════════════════════════════════════════════════════════════════════
//
// Ω = {1,2,3,4,5,6}.  A σ-algebra on a finite set is equivalent to a
// partition of Ω.  The generated σ-algebra σ(P) = all unions of partition
// cells — 2^|P| sets total.
//
// The user merges/splits elements to create a partition. The widget shows
// every set in the generated σ-algebra, verifying closure under:
//  (i)  Ω ∈ F
//  (ii) A ∈ F ⟹ Aᶜ ∈ F
//  (iii) A, B ∈ F ⟹ A ∪ B ∈ F

const OMEGA = [1, 2, 3, 4, 5, 6] as const

type Atom = 1 | 2 | 3 | 4 | 5 | 6

/** A partition is a mapping element → block ID (0-based). */
function defaultPartition(): number[] {
  // Start: the discrete partition {{1},{2},{3},{4},{5},{6}}
  return [0, 1, 2, 3, 4, 5]
}

function partitionBlocks(part: number[]): Atom[][] {
  const blocks: Map<number, Atom[]> = new Map()
  for (let i = 0; i < OMEGA.length; i++) {
    const id = part[i]
    if (!blocks.has(id)) blocks.set(id, [])
    blocks.get(id)!.push(OMEGA[i])
  }
  return Array.from(blocks.values()).sort((a, b) => a[0] - b[0])
}

/**
 * Generate σ(partition): all 2^k unions of partition blocks.
 * Returns sorted array of sorted arrays (as strings for display).
 */
function sigmaAlgebra(blocks: Atom[][]): Atom[][] {
  const k = blocks.length
  const sets: Atom[][] = []
  for (let mask = 0; mask < (1 << k); mask++) {
    const s: Atom[] = []
    for (let i = 0; i < k; i++) {
      if (mask & (1 << i)) s.push(...blocks[i])
    }
    sets.push(s.sort((a, b) => a - b))
  }
  sets.sort((a, b) => a.length - b.length || a[0] - b[0])
  return sets
}

const BLOCK_COLORS = ['#4E79A7','#59A14F','#E15759','#9467BD','#F28E2B','#17BECF']

function SigmaAlgebraTab() {
  const [partition, setPartition] = useState<number[]>(defaultPartition)

  const blocks = useMemo(() => partitionBlocks(partition), [partition])
  const generated = useMemo(() => sigmaAlgebra(blocks), [blocks])

  /** Merge the block containing element `el` with block containing `target`. */
  const mergeWith = (el: Atom, target: Atom) => {
    const elBlock = partition[OMEGA.indexOf(el)]
    const tgtBlock = partition[OMEGA.indexOf(target)]
    if (elBlock === tgtBlock) return
    setPartition(prev => prev.map(b => b === tgtBlock ? elBlock : b))
  }

  /** Split element `el` off into its own block. */
  const split = (el: Atom) => {
    const idx = OMEGA.indexOf(el)
    if (partition.filter(b => b === partition[idx]).length <= 1) return  // already singleton
    const newId = Math.max(...partition) + 1
    setPartition(prev => prev.map((b, i) => i === idx ? newId : b))
  }

  const setDiscretePart = () => setPartition(defaultPartition())
  const setTrivialPart  = () => setPartition([0, 0, 0, 0, 0, 0])

  const atomLabel = (block: Atom[]) =>
    block.length === 0 ? '∅' : `{${block.join(',')}}`

  return (
    <div className="space-y-4">
      <div className="rounded border border-border bg-elevated px-3 py-2.5 text-xs leading-relaxed text-text-muted">
        <strong className="text-text-secondary">σ-algebra on a finite set = partition of Ω.</strong>
        &nbsp;σ(P) contains all 2^|P| unions of partition blocks.
        &nbsp;Click an element to split it off; drag it onto another to merge.
      </div>

      {/* Partition controls */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={setDiscretePart}
          className="text-[11px] px-3 py-1.5 border border-border rounded text-text-secondary hover:bg-surface transition-colors">
          Discrete σ-alg. (finest)
        </button>
        <button onClick={setTrivialPart}
          className="text-[11px] px-3 py-1.5 border border-border rounded text-text-secondary hover:bg-surface transition-colors">
          Trivial σ-alg. {'{∅,Ω}'}
        </button>
      </div>

      {/* Ω with partition coloring */}
      <div>
        <p className="text-[11px] text-text-muted mb-2">
          Ω = &#123;1,2,3,4,5,6&#125; — click an element to isolate it; click two elements with
          the same color to confirm they are in the same block.
        </p>
        <div className="flex gap-2 flex-wrap">
          {OMEGA.map((el, idx) => {
            const blockIdx = blocks.findIndex(bl => bl.includes(el))
            const color = BLOCK_COLORS[blockIdx % BLOCK_COLORS.length]
            return (
              <button
                key={el}
                onClick={() => split(el)}
                title={`Block: ${atomLabel(blocks[blockIdx])} — click to isolate`}
                className="w-10 h-10 rounded-lg border-2 text-sm font-bold transition-all hover:scale-110 hover:shadow"
                style={{ borderColor: color, color, background: color + '22' }}
              >
                {el}
              </button>
            )
          })}
        </div>
        {/* Merge buttons */}
        <div className="mt-2 flex gap-1.5 flex-wrap">
          {blocks.map((bl, bi) => {
            if (bl.length <= 1) return null
            return (
              <div key={bi} className="flex items-center gap-1">
                <div
                  className="w-2.5 h-2.5 rounded-sm"
                  style={{ background: BLOCK_COLORS[bi % BLOCK_COLORS.length] }}
                />
                <span className="text-[10px] text-text-muted font-mono">
                  {atomLabel(bl)}
                </span>
              </div>
            )
          })}
        </div>
        {/* Merge UI */}
        <div className="mt-2 flex gap-1.5 flex-wrap">
          {OMEGA.slice(0, -1).map((el) =>
            OMEGA.slice(OMEGA.indexOf(el) + 1).map((el2) => {
              const b1 = partition[OMEGA.indexOf(el)]
              const b2 = partition[OMEGA.indexOf(el2)]
              if (b1 === b2) return null
              return (
                <button key={`${el}-${el2}`}
                  onClick={() => mergeWith(el2, el)}
                  className="text-[10px] px-2 py-0.5 rounded border border-border text-text-muted hover:bg-surface transition-colors">
                  Merge {el} & {el2}
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Generated σ-algebra */}
      <div>
        <p className="text-[11px] font-medium text-text-secondary mb-2">
          σ({blocks.map(atomLabel).join(', ')}) — {generated.length} sets (2^{blocks.length} = {generated.length})
        </p>
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1">
          {generated.map((s, i) => {
            const label = s.length === 0 ? '∅' : s.length === 6 ? 'Ω' : `{${s.join(',')}}`
            // Find which blocks are fully contained in this set
            const containedBlocks = blocks.filter(bl => bl.every(el => s.includes(el)))
            const setColor = containedBlocks.length === 1
              ? BLOCK_COLORS[blocks.indexOf(containedBlocks[0]) % BLOCK_COLORS.length]
              : 'var(--color-text-secondary)'
            return (
              <div key={i}
                className="text-[10px] font-mono px-1.5 py-1 rounded border border-border text-center"
                style={{ color: setColor, borderColor: setColor + '44' }}>
                {label}
              </div>
            )
          })}
        </div>
      </div>

      {/* Verification */}
      <div className="rounded border border-border bg-surface px-3 py-2.5 text-[11px] text-text-muted space-y-1">
        <p className="font-medium text-text-secondary">Closure properties verified:</p>
        <p>✓ ∅ ∈ F  &nbsp; ✓ Ω ∈ F</p>
        <p>✓ Closed under complement: A ∈ F ⟹ Aᶜ ∈ F</p>
        <p>✓ Closed under finite union</p>
        <p className="mt-1.5 italic">
          Coarser partition ⟹ smaller σ-algebra ⟹ less information.
          The trivial σ-algebra &#123;∅,Ω&#125; has zero information (cannot distinguish any outcomes).
        </p>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab 2 — Lebesgue vs Riemann Integration
// ═══════════════════════════════════════════════════════════════════════════
//
// Riemann: partition the domain [a,b] into n sub-intervals.
//   Approximate f by its inf or sup on each interval.
//   Works when f is "not too discontinuous" (e.g. finitely many jumps).
//
// Lebesgue: partition the range [0, M] into n levels.
//   For each level [y_k, y_{k+1}], measure the SET {x : y_k ≤ f(x) < y_{k+1}}.
//   Works for any measurable function, including indicator of rationals.
//
// Key insight: Riemann slices vertically (chopping x-axis).
//              Lebesgue slices horizontally (chopping y-axis, measuring preimages).

const FUNCTIONS: { id: string; label: string; f: (x: number) => number }[] = [
  {
    id: 'smooth',
    label: 'Smooth: √x',
    f: (x) => Math.sqrt(x),
  },
  {
    id: 'step',
    label: 'Step: floor(3x)/3',
    f: (x) => Math.floor(3 * x) / 3,
  },
  {
    id: 'oscillating',
    label: 'Oscillating: |sin(8πx)|',
    f: (x) => Math.abs(Math.sin(8 * Math.PI * x)),
  },
  {
    id: 'indicator',
    label: 'Dirichlet 1_Q (Riemann fails)',
    f: (_x) => 0,   // rational indicators are 0 a.e. — Lebesgue integral = 0, Riemann undefined
  },
]

const LR_PAD = { top: 20, right: 14, bottom: 36, left: 44 }
const LR_VW = 480, LR_VH = 180

function makeLRScales() {
  const pw = LR_VW - LR_PAD.left - LR_PAD.right
  const ph = LR_VH - LR_PAD.top  - LR_PAD.bottom
  return {
    pw, ph,
    sx: (x: number) => LR_PAD.left + x * pw,
    sy: (y: number) => LR_PAD.top + (1 - y) * ph,
  }
}

function LebesgueRiemannTab() {
  const [fnId, setFnId]     = useState('smooth')
  const [n, setN]           = useState(8)
  const [method, setMethod] = useState<'riemann' | 'lebesgue'>('riemann')

  const fn = FUNCTIONS.find(f => f.id === fnId)!
  const { pw, ph, sx, sy } = makeLRScales()

  const N_CURVE = 400
  const curvePath = useMemo(() => {
    if (fn.id === 'indicator') {
      // Approximate Dirichlet: dense rationals = 0 (we just show 0)
      return `M${sx(0).toFixed(1)},${sy(0).toFixed(1)}L${sx(1).toFixed(1)},${sy(0).toFixed(1)}`
    }
    return Array.from({ length: N_CURVE }, (_, i) => {
      const x = i / (N_CURVE - 1)
      const y = Math.min(Math.max(fn.f(x), 0), 1)
      return `${i === 0 ? 'M' : 'L'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`
    }).join('')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fn, sx, sy])

  // True integral (numerical, 1000 points)
  const trueIntegral = useMemo(() => {
    if (fn.id === 'indicator') return 0
    const h = 1 / 1000
    let sum = 0
    for (let i = 0; i <= 1000; i++) sum += fn.f(i * h) * h
    return sum
  }, [fn])

  // Riemann sum (lower sum — left endpoint)
  const riemannRects = useMemo(() => {
    const rects = []
    let sum = 0
    for (let i = 0; i < n; i++) {
      const x0 = i / n, x1 = (i + 1) / n
      const y = fn.id === 'indicator' ? 0 : fn.f(x0)
      rects.push({ x0, x1, y })
      sum += y * (1 / n)
    }
    return { rects, sum }
  }, [n, fn])

  // Lebesgue: partition range [0,1] into n levels, find measure of preimage
  const lebesgueRects = useMemo(() => {
    if (fn.id === 'indicator') {
      // The set {x: f(x)=1} for Dirichlet = rationals, measure 0.
      // Lebesgue integral = 1·μ({Q ∩ [0,1]}) + 0·μ(irrationals ∩ [0,1]) = 1·0 + 0·1 = 0
      return { rects: [] as {y0:number;y1:number;measure:number}[], sum: 0, note: 'ℚ has measure 0: ∫1_Q dμ = 0' }
    }
    const SAMPLE = 2000
    const rects: { y0: number; y1: number; measure: number }[] = []
    let sum = 0
    for (let i = 0; i < n; i++) {
      const y0 = i / n, y1 = (i + 1) / n
      // Measure of preimage: count x ∈ [0,1] where y0 ≤ f(x) < y1
      let count = 0
      for (let k = 0; k <= SAMPLE; k++) {
        const fx = fn.f(k / SAMPLE)
        if (fx >= y0 && fx < y1) count++
      }
      const measure = count / SAMPLE
      rects.push({ y0, y1, measure })
      sum += y0 * measure    // lower Lebesgue sum
    }
    return { rects, sum, note: null }
  }, [n, fn])

  const error = method === 'riemann'
    ? Math.abs(riemannRects.sum - trueIntegral)
    : Math.abs(lebesgueRects.sum - trueIntegral)

  const xTicks = [0, 0.25, 0.5, 0.75, 1]
  const yTicks = [0, 0.25, 0.5, 0.75, 1]

  return (
    <div className="space-y-4">
      <div className="rounded border border-border bg-elevated px-3 py-2.5 text-[11px] text-text-muted leading-relaxed">
        <strong className="text-text-secondary">Riemann</strong> partitions the <em>domain</em> (x-axis) into intervals.
        <strong className="text-text-secondary ml-1">Lebesgue</strong> partitions the <em>range</em> (y-axis) and measures the preimage of each level.
        Both agree for nice functions but Lebesgue handles functions Riemann cannot (e.g. 1_ℚ).
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <div>
          <p className="label-xs mb-1">Function</p>
          <select
            value={fnId}
            onChange={e => setFnId(e.target.value)}
            className="text-xs border border-border rounded px-2 py-1 bg-surface text-text-secondary">
            {FUNCTIONS.map(f => (
              <option key={f.id} value={f.id}>{f.label}</option>
            ))}
          </select>
        </div>
        <div>
          <p className="label-xs mb-1">Partition n</p>
          <input type="range" min={2} max={20} step={1} value={n}
            onChange={e => setN(parseInt(e.target.value))}
            className="w-32 h-1 accent-accent" />
          <span className="text-[11px] font-mono text-text-secondary ml-2">{n}</span>
        </div>
        <div className="flex gap-1">
          {(['riemann', 'lebesgue'] as const).map(m => (
            <button key={m} onClick={() => setMethod(m)}
              className={`text-[11px] px-3 py-1.5 rounded border capitalize transition-colors ${
                method === m
                  ? 'bg-surface border-border text-text-primary font-medium'
                  : 'border-transparent text-text-muted hover:border-border'
              }`}>{m}</button>
          ))}
        </div>
      </div>

      {/* SVG */}
      <svg width="100%" viewBox={`0 0 ${LR_VW} ${LR_VH}`}
        style={{ display: 'block', overflow: 'visible' }}
        aria-label={`${method} integration`}>
        <defs>
          <clipPath id="lr-clip">
            <rect x={LR_PAD.left} y={LR_PAD.top} width={pw} height={ph} />
          </clipPath>
        </defs>
        <rect x={LR_PAD.left} y={LR_PAD.top} width={pw} height={ph}
          fill="var(--color-elevated)" rx="2" />
        {yTicks.map(y => (
          <line key={y} x1={LR_PAD.left} y1={sy(y)} x2={LR_PAD.left + pw} y2={sy(y)}
            stroke="var(--color-border)" strokeWidth="0.5" />
        ))}

        <g clipPath="url(#lr-clip)">
          {method === 'riemann' && riemannRects.rects.map((r, i) => (
            <rect key={i}
              x={sx(r.x0)} y={sy(r.y)} width={sx(r.x1) - sx(r.x0) - 0.5}
              height={Math.max(0, sy(0) - sy(r.y))}
              fill="#4E79A7" fillOpacity="0.35" />
          ))}
          {method === 'lebesgue' && fn.id !== 'indicator' && lebesgueRects.rects.map((r, i) => (
            // Lebesgue rect: width = measure(preimage), height = dy = 1/n
            // Draw as a horizontal bar at y = y0..y1, width = measure
            <rect key={i}
              x={sx(0)} y={sy(r.y1)} width={sx(r.measure)} height={Math.max(0, sy(r.y0) - sy(r.y1))}
              fill="#59A14F" fillOpacity="0.45" />
          ))}
          <path d={curvePath} fill="none" stroke="var(--color-accent)"
            strokeWidth="2" strokeLinejoin="round" />
        </g>

        {/* Axes */}
        <line x1={LR_PAD.left} y1={LR_PAD.top} x2={LR_PAD.left} y2={LR_PAD.top + ph}
          stroke="var(--color-border-strong)" strokeWidth="1" />
        <line x1={LR_PAD.left} y1={LR_PAD.top + ph} x2={LR_PAD.left + pw} y2={LR_PAD.top + ph}
          stroke="var(--color-border-strong)" strokeWidth="1" />
        {xTicks.map(x => (
          <g key={x}>
            <line x1={sx(x)} y1={LR_PAD.top + ph} x2={sx(x)} y2={LR_PAD.top + ph + 4}
              stroke="var(--color-border-strong)" strokeWidth="1" />
            <text x={sx(x)} y={LR_PAD.top + ph + 14} textAnchor="middle" fontSize="9"
              fill="var(--color-muted)" fontFamily="var(--font-mono, monospace)">
              {x}
            </text>
          </g>
        ))}
        {yTicks.map(y => (
          <g key={y}>
            <line x1={LR_PAD.left - 4} y1={sy(y)} x2={LR_PAD.left} y2={sy(y)}
              stroke="var(--color-border-strong)" strokeWidth="1" />
            <text x={LR_PAD.left - 6} y={sy(y) + 3.5} textAnchor="end" fontSize="9"
              fill="var(--color-muted)" fontFamily="var(--font-mono, monospace)">
              {y}
            </text>
          </g>
        ))}
        <text x={LR_PAD.left + pw / 2} y={LR_VH - 2} textAnchor="middle" fontSize="9.5"
          fill="var(--color-text-secondary)" fontFamily="var(--font-inter, sans-serif)">
          {method === 'lebesgue' ? 'measure of preimage' : 'x'}
        </text>
      </svg>

      {/* Numerical summary */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        {([
          ['True integral', trueIntegral.toFixed(5)],
          [`${method === 'riemann' ? 'Riemann' : 'Lebesgue'} sum`, method === 'riemann' ? riemannRects.sum.toFixed(5) : lebesgueRects.sum.toFixed(5)],
          ['Error', error.toFixed(5)],
        ] as [string, string][]).map(([k, v]) => (
          <div key={k} className="rounded border border-border bg-surface px-2 py-2 text-center">
            <div className="text-text-muted text-[10px]">{k}</div>
            <div className="font-mono text-text-secondary">{v}</div>
          </div>
        ))}
      </div>

      {fn.id === 'indicator' && (
        <div className="rounded border border-border bg-amber-50 dark:bg-amber-950/20 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300">
          <strong>Dirichlet function 1_ℚ(x):</strong> Riemann sums oscillate between 0 and 1
          for every partition (inf = 0, sup = 1 on every interval). The Riemann integral does
          not exist. But since ℚ ∩ [0,1] is countable, it has Lebesgue measure 0, so
          ∫1_ℚ dμ = 0 exactly.
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Tab 3 — Cantor Set and Null Sets
// ═══════════════════════════════════════════════════════════════════════════
//
// The Cantor set C is constructed by removing the middle third of [0,1]
// repeatedly.  After k iterations:
//   • The removed part has measure 1 − (2/3)^k → 1  (almost all of [0,1])
//   • The remaining set C has measure (2/3)^k → 0
//   • But C is uncountable (in bijection with [0,1])
//   • C is a null set: Lebesgue measure 0
//
// "Almost surely" (a.s.) means "except on a null set."
// A dart thrown uniformly at [0,1] almost surely avoids C.

function genCantorIntervals(steps: number): [number, number][] {
  let intervals: [number, number][] = [[0, 1]]
  for (let k = 0; k < steps; k++) {
    const next: [number, number][] = []
    for (const [a, b] of intervals) {
      const third = (b - a) / 3
      next.push([a, a + third], [b - third, b])
    }
    intervals = next
  }
  return intervals
}

const CT_PAD = { top: 12, right: 14, bottom: 24, left: 14 }
const CT_VW  = 480
const ROW_H  = 20
const ROW_GAP = 6
const MAX_STEPS = 6

function CantorTab() {
  const [steps, setSteps] = useState(0)
  const [showFacts, setShowFacts] = useState(true)

  const intervalSets = useMemo(() => {
    const result: [number, number][][] = []
    for (let k = 0; k <= steps; k++) {
      result.push(genCantorIntervals(k))
    }
    return result
  }, [steps])

  const totalVH = (steps + 1) * (ROW_H + ROW_GAP) + CT_PAD.top + CT_PAD.bottom
  const innerW  = CT_VW - CT_PAD.left - CT_PAD.right

  const measure = Math.pow(2 / 3, steps)
  const nIntervals = intervalSets[steps].length  // = 2^steps

  return (
    <div className="space-y-4">
      <div className="rounded border border-border bg-elevated px-3 py-2.5 text-[11px] text-text-muted leading-relaxed">
        <strong className="text-text-secondary">Cantor set:</strong> remove the middle third of each
        remaining interval, step by step. Measure → 0, yet infinitely many points remain.
        The Cantor set is a null set — its complement has measure 1.
      </div>

      {/* Step control */}
      <div className="flex items-center gap-3">
        <span className="text-[11px] text-text-muted">Steps k =</span>
        <input type="range" min={0} max={MAX_STEPS} step={1} value={steps}
          onChange={e => setSteps(parseInt(e.target.value))}
          className="flex-1 h-1 accent-accent" />
        <span className="text-[11px] font-mono text-text-secondary w-4">{steps}</span>
      </div>

      {/* SVG — stacked rows showing each stage */}
      <svg width="100%" viewBox={`0 0 ${CT_VW} ${totalVH}`}
        style={{ display: 'block', overflow: 'visible' }}
        aria-label="Cantor set construction">
        {intervalSets.map((intervals, k) => {
          const y0 = CT_PAD.top + k * (ROW_H + ROW_GAP)
          return (
            <g key={k}>
              {/* Row background (removed portion) */}
              <rect x={CT_PAD.left} y={y0} width={innerW} height={ROW_H}
                fill="var(--color-elevated)" rx="2" />
              {/* Remaining intervals (Cantor set at step k) */}
              {intervals.map(([a, b], i) => (
                <rect key={i}
                  x={CT_PAD.left + a * innerW} y={y0}
                  width={Math.max(0, (b - a) * innerW)} height={ROW_H}
                  fill="#4E79A7" fillOpacity={0.7 - k * 0.08} />
              ))}
              {/* Step label */}
              <text x={CT_PAD.left - 2} y={y0 + ROW_H / 2 + 4}
                textAnchor="end" fontSize="9" fill="var(--color-muted)"
                fontFamily="var(--font-mono, monospace)">
                k={k}
              </text>
              {/* Measure label */}
              <text x={CT_PAD.left + innerW + 4} y={y0 + ROW_H / 2 + 4}
                fontSize="9" fill="var(--color-muted)"
                fontFamily="var(--font-mono, monospace)">
                μ={(2 / 3) ** k < 0.001
                  ? ((2 / 3) ** k).toExponential(2)
                  : ((2 / 3) ** k).toFixed(4)}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 text-xs">
        {([
          ['Measure',    measure < 1e-4 ? measure.toExponential(3) : measure.toFixed(6)],
          ['Intervals',  String(nIntervals)],
          ['Removed',    (1 - measure).toFixed(6)],
        ] as [string, string][]).map(([k, v]) => (
          <div key={k} className="rounded border border-border bg-surface px-2 py-2 text-center">
            <div className="text-text-muted text-[10px]">{k}</div>
            <div className="font-mono text-text-secondary">{v}</div>
          </div>
        ))}
      </div>

      <button onClick={() => setShowFacts(v => !v)}
        className="text-[11px] text-text-muted hover:text-text-secondary transition-colors">
        {showFacts ? '▾' : '▸'} Key facts
      </button>
      {showFacts && (
        <div className="rounded border border-border bg-surface px-3 py-2.5 text-[11px] text-text-muted space-y-1.5 leading-relaxed">
          <p>• <strong className="text-text-secondary">Measure 0:</strong> μ(C) = lim (2/3)^k = 0 as k→∞.</p>
          <p>• <strong className="text-text-secondary">Uncountable:</strong> C is in bijection with [0,1] via
            ternary expansions using only digits &#123;0, 2&#125;.</p>
          <p>• <strong className="text-text-secondary">Null set:</strong> C is a Lebesgue null set.
            "Almost every" x ∈ [0,1] is NOT in C.</p>
          <p>• <strong className="text-text-secondary">Perfect set:</strong> C is closed, has no isolated
            points, and is nowhere dense.</p>
          <p>• <strong className="text-text-secondary">Almost surely:</strong> A property holds a.s. if
            the set where it fails is a null set — like the Cantor set.</p>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════

type MTTab = 'sigma' | 'lebesgue' | 'cantor'

const TABS: [MTTab, string, string][] = [
  ['sigma',    'σ-Algebra',  'Information = partition of Ω'],
  ['lebesgue', 'Integration','Riemann vs Lebesgue'],
  ['cantor',   'Null Sets',  'Cantor set: measure 0, uncountable'],
]

export function MeasureTheory() {
  const [tab, setTab] = useState<MTTab>('sigma')

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Tabs */}
      <div className="flex gap-0 border-b border-border shrink-0">
        {TABS.map(([id, label, hint]) => (
          <button key={id} onClick={() => setTab(id)}
            title={hint}
            className={`px-4 py-2 text-xs border-b-2 transition-colors whitespace-nowrap ${
              tab === id
                ? 'border-accent text-text-primary font-medium'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}>
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {tab === 'sigma'    && <SigmaAlgebraTab />}
        {tab === 'lebesgue' && <LebesgueRiemannTab />}
        {tab === 'cantor'   && <CantorTab />}
      </div>
    </div>
  )
}
