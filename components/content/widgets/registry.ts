// ── Widget Registry ───────────────────────────────────────────────────────────
// Maps widget IDs (used in MDX <Widget id="..."> tags) to React components.
//
// All widgets are dynamically imported so each widget's JS bundle is only
// fetched when a page that references it is rendered.
//
// IMPORTANT: next/dynamic requires the options object to be an inline literal —
// it cannot be extracted into a variable (the compiler needs to analyse it
// statically). Every call therefore repeats { ssr: false } explicitly.

import type { ComponentType } from 'react'
import dynamic from 'next/dynamic'

const EigendecompositionExplorer = dynamic(
  () => import('./EigendecompositionExplorer').then(m => ({ default: m.EigendecompositionExplorer })),
  { ssr: false })

const DistributionEngine = dynamic(
  () => import('./distributions/DistributionEngine').then(m => ({ default: m.DistributionEngine })),
  { ssr: false })

const CLTSimulator = dynamic(
  () => import('./CLTSimulator').then(m => ({ default: m.CLTSimulator })),
  { ssr: false })

const LinearTransformViz = dynamic(
  () => import('./LinearTransformViz').then(m => ({ default: m.LinearTransformViz })),
  { ssr: false })

const DistributionExplorer = dynamic(
  () => import('./DistributionExplorer').then(m => ({ default: m.DistributionExplorer })),
  { ssr: false })

const BrownianMotion = dynamic(
  () => import('./BrownianMotion').then(m => ({ default: m.BrownianMotion })),
  { ssr: false })

const SDESolver = dynamic(
  () => import('./SDESolver').then(m => ({ default: m.SDESolver })),
  { ssr: false })

const MartingaleViz = dynamic(
  () => import('./MartingaleViz').then(m => ({ default: m.MartingaleViz })),
  { ssr: false })

const MeasureTheory = dynamic(
  () => import('./MeasureTheory').then(m => ({ default: m.MeasureTheory })),
  { ssr: false })

const GaussianProcess = dynamic(
  () => import('./GaussianProcess').then(m => ({ default: m.GaussianProcess })),
  { ssr: false })

const MCMCSimulator = dynamic(
  () => import('./MCMCSimulator').then(m => ({ default: m.MCMCSimulator })),
  { ssr: false })

const BiasVariance = dynamic(
  () => import('./BiasVariance').then(m => ({ default: m.BiasVariance })),
  { ssr: false })

const KernelViz = dynamic(
  () => import('./KernelViz').then(m => ({ default: m.KernelViz })),
  { ssr: false })

const PCAExplorer = dynamic(
  () => import('./PCAExplorer').then(m => ({ default: m.PCAExplorer })),
  { ssr: false })

const CurseDimensionality = dynamic(
  () => import('./CurseDimensionality').then(m => ({ default: m.CurseDimensionality })),
  { ssr: false })

const CausalDAG = dynamic(
  () => import('./CausalDAG').then(m => ({ default: m.CausalDAG })),
  { ssr: false })

const EntropyKL = dynamic(
  () => import('./EntropyKL').then(m => ({ default: m.EntropyKL })),
  { ssr: false })

const KnowledgeGraph = dynamic(
  () => import('./KnowledgeGraph').then(m => ({ default: m.KnowledgeGraph })),
  { ssr: false })

const CramerRaoExplorer = dynamic(
  () => import('./CramerRaoExplorer').then(m => ({ default: m.CramerRaoExplorer })),
  { ssr: false })

const PowerFunction = dynamic(
  () => import('./PowerFunction').then(m => ({ default: m.PowerFunction })),
  { ssr: false })

const ConjugateAnalysis = dynamic(
  () => import('./ConjugateAnalysis').then(m => ({ default: m.ConjugateAnalysis })),
  { ssr: false })

export const WIDGET_REGISTRY: Record<string, ComponentType> = {
  'eigendecomposition-explorer': EigendecompositionExplorer,
  'distribution-engine':         DistributionEngine,
  'clt-simulator':               CLTSimulator,
  'linear-transform-viz':        LinearTransformViz,
  'distribution-explorer':       DistributionExplorer,
  'brownian-motion':             BrownianMotion,
  'sde-solver':                  SDESolver,
  'martingale-viz':              MartingaleViz,
  'measure-theory':              MeasureTheory,
  'gaussian-process':            GaussianProcess,
  'mcmc-simulator':              MCMCSimulator,
  'bias-variance':               BiasVariance,
  'kernel-viz':                  KernelViz,
  'pca-explorer':                PCAExplorer,
  'curse-dimensionality':        CurseDimensionality,
  'causal-dag':                  CausalDAG,
  'entropy-kl':                  EntropyKL,
  'knowledge-graph':             KnowledgeGraph,
  'cramer-rao-explorer':         CramerRaoExplorer,
  'power-function':              PowerFunction,
  'conjugate-analysis':          ConjugateAnalysis,
}
