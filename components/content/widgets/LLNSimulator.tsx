'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

// ── Box-Muller normal sampler ──────────────────────────────────────────────────
function sampleNormal(): number {
  const u1 = Math.random(), u2 = Math.random()
  return Math.sqrt(-2 * Math.log(Math.max(u1, 1e-10))) * Math.cos(2 * Math.PI * u2)
}

// ── Distribution definitions ──────────────────────────────────────────────────
const DISTS = {
  uniform: {
    label: 'Uniform(0, 2)',
    mu: 1,
    yRange: [-0.5, 2.5] as [number, number],
    color: '#4A90D9',
    sample: () => Math.random() * 2,
  },
  normal: {
    label: 'Normal(0, 1)',
    mu: 0,
    yRange: [-3, 3] as [number, number],
    color: '#7B68EE',
    sample: sampleNormal,
  },
  exponential: {
    label: 'Exponential(1)',
    mu: 1,
    yRange: [-0.5, 4] as [number, number],
    color: '#3A8C5A',
    sample: () => -Math.log(Math.max(Math.random(), 1e-10)),
  },
  bernoulli: {
    label: 'Bernoulli(0.7)',
    mu: 0.7,
    yRange: [-0.2, 1.4] as [number, number],
    color: '#C0622A',
    sample: () => (Math.random() < 0.7 ? 1 : 0),
  },
} as const

type DistKey = keyof typeof DISTS

// ── SVG layout ────────────────────────────────────────────────────────────────
const VW = 520
const VH = 210
const PAD = { top: 18, right: 20, bottom: 32, left: 50 }
const PW = VW - PAD.left - PAD.right
const PH = VH - PAD.top - PAD.bottom
const MAX_N = 400

// ── Component ─────────────────────────────────────────────────────────────────

export function LLNSimulator() {
  const [distKey, setDistKey] = useState<DistKey>('uniform')
  const [running, setRunning] = useState(false)
  const [speed, setSpeed] = useState(5)

  // Accumulator refs avoid large state updates on every sample
  const sumRef = useRef(0)
  const countRef = useRef(0)
  const [means, setMeans] = useState<number[]>([])

  const dist = DISTS[distKey]
  const n = means.length

  const reset = useCallback(() => {
    setRunning(false)
    sumRef.current = 0
    countRef.current = 0
    setMeans([])
  }, [])

  // Reset whenever distribution changes
  useEffect(() => { reset() }, [distKey, reset])

  // Simulation loop
  useEffect(() => {
    if (!running) return
    const currentDist = DISTS[distKey]
    const id = setInterval(() => {
      const batch: number[] = []
      for (let i = 0; i < speed; i++) {
        if (countRef.current >= MAX_N) break
        sumRef.current += currentDist.sample()
        countRef.current++
        batch.push(sumRef.current / countRef.current)
      }
      if (batch.length === 0) { setRunning(false); return }
      setMeans(prev => [...prev, ...batch])
      if (countRef.current >= MAX_N) setRunning(false)
    }, 50)
    return () => clearInterval(id)
  }, [running, speed, distKey])

  // SVG scales
  const [yMin, yMax] = dist.yRange
  const sx = (i: number) => PAD.left + (i / MAX_N) * PW
  const sy = (v: number) => {
    const clamped = Math.max(yMin, Math.min(yMax, v))
    return PAD.top + PH - ((clamped - yMin) / (yMax - yMin)) * PH
  }

  const currentMean = n > 0 ? means[n - 1] : null
  const inRange = currentMean !== null
    ? currentMean >= yMin && currentMean <= yMax
    : false

  // Polyline points (downsample for perf if needed — 400 pts is fine)
  const points = means.map((m, i) =>
    `${sx(i + 1).toFixed(1)},${sy(m).toFixed(1)}`
  ).join(' ')

  // Y-axis ticks
  const muY = sy(dist.mu)
  const yTicks = [yMin, (yMin + dist.mu) / 2, dist.mu, (dist.mu + yMax) / 2, yMax]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16 }}>

      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'flex-end' }}>

        {/* Distribution */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 500 }}>
            Distribution
          </label>
          <select
            value={distKey}
            onChange={e => setDistKey(e.target.value as DistKey)}
            disabled={running}
            style={{
              padding: '4px 8px', fontSize: 12, borderRadius: 4,
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)', color: 'var(--color-text)',
              cursor: running ? 'not-allowed' : 'pointer',
            }}
          >
            {(Object.keys(DISTS) as DistKey[]).map(k => (
              <option key={k} value={k}>{DISTS[k].label}</option>
            ))}
          </select>
        </div>

        {/* Speed */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <label style={{ fontSize: 11, color: 'var(--color-muted)', fontWeight: 500 }}>
            Speed: {speed}×
          </label>
          <input
            type="range" min={1} max={20} step={1} value={speed}
            onChange={e => setSpeed(Number(e.target.value))}
            style={{ width: 100 }}
          />
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setRunning(r => !r)}
            disabled={n >= MAX_N}
            style={{
              padding: '5px 12px', fontSize: 12, borderRadius: 4, cursor: 'pointer',
              border: '1px solid var(--color-border)',
              background: running ? 'var(--color-elevated)' : 'var(--color-accent)',
              color: running ? 'var(--color-text)' : '#fff',
              opacity: n >= MAX_N ? 0.4 : 1,
            }}
          >
            {running ? '⏸ Pause' : n === 0 ? '▶ Start' : '▶ Resume'}
          </button>
          <button
            onClick={reset}
            style={{
              padding: '5px 12px', fontSize: 12, borderRadius: 4, cursor: 'pointer',
              border: '1px solid var(--color-border)',
              background: 'var(--color-surface)', color: 'var(--color-text)',
            }}
          >
            ↺ Reset
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, fontSize: 11, color: 'var(--color-muted)' }}>
        <span>n = <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--color-text)' }}>{n}</span></span>
        {currentMean !== null && <>
          <span>X̄ₙ = <span style={{ fontFamily: 'var(--font-mono, monospace)', color: dist.color }}>{currentMean.toFixed(5)}</span></span>
          <span>μ = <span style={{ fontFamily: 'var(--font-mono, monospace)', color: 'var(--color-text)' }}>{dist.mu}</span></span>
          <span>|X̄ₙ − μ| = <span style={{ fontFamily: 'var(--font-mono, monospace)', color: Math.abs(currentMean - dist.mu) < 0.05 ? '#3A8C5A' : 'var(--color-text)' }}>
            {Math.abs(currentMean - dist.mu).toFixed(5)}
          </span></span>
        </>}
      </div>

      {/* Plot */}
      <svg
        width="100%"
        viewBox={`0 0 ${VW} ${VH}`}
        style={{ display: 'block', borderRadius: 4, border: '1px solid var(--color-border)' }}
        aria-label="Running sample mean convergence to population mean"
      >
        {/* Plot area background */}
        <rect
          x={PAD.left} y={PAD.top} width={PW} height={PH}
          fill="var(--color-elevated)" rx="2"
        />

        {/* Horizontal grid lines at y-ticks */}
        {yTicks.map((v, i) => (
          <line key={i}
            x1={PAD.left} x2={PAD.left + PW}
            y1={sy(v)} y2={sy(v)}
            stroke="var(--color-border)" strokeWidth={0.6}
          />
        ))}

        {/* μ reference line — dashed, colored */}
        <line
          x1={PAD.left} x2={PAD.left + PW}
          y1={muY} y2={muY}
          stroke={dist.color} strokeWidth={1.5} strokeDasharray="6,4" opacity={0.8}
        />
        <text
          x={PAD.left + PW - 2} y={muY - 4}
          textAnchor="end" fill={dist.color} fontSize={9} opacity={0.9}
        >
          μ = {dist.mu}
        </text>

        {/* Convergence band (±0.1 around μ) */}
        {(() => {
          const bandHi = sy(dist.mu + 0.1)
          const bandLo = sy(dist.mu - 0.1)
          const bTop = Math.max(PAD.top, Math.min(bandHi, bandLo))
          const bBot = Math.min(PAD.top + PH, Math.max(bandHi, bandLo))
          return (
            <rect
              x={PAD.left} y={bTop} width={PW} height={Math.max(bBot - bTop, 0)}
              fill={dist.color} opacity={0.06}
            />
          )
        })()}

        {/* Y-axis labels */}
        {yTicks.map((v, i) => (
          <text key={i}
            x={PAD.left - 6} y={sy(v) + 3.5}
            textAnchor="end" fill="var(--color-muted)" fontSize={9}
          >
            {v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}
          </text>
        ))}

        {/* X-axis ticks */}
        {[0, 100, 200, 300, 400].map(tick => (
          <g key={tick}>
            <line
              x1={sx(tick)} x2={sx(tick)}
              y1={PAD.top + PH} y2={PAD.top + PH + 4}
              stroke="var(--color-border-strong)" strokeWidth={0.8}
            />
            <text
              x={sx(tick)} y={PAD.top + PH + 14}
              textAnchor="middle" fill="var(--color-muted)" fontSize={9}
            >
              {tick}
            </text>
          </g>
        ))}

        {/* Axis labels */}
        <text
          x={PAD.left + PW / 2} y={VH - 2}
          textAnchor="middle" fill="var(--color-muted)" fontSize={9}
        >
          n (sample size)
        </text>
        <text
          x={10} y={PAD.top + PH / 2}
          textAnchor="middle" fill="var(--color-muted)" fontSize={9}
          transform={`rotate(-90, 10, ${PAD.top + PH / 2})`}
        >
          X̄ₙ
        </text>

        {/* Axes */}
        <line
          x1={PAD.left} x2={PAD.left + PW}
          y1={PAD.top + PH} y2={PAD.top + PH}
          stroke="var(--color-border-strong)" strokeWidth={1}
        />
        <line
          x1={PAD.left} x2={PAD.left}
          y1={PAD.top} y2={PAD.top + PH}
          stroke="var(--color-border-strong)" strokeWidth={1}
        />

        {/* Running mean path */}
        {n > 1 && (
          <polyline
            points={points}
            fill="none"
            stroke={dist.color}
            strokeWidth={1.5}
            strokeLinejoin="round"
          />
        )}

        {/* Current point */}
        {n > 0 && inRange && (
          <circle cx={sx(n)} cy={sy(currentMean!)} r={3} fill={dist.color} />
        )}

        {/* Empty state */}
        {n === 0 && (
          <text
            x={PAD.left + PW / 2} y={PAD.top + PH / 2 + 4}
            textAnchor="middle" fill="var(--color-muted)" fontSize={12}
          >
            Press Start to begin sampling
          </text>
        )}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, fontSize: 11, color: 'var(--color-muted)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width={20} height={8}>
            <line x1={0} y1={4} x2={20} y2={4} stroke={dist.color} strokeWidth={1.5} strokeDasharray="5,3" />
          </svg>
          True mean μ
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width={20} height={8}>
            <line x1={0} y1={4} x2={20} y2={4} stroke={dist.color} strokeWidth={1.5} />
          </svg>
          Running mean X̄ₙ
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <svg width={20} height={8}>
            <rect x={0} y={0} width={20} height={8} fill={dist.color} opacity={0.15} />
          </svg>
          ±0.1 band
        </span>
      </div>

      {n >= MAX_N && (
        <p style={{ fontSize: 11, color: 'var(--color-muted)', textAlign: 'center' }}>
          Simulation complete ({MAX_N} samples). X̄ₙ converged to μ = {dist.mu}. Press Reset to run again.
        </p>
      )}
    </div>
  )
}
