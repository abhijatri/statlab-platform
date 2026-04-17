// Navigation configuration — single source of truth for all routing.
// Pages reference these constants; never hardcode paths in components.

export interface NavLeaf {
  kind: 'leaf'
  id: string
  label: string
  href: string
  badge?: string
}

export interface NavBranch {
  kind: 'branch'
  id: string
  label: string
  href: string
  children: NavLeaf[]
}

export interface NavSection {
  kind: 'section'
  id: string
  label: string
  items: Array<NavLeaf | NavBranch>
}

export type NavEntry = NavLeaf | NavSection

// ── Top-level entries shown above sections ────────────────────────────────────

export const NAV_TOP: NavLeaf[] = [
  { kind: 'leaf', id: 'home', label: 'Home', href: '/' },
]

// ── Main navigation ───────────────────────────────────────────────────────────

export const NAV_SECTIONS: NavSection[] = [
  {
    kind: 'section',
    id: 'modules',
    label: 'Modules',
    items: [
      { kind: 'leaf', id: 'lab', label: 'Interactive Lab', href: '/lab', badge: 'Live' },
      { kind: 'leaf', id: 'distributions', label: 'Distribution Lab', href: '/distributions' },
      { kind: 'leaf', id: 'graph', label: 'Knowledge Graph', href: '/graph' },
    ],
  },
  {
    kind: 'section',
    id: 'topics',
    label: 'Topics',
    items: [
      {
        kind: 'branch',
        id: 'estimation',
        label: 'Estimation Theory',
        href: '/topics/estimation',
        children: [
          { kind: 'leaf', id: 'fisher-information', label: 'Fisher Information', href: '/concepts/fisher-information' },
          { kind: 'leaf', id: 'cramer-rao', label: 'Cramér-Rao Bound', href: '/concepts/cramer-rao-bound' },
          { kind: 'leaf', id: 'sufficiency', label: 'Sufficiency & UMVUE', href: '/concepts/sufficiency' },
          { kind: 'leaf', id: 'mle', label: 'Maximum Likelihood', href: '/concepts/mle' },
          { kind: 'leaf', id: 'exponential-family', label: 'Exponential Families', href: '/concepts/exponential-family' },
          { kind: 'leaf', id: 'bias-variance', label: 'Bias-Variance Tradeoff', href: '/concepts/bias-variance' },
        ],
      },
      {
        kind: 'branch',
        id: 'testing',
        label: 'Hypothesis Testing',
        href: '/topics/testing',
        children: [
          { kind: 'leaf', id: 'neyman-pearson', label: 'Neyman-Pearson Lemma', href: '/concepts/neyman-pearson' },
          { kind: 'leaf', id: 'ump-tests', label: 'UMP & UMPU Tests', href: '/concepts/ump-tests' },
          { kind: 'leaf', id: 'likelihood-ratio', label: 'Likelihood Ratio Tests', href: '/concepts/likelihood-ratio' },
          { kind: 'leaf', id: 'power-analysis', label: 'Power Analysis', href: '/concepts/power-analysis' },
        ],
      },
      {
        kind: 'branch',
        id: 'asymptotics',
        label: 'Asymptotic Theory',
        href: '/topics/asymptotics',
        children: [
          { kind: 'leaf', id: 'clt-variants', label: 'CLT & Variants', href: '/concepts/clt-variants' },
          { kind: 'leaf', id: 'berry-esseen', label: 'Berry-Esseen Theorem', href: '/concepts/berry-esseen' },
          { kind: 'leaf', id: 'delta-method', label: 'Delta Method', href: '/concepts/delta-method' },
          { kind: 'leaf', id: 'lan', label: 'Local Asymptotic Normality', href: '/concepts/lan' },
          { kind: 'leaf', id: 'contiguity', label: 'Contiguity', href: '/concepts/contiguity' },
          { kind: 'leaf', id: 'clt', label: 'CLT Simulator', href: '/concepts/clt' },
          { kind: 'leaf', id: 'law-of-large-numbers', label: 'Law of Large Numbers', href: '/concepts/law-of-large-numbers' },
        ],
      },
      {
        kind: 'branch',
        id: 'bayesian',
        label: 'Bayesian Inference',
        href: '/topics/bayesian',
        children: [
          { kind: 'leaf', id: 'conjugate-priors', label: 'Conjugate Priors', href: '/concepts/conjugate-priors' },
          { kind: 'leaf', id: 'bernstein-von-mises', label: 'Bernstein-von Mises', href: '/concepts/bernstein-von-mises' },
          { kind: 'leaf', id: 'posterior-contraction', label: 'Posterior Contraction', href: '/concepts/posterior-contraction' },
          { kind: 'leaf', id: 'mcmc', label: 'MCMC Methods', href: '/concepts/mcmc' },
        ],
      },
      {
        kind: 'branch',
        id: 'advanced',
        label: 'Advanced Topics',
        href: '/topics/advanced',
        children: [
          { kind: 'leaf', id: 'gaussian-process', label: 'Gaussian Processes', href: '/concepts/gaussian-process' },
          { kind: 'leaf', id: 'kernel-methods', label: 'Kernel Methods', href: '/concepts/kernel-methods' },
          { kind: 'leaf', id: 'lebesgue-integration', label: 'Lebesgue Integration', href: '/concepts/lebesgue-integration' },
          { kind: 'leaf', id: 'eigendecomposition', label: 'Eigendecomposition', href: '/concepts/eigendecomposition' },
          { kind: 'leaf', id: 'linear-transform', label: 'Linear Transforms', href: '/concepts/linear-transform' },
          { kind: 'leaf', id: 'distribution-explorer', label: 'Distribution Explorer', href: '/concepts/distribution-explorer' },
        ],
      },
    ],
  },
  {
    kind: 'section',
    id: 'explore',
    label: 'Explore',
    items: [
      { kind: 'leaf', id: 'topics-explorer', label: 'Topic Explorer', href: '/topics' },
      { kind: 'leaf', id: 'all-concepts', label: 'All Concepts', href: '/concepts' },
    ],
  },
]

// ── Route metadata — used by Header, page titles, breadcrumbs ─────────────────

export interface RouteMetadata {
  title: string
  description: string
  topic?: string
}

export const ROUTE_METADATA: Record<string, RouteMetadata> = {
  '/': { title: 'StatLab', description: 'Research-grade interactive statistics' },
  '/lab': { title: 'Interactive Lab', description: 'Explore estimation, testing, asymptotics, and Bayesian inference', topic: 'Modules' },
  '/distributions': { title: 'Distribution Lab', description: 'Properties, estimation, and relationships of probability distributions', topic: 'Modules' },
  '/graph': { title: 'Knowledge Graph', description: 'Navigate the statistical concept space', topic: 'Modules' },
  '/topics': { title: 'Topic Explorer', description: 'Browse statistical theory by subject area', topic: 'Explore' },
  '/concepts': { title: 'All Concepts', description: 'Complete index of statistical concepts', topic: 'Explore' },
  '/topics/estimation': { title: 'Estimation Theory', description: 'Point estimation, Fisher information, and optimal estimators', topic: 'Topics' },
  '/topics/testing': { title: 'Hypothesis Testing', description: 'Optimal tests, power functions, and likelihood theory', topic: 'Topics' },
  '/topics/asymptotics': { title: 'Asymptotic Theory', description: 'Convergence, CLT, and large-sample methods', topic: 'Topics' },
  '/topics/bayesian': { title: 'Bayesian Inference', description: 'Prior-to-posterior analysis and Bayesian asymptotics', topic: 'Topics' },
  '/topics/advanced': { title: 'Advanced Topics', description: 'Gaussian processes, kernel methods, measure theory, and linear algebra', topic: 'Topics' },
}
