'use client'

import { useState, useMemo, useCallback, useEffect, useId } from 'react'
import { RefreshCw, ChevronRight } from 'lucide-react'
import { Plot, LineSeries, HistSeries, DiscreteSeries, VLine } from './Plot'
import { DISTRIBUTIONS, DIST_CATEGORIES, bivariateNormal } from './defs'
import { histogram, sampleStats, linspace } from './math'
import { CATEGORY_LABEL, fmtMoment } from './types'
import type { Params, DistributionDef } from './types'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const PLOT_PTS   = 320
const TAIL_ALPHAS = [0.1, 0.05, 0.01, 0.001]
const DEFAULT_DIST = 'normal'
const DEFAULT_N    = 2000

type Tab = 'density' | 'sampling' | 'tails' | 'moments' | 'compare'

// ── Helpers ───────────────────────────────────────────────────────────────

function defaultParams(id: string): Params {
  return Object.fromEntries(DISTRIBUTIONS[id].params.map(p => [p.key, p.default]))
}

/** Build step-function CDF points for a discrete distribution. */
function buildStepCDF(
  dist: DistributionDef,
  params: Params,
  klo: number,
  khi: number
): [number, number][] {
  const pts: [number, number][] = [[klo - 0.5, 0]]
  for (let k = Math.ceil(klo); k <= Math.floor(khi); k++) {
    const f = dist.cdf(k, params)
    pts.push([k - 0.5, f], [k + 0.5, f])
  }
  return pts
}

/** Compute empirical PMF from integer samples. */
function empiricalPMF(samples: number[], klo: number, khi: number): [number, number][] {
  const counts = new Map<number, number>()
  for (const x of samples) {
    const k = Math.round(x)
    counts.set(k, (counts.get(k) ?? 0) + 1)
  }
  const n = samples.length
  const pts: [number, number][] = []
  for (let k = Math.ceil(klo); k <= Math.floor(khi); k++) {
    pts.push([k, (counts.get(k) ?? 0) / n])
  }
  return pts
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

interface DistributionEngineProps {
  /** Pre-select a distribution by its engine ID (e.g. 'normal', 'student-t'). */
  initialDist?: string
}

export function DistributionEngine({ initialDist }: DistributionEngineProps) {
  const uid = useId()

  const resolvedInitial = initialDist && DISTRIBUTIONS[initialDist] ? initialDist : DEFAULT_DIST

  // ── State ────────────────────────────────────────────────────────────────
  const [distId,      setDistId]      = useState(resolvedInitial)
  const [params,      setParams]      = useState<Params>(() => defaultParams(resolvedInitial))
  const [activeTab,   setActiveTab]   = useState<Tab>('density')
  const [category,    setCategory]    = useState<string>(
    DISTRIBUTIONS[resolvedInitial]?.category ?? 'classical'
  )
  const [sampleN,     setSampleN]     = useState(DEFAULT_N)
  const [samples,     setSamples]     = useState<number[]>([])
  const [compId,      setCompId]      = useState('cauchy')
  const [compParams,  setCompParams]  = useState<Params>(() => defaultParams('cauchy'))
  const [sampleStamp, setSampleStamp] = useState(0)

  const dist = DISTRIBUTIONS[distId]
  const comp = DISTRIBUTIONS[compId]
  const isDiscrete = !!dist.isDiscrete
  const is2D       = !!dist.is2D

  function switchDist(id: string) {
    setDistId(id); setParams(defaultParams(id)); setSamples([])
  }
  function switchComp(id: string) {
    setCompId(id); setCompParams(defaultParams(id))
  }
  function setParam(key: string, val: number) {
    setParams(prev => ({ ...prev, [key]: val }))
  }
  function setCompParam(key: string, val: number) {
    setCompParams(prev => ({ ...prev, [key]: val }))
  }

  // ── Sampling ──────────────────────────────────────────────────────────
  const resample = useCallback(() => {
    setSamples(dist.sample(sampleN, params))
    setSampleStamp(t => t + 1)
  }, [dist, params, sampleN])

  useEffect(() => {
    if (activeTab === 'sampling') resample()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, distId, sampleN])

  // ── Density plot data — continuous ────────────────────────────────────
  const contDensityData = useMemo(() => {
    if (isDiscrete || is2D) return null
    const [lo, hi] = dist.plotDomain(params)
    const xs = linspace(lo, hi, PLOT_PTS)
    const pdfPts: [number, number][] = []
    const cdfPts: [number, number][] = []
    let yMax = 0
    for (const x of xs) {
      const y = dist.pdf(x, params)
      if (isFinite(y) && y >= 0) { pdfPts.push([x, y]); if (y > yMax) yMax = y }
      const c = dist.cdf(x, params)
      if (isFinite(c)) cdfPts.push([x, c])
    }
    const pdfSeries: LineSeries = {
      kind: 'line', id: 'pdf', points: pdfPts,
      color: 'var(--color-accent)', fill: true, label: 'PDF',
    }
    const cdfSeries: LineSeries = {
      kind: 'line', id: 'cdf', points: cdfPts,
      color: '#2E8B57', strokeWidth: 2, label: 'CDF',
    }
    return { pdfSeries, cdfSeries, xDom: [lo, hi] as [number, number], yMaxPDF: yMax * 1.08 }
  }, [dist, params, isDiscrete, is2D])

  // ── Density plot data — discrete ──────────────────────────────────────
  const discDensityData = useMemo(() => {
    if (!isDiscrete) return null
    const [lo, hi] = dist.plotDomain(params)
    const klo = Math.ceil(lo), khi = Math.floor(hi)
    const pmfPts: [number, number][] = []
    let yMax = 0
    for (let k = klo; k <= khi; k++) {
      const y = dist.pdf(k, params)
      if (isFinite(y) && y >= 0) { pmfPts.push([k, y]); if (y > yMax) yMax = y }
    }
    const pmfSeries: DiscreteSeries = {
      kind: 'discrete', id: 'pmf', points: pmfPts,
      color: 'var(--color-accent)', label: 'PMF',
    }
    const stepPts = buildStepCDF(dist, params, klo, khi)
    const cdfSeries: LineSeries = {
      kind: 'line', id: 'cdf', points: stepPts,
      color: '#2E8B57', strokeWidth: 1.8, label: 'CDF',
    }
    return {
      pmfSeries, cdfSeries,
      xDom: [lo, hi] as [number, number],
      yMaxPMF: yMax * 1.15,
    }
  }, [dist, params, isDiscrete])

  // ── Aliases for downstream use ────────────────────────────────────────
  const pdfSeries  = contDensityData?.pdfSeries
  const cdfSeries  = contDensityData?.cdfSeries
  const xDom       = (contDensityData?.xDom ?? discDensityData?.xDom ?? [0, 1]) as [number,number]
  const yMaxPDF    = contDensityData?.yMaxPDF ?? discDensityData?.yMaxPMF ?? 1

  // ── Sampling tab data ─────────────────────────────────────────────────
  const samplingData = useMemo(() => {
    if (samples.length === 0) return { histBars: [], empStats: null, empPMF: [] }
    if (isDiscrete) {
      const [lo, hi] = dist.plotDomain(params)
      const empPMF = empiricalPMF(samples, lo, hi)
      return { histBars: [], empStats: sampleStats(samples), empPMF }
    }
    const bins = histogram(samples, 40)
    return { histBars: bins, empStats: sampleStats(samples), empPMF: [] }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [samples, sampleStamp, isDiscrete])

  // ── Tails tab data ────────────────────────────────────────────────────
  const { tailPdfSeries, tailVLines, varTable } = useMemo(() => {
    const [lo, hi] = dist.plotDomain(params)
    const xs = linspace(lo, hi, PLOT_PTS)
    const pts: [number, number][] = []
    let yMin = Infinity
    for (const x of xs) {
      const y = dist.pdf(x, params)
      if (y > 1e-300 && isFinite(y)) { pts.push([x, y]); if (y < yMin) yMin = y }
    }
    const tailPdfSeries: LineSeries = {
      kind: 'line', id: 'tail-pdf', points: pts,
      color: 'var(--color-accent)', fill: true, fillOpacity: 0.1,
    }
    const vLines: VLine[] = []
    const varRows: { alpha: number; q: number; label: string }[] = []
    for (const a of TAIL_ALPHAS) {
      try {
        const q = dist.quantile(1 - a, params)
        if (isFinite(q)) {
          vLines.push({ x: q, color: '#C0392B', dashed: true, label: `${(1-a)*100}%` })
          varRows.push({ alpha: a, q, label: `${(1-a)*100}%` })
        }
      } catch { /* skip */ }
    }
    return { tailPdfSeries, tailVLines: vLines, varTable: varRows }
  }, [dist, params])

  // ── Compare tab data ──────────────────────────────────────────────────
  const { compPdfA, compPdfB, compXDom } = useMemo(() => {
    const [lo1, hi1] = dist.plotDomain(params)
    const [lo2, hi2] = comp.plotDomain(compParams)
    const lo = Math.min(lo1, lo2), hi = Math.max(hi1, hi2)
    const xs = linspace(lo, hi, PLOT_PTS)
    const ptsA: [number, number][] = [], ptsB: [number, number][] = []
    for (const x of xs) {
      const ya = dist.pdf(x, params); if (isFinite(ya) && ya >= 0) ptsA.push([x, ya])
      const yb = comp.pdf(x, compParams); if (isFinite(yb) && yb >= 0) ptsB.push([x, yb])
    }
    const compPdfA: LineSeries = { kind:'line', id:'cmp-a', points:ptsA, color:'var(--color-accent)',  fill:true, label:dist.name }
    const compPdfB: LineSeries = { kind:'line', id:'cmp-b', points:ptsB, color:'#B0392B', fill:true, fillOpacity:0.08, strokeWidth:1.8, label:comp.name }
    return { compPdfA, compPdfB, compXDom: [lo, hi] as [number,number] }
  }, [dist, params, comp, compParams])

  // ── Render ────────────────────────────────────────────────────────────
  const TABS: { id: Tab; label: string }[] = [
    { id: 'density',  label: 'Density'  },
    { id: 'sampling', label: 'Sampling' },
    { id: 'tails',    label: 'Tails'    },
    { id: 'moments',  label: 'Moments'  },
    { id: 'compare',  label: 'Compare'  },
  ]

  return (
    <div className="flex h-full min-h-0 text-xs" style={{ fontFamily: 'var(--font-inter, system-ui, sans-serif)' }}>

      {/* ── Left panel ── */}
      <div className="flex flex-col w-52 shrink-0 border-r border-border bg-elevated overflow-y-auto">

        {/* Category pills */}
        <div className="px-3 pt-3 pb-2">
          <p className="label-xs mb-2">Family</p>
          <div className="flex flex-col gap-0.5">
            {Object.keys(DIST_CATEGORIES).map(cat => (
              <button
                key={cat}
                onClick={() => { setCategory(cat); switchDist(DIST_CATEGORIES[cat][0]) }}
                className={`text-left px-2 py-1 rounded text-xs transition-colors ${
                  category === cat
                    ? 'bg-accent text-white font-medium'
                    : 'text-text-secondary hover:bg-border/50'
                }`}
                style={category === cat ? { backgroundColor: 'var(--color-accent)', color: '#fff' } : {}}
              >
                {CATEGORY_LABEL[cat as keyof typeof CATEGORY_LABEL] ?? cat}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-3 border-t border-border" />

        {/* Distribution list */}
        <div className="px-3 py-2">
          <p className="label-xs mb-1.5">Distribution</p>
          <div className="space-y-0.5">
            {(DIST_CATEGORIES[category] ?? []).map(id => (
              <button
                key={id}
                onClick={() => switchDist(id)}
                className={`w-full text-left flex items-center justify-between px-2 py-1 rounded transition-colors ${
                  distId === id
                    ? 'bg-accent-light text-accent font-medium'
                    : 'text-text-secondary hover:bg-border/50'
                }`}
              >
                <span className="truncate">{DISTRIBUTIONS[id].name}</span>
                {distId === id && <ChevronRight size={10} className="shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        <div className="mx-3 border-t border-border" />

        {/* Parameters */}
        <div className="px-3 py-2 flex-1">
          <p className="label-xs mb-2">Parameters</p>
          <div className="space-y-2.5">
            {dist.params.map(ps => (
              <div key={ps.key}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="font-mono text-text-muted">{ps.label}</span>
                  <span className="font-mono text-text-secondary tabular-nums">
                    {params[ps.key]?.toFixed(ps.step < 0.1 ? 3 : ps.step < 1 ? 2 : 0)}
                  </span>
                </div>
                <input
                  type="range"
                  min={ps.min} max={ps.max} step={ps.step}
                  value={params[ps.key] ?? ps.default}
                  onChange={e => setParam(ps.key, parseFloat(e.target.value))}
                  className="w-full accent-accent h-1 cursor-pointer"
                />
              </div>
            ))}
          </div>
        </div>

        {/* Formula */}
        <div className="px-3 py-2 border-t border-border">
          <p className="label-xs mb-1">{isDiscrete ? 'PMF formula' : 'PDF formula'}</p>
          <p className="font-mono text-[9px] text-text-muted leading-relaxed break-all">
            {dist.pdfFormula}
          </p>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Tab bar */}
        <div className="flex items-center gap-0 border-b border-border bg-surface px-4 shrink-0">
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                activeTab === t.id
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-muted hover:text-text-secondary'
              }`}
            >
              {t.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-2 pr-1">
            <span className="font-semibold text-text-secondary truncate max-w-36">
              {dist.name}
            </span>
            {isDiscrete && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-border text-text-muted">discrete</span>
            )}
            {is2D && (
              <span className="text-[9px] px-1 py-0.5 rounded bg-border text-text-muted">2D</span>
            )}
          </div>
        </div>

        {/* Tab content */}
        <div className="flex-1 min-h-0 overflow-y-auto">
          {activeTab === 'density' && (
            is2D
              ? <Heatmap2DPanel params={params} dist={dist} />
              : isDiscrete && discDensityData
                ? <DiscreteDensityTab pmfSeries={discDensityData.pmfSeries} cdfSeries={discDensityData.cdfSeries} xDom={xDom} yMaxPMF={discDensityData.yMaxPMF} />
                : pdfSeries && cdfSeries
                  ? <DensityTab pdfSeries={pdfSeries} cdfSeries={cdfSeries} xDom={xDom} yMaxPDF={yMaxPDF} />
                  : null
          )}
          {activeTab === 'sampling' && (
            <SamplingTab
              histBars={samplingData.histBars}
              empPMF={samplingData.empPMF}
              pdfSeries={pdfSeries}
              pmfSeries={discDensityData?.pmfSeries}
              xDom={xDom} yMaxPDF={yMaxPDF}
              empStats={samplingData.empStats}
              sampleN={sampleN} setSampleN={setSampleN}
              resample={resample}
              distName={dist.name}
              isDiscrete={isDiscrete}
            />
          )}
          {activeTab === 'tails' && (
            <TailsTab tailSeries={tailPdfSeries} vLines={tailVLines} varTable={varTable} xDom={xDom} />
          )}
          {activeTab === 'moments' && <MomentsTab dist={dist} params={params} />}
          {activeTab === 'compare' && (
            <CompareTab
              compPdfA={compPdfA} compPdfB={compPdfB} xDom={compXDom}
              distA={dist} paramsA={params}
              distB={comp} paramsB={compParams}
              allDists={DISTRIBUTIONS} compId={compId} switchComp={switchComp}
              setCompParam={setCompParam}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// TAB PANELS
// ═══════════════════════════════════════════════════════════════════════════

function DensityTab({ pdfSeries, cdfSeries, xDom, yMaxPDF }: {
  pdfSeries: LineSeries; cdfSeries: LineSeries
  xDom: [number, number]; yMaxPDF: number
}) {
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-border rounded-md overflow-hidden bg-surface p-2">
          <p className="label-xs mb-1.5 px-1">Probability Density (PDF)</p>
          <Plot series={[pdfSeries]} xDomain={xDom} yDomain={[0, yMaxPDF]} yLabel="f(x)" vw={280} vh={180} />
        </div>
        <div className="border border-border rounded-md overflow-hidden bg-surface p-2">
          <p className="label-xs mb-1.5 px-1">Cumulative Distribution (CDF)</p>
          <Plot series={[cdfSeries]} xDomain={xDom} yDomain={[0, 1]} yLabel="F(x)" vw={280} vh={180} />
        </div>
      </div>
      <p className="text-text-muted text-[10px] text-center">Adjust parameters in the left panel to update plots.</p>
    </div>
  )
}

function DiscreteDensityTab({ pmfSeries, cdfSeries, xDom, yMaxPMF }: {
  pmfSeries: DiscreteSeries; cdfSeries: LineSeries
  xDom: [number, number]; yMaxPMF: number
}) {
  return (
    <div className="p-4 space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="border border-border rounded-md overflow-hidden bg-surface p-2">
          <p className="label-xs mb-1.5 px-1">Probability Mass (PMF)</p>
          <Plot series={[pmfSeries]} xDomain={xDom} yDomain={[0, yMaxPMF]} yLabel="P(X=k)" vw={280} vh={180} />
        </div>
        <div className="border border-border rounded-md overflow-hidden bg-surface p-2">
          <p className="label-xs mb-1.5 px-1">Cumulative Distribution (CDF)</p>
          <Plot series={[cdfSeries]} xDomain={xDom} yDomain={[0, 1]} yLabel="F(k)" vw={280} vh={180} />
        </div>
      </div>
      <p className="text-text-muted text-[10px] text-center">Step function CDF — F(k) = P(X ≤ k).</p>
    </div>
  )
}

function SamplingTab({
  histBars, empPMF, pdfSeries, pmfSeries, xDom, yMaxPDF,
  empStats, sampleN, setSampleN, resample, distName, isDiscrete,
}: {
  histBars: HistSeries['bins']; empPMF: [number,number][]
  pdfSeries?: LineSeries; pmfSeries?: DiscreteSeries
  xDom: [number, number]; yMaxPDF: number
  empStats: ReturnType<typeof sampleStats> | null
  sampleN: number; setSampleN: (n: number) => void
  resample: () => void; distName: string; isDiscrete: boolean
}) {
  const histSeries: HistSeries = {
    kind: 'hist', id: 'hist', bins: histBars,
    color: 'var(--color-accent-muted)', label: 'Empirical',
  }
  const pdfOverlay: LineSeries | undefined = pdfSeries
    ? { ...pdfSeries, fill: false, strokeWidth: 2, label: 'Theoretical' }
    : undefined

  const empDiscreteSeries: DiscreteSeries | undefined = isDiscrete && empPMF.length > 0
    ? { kind: 'discrete', id: 'emp-pmf', points: empPMF, color: 'var(--color-accent-muted)', label: 'Empirical' }
    : undefined
  const theoDiscreteSeries: DiscreteSeries | undefined = pmfSeries
    ? { ...pmfSeries, id: 'theo-pmf', color: '#2E8B57', label: 'Theoretical' }
    : undefined

  const yMax = isDiscrete
    ? Math.max(...(empPMF.map(([,y]) => y)), ...(pmfSeries?.points.map(([,y]) => y) ?? [])) * 1.15
    : Math.max(yMaxPDF, histBars.reduce((m, b) => Math.max(m, b.density), 0)) * 1.1

  const series: (HistSeries | LineSeries | DiscreteSeries)[] = isDiscrete
    ? ([empDiscreteSeries, theoDiscreteSeries].filter(Boolean) as DiscreteSeries[])
    : (histBars.length > 0 && pdfOverlay
        ? [histSeries, pdfOverlay]
        : pdfSeries ? [pdfSeries] : [])

  return (
    <div className="p-4 space-y-3">
      {/* Controls */}
      <div className="flex items-center gap-3">
        <span className="text-text-muted">n =</span>
        {[500, 2000, 5000, 10000].map(n => (
          <button key={n} onClick={() => setSampleN(n)}
            className={`px-2.5 py-1 rounded border text-xs transition-colors ${
              sampleN === n
                ? 'border-accent bg-accent-light text-accent font-medium'
                : 'border-border text-text-secondary hover:border-accent/50'
            }`}
          >{n.toLocaleString()}</button>
        ))}
        <button onClick={resample}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded border border-border bg-elevated text-text-secondary hover:bg-border/60 transition-colors"
        >
          <RefreshCw size={11} /><span>Resample</span>
        </button>
      </div>

      {/* Plot */}
      <div className="border border-border rounded-md overflow-hidden bg-surface p-2">
        <Plot
          series={series}
          xDomain={xDom}
          yDomain={[0, isFinite(yMax) && yMax > 0 ? yMax : 1]}
          xLabel="x" yLabel={isDiscrete ? 'Probability' : 'Density'}
          vw={540} vh={190}
        />
      </div>

      {/* Moments comparison */}
      {empStats && (
        <div className="rounded-md border border-border overflow-hidden">
          <div className="grid grid-cols-5 bg-elevated px-3 py-1.5 border-b border-border">
            <span className="text-text-muted"></span>
            <span className="text-text-muted text-center">Mean</span>
            <span className="text-text-muted text-center">Std Dev</span>
            <span className="text-text-muted text-center">Skewness</span>
            <span className="text-text-muted text-center">Ex. Kurtosis</span>
          </div>
          <div className="grid grid-cols-5 px-3 py-2 bg-surface">
            <span className="font-medium text-text-secondary">Empirical</span>
            <span className="font-mono text-center text-text-secondary">{empStats.mean.toFixed(3)}</span>
            <span className="font-mono text-center text-text-secondary">{empStats.std.toFixed(3)}</span>
            <span className="font-mono text-center text-text-secondary">{empStats.skewness.toFixed(3)}</span>
            <span className="font-mono text-center text-text-secondary">{empStats.kurtosis.toFixed(3)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function TailsTab({ tailSeries, vLines, varTable, xDom }: {
  tailSeries: LineSeries; vLines: VLine[]
  varTable: { alpha: number; q: number; label: string }[]
  xDom: [number, number]
}) {
  return (
    <div className="p-4 space-y-3">
      <div className="border border-border rounded-md overflow-hidden bg-surface p-2">
        <p className="label-xs mb-1.5 px-1">Log-scale density — right-tail quantiles marked</p>
        <Plot series={[tailSeries]} vlines={vLines} xDomain={xDom} logY yLabel="log f(x)" vw={540} vh={200} />
      </div>
      {varTable.length > 0 && (
        <div className="rounded-md border border-border overflow-hidden">
          <div className="grid grid-cols-3 bg-elevated px-4 py-1.5 border-b border-border">
            <span className="text-text-muted">Confidence</span>
            <span className="text-text-muted text-center">Upper quantile (VaR)</span>
            <span className="text-text-muted text-center">Tail prob P(X &gt; q)</span>
          </div>
          {varTable.map(row => (
            <div key={row.alpha} className="grid grid-cols-3 px-4 py-2 border-b border-border last:border-0 bg-surface">
              <span className="font-medium text-text-secondary">{row.label}</span>
              <span className="font-mono text-center text-accent">{fmtMoment(row.q)}</span>
              <span className="font-mono text-center text-text-muted">{row.alpha}</span>
            </div>
          ))}
        </div>
      )}
      <p className="text-text-muted text-[10px]">
        Straight line = exponential tail. Concave (slower decay) = power-law / heavy tail.
      </p>
    </div>
  )
}

function MomentsTab({ dist, params }: { dist: DistributionDef; params: Params }) {
  const mean     = dist.mean(params)
  const variance = dist.variance(params)
  const std      = variance !== null && variance >= 0 ? Math.sqrt(variance) : null
  const skew     = dist.skewness(params)
  const kurt     = dist.kurtosis(params)
  const entropy  = dist.entropy?.(params) ?? null
  const cv       = mean !== null && std !== null && mean !== 0 ? std / Math.abs(mean) : null

  const rows = [
    { label: 'Mean (μ)',             val: mean,     desc: 'Expected value E[X]' },
    { label: 'Variance (σ²)',        val: variance, desc: 'E[(X−μ)²]' },
    { label: 'Std Deviation (σ)',    val: std,      desc: '√Var(X)' },
    { label: 'Skewness (γ₁)',        val: skew,     desc: 'E[(X−μ)³]/σ³ — asymmetry' },
    { label: 'Excess Kurtosis (γ₂)', val: kurt,     desc: 'E[(X−μ)⁴]/σ⁴ − 3 — tail weight' },
    { label: 'Entropy (H)',          val: entropy,  desc: '−∫ f ln f  (nats)' },
    { label: 'Coeff. of Variation',  val: cv,       desc: 'σ/|μ|' },
  ]

  const skewVal = typeof skew === 'number' && isFinite(skew) ? Math.max(-4, Math.min(4, skew)) : 0

  return (
    <div className="p-4 space-y-3">
      <div className="rounded-md border border-border overflow-hidden">
        {rows.map((r, i) => (
          <div key={r.label} className={`grid grid-cols-3 gap-2 px-4 py-2.5 border-b border-border last:border-0 ${i%2===0?'bg-surface':'bg-elevated'}`}>
            <span className="font-medium text-text-secondary">{r.label}</span>
            <span className={`font-mono text-center ${r.val === null ? 'text-text-muted' : 'text-accent'}`}>
              {fmtMoment(r.val)}
            </span>
            <span className="text-text-muted text-[10px] self-center">{r.desc}</span>
          </div>
        ))}
      </div>
      {skew !== null && (
        <div className="rounded-md border border-border bg-surface px-4 py-3">
          <p className="label-xs mb-2">Skewness indicator  γ₁ = {fmtMoment(skew)}</p>
          <div className="relative h-3 bg-elevated rounded-full overflow-hidden">
            <div className="absolute inset-y-0 left-1/2 w-px bg-border-strong" />
            <div
              className="absolute inset-y-0 rounded-full transition-all duration-300"
              style={{
                backgroundColor: 'var(--color-accent)',
                left: skewVal < 0 ? `${50 + skewVal * 10}%` : '50%',
                right: skewVal > 0 ? `${50 - skewVal * 10}%` : '50%',
                minWidth: 2,
              }}
            />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-text-muted text-[9px]">← left-skewed</span>
            <span className="text-text-muted text-[9px]">right-skewed →</span>
          </div>
        </div>
      )}
      <p className="text-text-muted text-[10px]">— indicates undefined/infinite moment.</p>
    </div>
  )
}

function CompareTab({ compPdfA, compPdfB, xDom, distA, paramsA, distB, paramsB, allDists, compId, switchComp, setCompParam }: {
  compPdfA: LineSeries; compPdfB: LineSeries; xDom: [number, number]
  distA: DistributionDef; paramsA: Params
  distB: DistributionDef; paramsB: Params
  allDists: typeof DISTRIBUTIONS; compId: string
  switchComp: (id: string) => void
  setCompParam: (key: string, val: number) => void
}) {
  const yMax = Math.max(
    ...compPdfA.points.map(([,y]) => isFinite(y) ? y : 0),
    ...compPdfB.points.map(([,y]) => isFinite(y) ? y : 0),
  ) * 1.08

  const moments = [
    { label: 'Mean',     a: distA.mean(paramsA),     b: distB.mean(paramsB)     },
    { label: 'Variance', a: distA.variance(paramsA), b: distB.variance(paramsB) },
    { label: 'Skewness', a: distA.skewness(paramsA), b: distB.skewness(paramsB) },
    { label: 'Kurtosis', a: distA.kurtosis(paramsA), b: distB.kurtosis(paramsB) },
  ]

  const is2DSelected = !!distA.is2D || !!distB.is2D

  return (
    <div className="p-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-text-muted font-medium">Compare with:</span>
        <select
          value={compId}
          onChange={e => switchComp(e.target.value)}
          className="border border-border rounded px-2 py-1 bg-surface text-text-secondary text-xs focus:outline-none focus:ring-1 focus:ring-accent"
        >
          {Object.entries(DIST_CATEGORIES).map(([cat, ids]) => (
            <optgroup key={cat} label={CATEGORY_LABEL[cat as keyof typeof CATEGORY_LABEL] ?? cat}>
              {ids.map(id => (
                <option key={id} value={id}>{allDists[id].name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {is2DSelected ? (
        <div className="text-text-muted text-xs p-4 border border-border rounded-md bg-surface text-center">
          2D distributions (copulas, multivariate) are visualised in the Density tab.
        </div>
      ) : (
        <>
          {/* Comparison params */}
          <div className="flex flex-wrap gap-3">
            {distB.params.map(ps => (
              <div key={ps.key} className="flex items-center gap-2">
                <span className="font-mono text-text-muted w-16 truncate">{ps.label}</span>
                <input
                  type="range" min={ps.min} max={ps.max} step={ps.step}
                  value={paramsB[ps.key] ?? ps.default}
                  onChange={e => setCompParam(ps.key, parseFloat(e.target.value))}
                  className="w-20 accent-crimson h-1 cursor-pointer"
                />
                <span className="font-mono text-text-secondary w-8 text-right tabular-nums">
                  {(paramsB[ps.key] ?? ps.default).toFixed(1)}
                </span>
              </div>
            ))}
          </div>

          <div className="border border-border rounded-md overflow-hidden bg-surface p-2">
            <Plot
              series={[compPdfA, compPdfB]}
              xDomain={xDom}
              yDomain={[0, isFinite(yMax) && yMax > 0 ? yMax : 1]}
              yLabel="f(x)" vw={540} vh={190}
            />
          </div>
        </>
      )}

      <div className="rounded-md border border-border overflow-hidden">
        <div className="grid grid-cols-3 bg-elevated px-4 py-1.5 border-b border-border">
          <span className="text-text-muted">Moment</span>
          <span className="text-accent text-center font-medium">{distA.name}</span>
          <span className="text-center font-medium" style={{ color: '#B0392B' }}>{distB.name}</span>
        </div>
        {moments.map(m => (
          <div key={m.label} className="grid grid-cols-3 px-4 py-2 border-b border-border last:border-0 bg-surface">
            <span className="text-text-secondary">{m.label}</span>
            <span className="font-mono text-center text-accent">{fmtMoment(m.a)}</span>
            <span className="font-mono text-center" style={{ color: '#B0392B' }}>{fmtMoment(m.b)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// 2D HEATMAP  (bivariate normal + copulas)
// ═══════════════════════════════════════════════════════════════════════════

function Heatmap2DPanel({ params, dist }: { params: Params; dist: DistributionDef }) {
  const uid = useId()
  const GRID = 40, W = 260, H = 260, PAD = 30

  const domain2d = dist.plotDomain2d?.(params) ?? { x: [0, 1], y: [0, 1] }

  const data = useMemo(() => {
    const { x: [xlo, xhi], y: [ylo, yhi] } = domain2d
    const cells: { x: number; y: number; v: number }[] = []
    let maxV = 0
    for (let i = 0; i < GRID; i++) {
      for (let j = 0; j < GRID; j++) {
        const x = xlo + (i + 0.5) / GRID * (xhi - xlo)
        const y = ylo + (j + 0.5) / GRID * (yhi - ylo)
        const v = dist.density2d ? dist.density2d(x, y, params) : 0
        cells.push({ x, y, v })
        if (v > maxV) maxV = v
      }
    }
    return { cells, maxV, xlo, xhi, ylo, yhi }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, dist.id])

  const scatter = useMemo(
    () => dist.sample2d ? dist.sample2d(600, params) : [],
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [params, dist.id])

  const pw = W - PAD * 2, ph = H - PAD * 2
  const sx = (x: number) => PAD + (x - data.xlo) / (data.xhi - data.xlo) * pw
  const sy = (y: number) => PAD + (1 - (y - data.ylo) / (data.yhi - data.ylo)) * ph
  const cellW = pw / GRID, cellH = ph / GRID

  const isCopula = dist.category === 'copula'

  return (
    <div className="p-4 flex gap-4 flex-wrap">
      <div className="border border-border rounded-md overflow-hidden bg-surface p-2">
        <p className="label-xs mb-1.5 px-1">Joint density</p>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
          {data.cells.map((c, i) => {
            const t = data.maxV > 0 ? c.v / data.maxV : 0
            const alpha = Math.pow(t, 0.5) * 0.85
            return (
              <rect key={i}
                x={sx(c.x) - cellW/2} y={sy(c.y) - cellH/2}
                width={cellW + 0.5} height={cellH + 0.5}
                fill={`rgba(26,26,110,${alpha})`}
              />
            )
          })}
          <line x1={PAD} y1={PAD} x2={PAD} y2={PAD+ph} stroke="var(--color-border-strong)" strokeWidth="1" />
          <line x1={PAD} y1={PAD+ph} x2={PAD+pw} y2={PAD+ph} stroke="var(--color-border-strong)" strokeWidth="1" />
          <text x={PAD+pw/2} y={H-4} textAnchor="middle" fontSize="9" fill="var(--color-muted)" fontFamily="monospace">{isCopula ? 'u' : 'x₁'}</text>
          <text x={8} y={PAD+ph/2} textAnchor="middle" fontSize="9" fill="var(--color-muted)" fontFamily="monospace" transform={`rotate(-90,8,${PAD+ph/2})`}>{isCopula ? 'v' : 'x₂'}</text>
        </svg>
      </div>

      <div className="border border-border rounded-md overflow-hidden bg-surface p-2">
        <p className="label-xs mb-1.5 px-1">Scatter sample (n=600)</p>
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
          {scatter.map(([x, y], i) => {
            const cx = PAD + (x - data.xlo) / (data.xhi - data.xlo) * pw
            const cy = PAD + (1 - (y - data.ylo) / (data.yhi - data.ylo)) * ph
            if (!isFinite(cx) || !isFinite(cy)) return null
            return <circle key={i} cx={cx} cy={cy} r={1.4} fill="var(--color-accent)" opacity={0.4} />
          })}
          <line x1={PAD} y1={PAD} x2={PAD} y2={PAD+ph} stroke="var(--color-border-strong)" strokeWidth="1" />
          <line x1={PAD} y1={PAD+ph} x2={PAD+pw} y2={PAD+ph} stroke="var(--color-border-strong)" strokeWidth="1" />
          <text x={PAD+pw/2} y={H-4} textAnchor="middle" fontSize="9" fill="var(--color-muted)" fontFamily="monospace">{isCopula ? 'u' : 'x₁'}</text>
          <text x={8} y={PAD+ph/2} textAnchor="middle" fontSize="9" fill="var(--color-muted)" fontFamily="monospace" transform={`rotate(-90,8,${PAD+ph/2})`}>{isCopula ? 'v' : 'x₂'}</text>
        </svg>
      </div>

      <div className="flex flex-col gap-1 text-xs text-text-secondary">
        {isCopula
          ? <p className="label-xs">Marginals are Uniform(0,1)</p>
          : <p className="label-xs">ρ = {params.rho?.toFixed(2)}</p>
        }
        <p className="text-text-muted text-[10px] max-w-xs leading-relaxed mt-1">
          {isCopula
            ? 'Copula density concentrated near corners = tail dependence. Diagonal concentration = positive dependence.'
            : 'Heatmap shows density contours. At ρ=0 ellipses are axis-aligned; |ρ|→1 collapses to a line.'
          }
        </p>
      </div>
    </div>
  )
}
