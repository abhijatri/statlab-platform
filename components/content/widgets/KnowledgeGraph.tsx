'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'

// ── Types ─────────────────────────────────────────────────────────────────────

type Level = 'foundation' | 'core' | 'intermediate' | 'advanced' | 'expert'
type InsightTab = 'quote' | 'fact' | 'history' | 'misconception'

interface Node {
  id: string
  label: string
  sublabel: string
  level: Level
  href: string | null
  x: number
  y: number
}

interface Edge {
  from: string
  to: string
}

interface NodeInsight {
  quote: string
  attribution: string
  fact: string
  history: string
  misconception: string
}

// ── Layout constants ──────────────────────────────────────────────────────────

const W = 900
const H = 620

// Node colors: intentional data-viz palette, same in both themes
// (the SVG chrome — edges, level labels — uses CSS variables)
const LEVEL_COLOR: Record<Level, { fill: string; stroke: string; text: string }> = {
  foundation:   { fill: '#e2e8f0', stroke: '#94a3b8', text: '#1e293b' },
  core:         { fill: '#dbeafe', stroke: '#3b82f6', text: '#1e3a8a' },
  intermediate: { fill: '#dcfce7', stroke: '#22c55e', text: '#14532d' },
  advanced:     { fill: '#fef9c3', stroke: '#eab308', text: '#713f12' },
  expert:       { fill: '#fce7f3', stroke: '#ec4899', text: '#831843' },
}

// ── Nodes ─────────────────────────────────────────────────────────────────────

const NODES: Node[] = [
  // Foundation
  { id: 'probability',           label: 'Probability',      sublabel: 'Measure-theoretic foundations',  level: 'foundation',   href: '/concepts/lebesgue-integration',  x: 150, y: 60  },
  { id: 'distributions',         label: 'Distributions',    sublabel: 'Parametric families, moments',   level: 'foundation',   href: '/concepts/distributions',         x: 450, y: 60  },
  { id: 'linear-algebra',        label: 'Linear Algebra',   sublabel: 'Vectors, matrices, transforms',  level: 'foundation',   href: '/concepts/linear-transform',      x: 750, y: 60  },
  // Core
  { id: 'clt',                   label: 'CLT',              sublabel: 'Central limit theorem',          level: 'core',         href: '/concepts/clt',                   x: 120, y: 180 },
  { id: 'distribution-explorer', label: 'Dist. Explorer',   sublabel: 'Interactive sampling & fit',    level: 'core',         href: '/concepts/distribution-explorer', x: 350, y: 180 },
  { id: 'eigendecomposition',    label: 'Eigendecomp.',     sublabel: 'Spectral decomposition',         level: 'core',         href: '/concepts/eigendecomposition',    x: 600, y: 180 },
  { id: 'measure-theory',        label: 'Measure Theory',   sublabel: 'Lebesgue integration',           level: 'core',         href: '/concepts/lebesgue-integration',  x: 820, y: 180 },
  // Intermediate
  { id: 'entropy-kl',            label: 'Entropy & KL',     sublabel: 'Information theory',             level: 'intermediate', href: null,                              x: 100, y: 310 },
  { id: 'mcmc',                  label: 'MCMC',             sublabel: 'Metropolis-Hastings sampling',   level: 'intermediate', href: '/concepts/mcmc',                  x: 300, y: 310 },
  { id: 'bias-variance',         label: 'Bias-Variance',    sublabel: 'Decomposition & tradeoff',       level: 'intermediate', href: '/concepts/bias-variance',         x: 510, y: 310 },
  { id: 'pca',                   label: 'PCA',              sublabel: 'Principal component analysis',   level: 'intermediate', href: null,                              x: 710, y: 310 },
  // Advanced
  { id: 'gaussian-process',      label: 'Gaussian Process', sublabel: 'Posterior inference, kernels',   level: 'advanced',     href: '/concepts/gaussian-process',      x: 140, y: 440 },
  { id: 'kernel-methods',        label: 'Kernel Methods',   sublabel: 'NW estimator, SVM intuition',    level: 'advanced',     href: '/concepts/kernel-methods',        x: 380, y: 440 },
  { id: 'causal-dag',            label: 'Causal DAG',       sublabel: 'd-separation, interventions',    level: 'advanced',     href: null,                              x: 620, y: 440 },
  { id: 'curse-dim',             label: 'Curse of Dim.',    sublabel: 'High-dimensional geometry',      level: 'advanced',     href: null,                              x: 830, y: 440 },
  // Expert
  { id: 'sde',                   label: 'SDEs',             sublabel: 'Stochastic differential eqs.',   level: 'expert',       href: null,                              x: 230, y: 570 },
  { id: 'martingale',            label: 'Martingales',      sublabel: 'Optional stopping, filtrations', level: 'expert',       href: null,                              x: 500, y: 570 },
  { id: 'brownian',              label: 'Brownian Motion',  sublabel: 'Wiener process, Itô calculus',   level: 'expert',       href: null,                              x: 760, y: 570 },
]

// ── Edges ─────────────────────────────────────────────────────────────────────

const EDGES: Edge[] = [
  { from: 'probability',           to: 'clt'                  },
  { from: 'probability',           to: 'distribution-explorer'},
  { from: 'probability',           to: 'measure-theory'       },
  { from: 'distributions',         to: 'clt'                  },
  { from: 'distributions',         to: 'distribution-explorer'},
  { from: 'linear-algebra',        to: 'eigendecomposition'   },
  { from: 'linear-algebra',        to: 'measure-theory'       },
  { from: 'distributions',         to: 'entropy-kl'           },
  { from: 'measure-theory',        to: 'entropy-kl'           },
  { from: 'distributions',         to: 'mcmc'                 },
  { from: 'clt',                   to: 'mcmc'                 },
  { from: 'clt',                   to: 'bias-variance'        },
  { from: 'distribution-explorer', to: 'bias-variance'        },
  { from: 'eigendecomposition',    to: 'pca'                  },
  { from: 'linear-algebra',        to: 'pca'                  },
  { from: 'distributions',         to: 'gaussian-process'     },
  { from: 'measure-theory',        to: 'gaussian-process'     },
  { from: 'entropy-kl',            to: 'gaussian-process'     },
  { from: 'bias-variance',         to: 'kernel-methods'       },
  { from: 'pca',                   to: 'kernel-methods'       },
  { from: 'pca',                   to: 'curse-dim'            },
  { from: 'entropy-kl',            to: 'causal-dag'           },
  { from: 'mcmc',                  to: 'causal-dag'           },
  { from: 'gaussian-process',      to: 'sde'                  },
  { from: 'measure-theory',        to: 'sde'                  },
  { from: 'measure-theory',        to: 'martingale'           },
  { from: 'mcmc',                  to: 'martingale'           },
  { from: 'sde',                   to: 'brownian'             },
  { from: 'martingale',            to: 'brownian'             },
  { from: 'gaussian-process',      to: 'brownian'             },
]

// ── Academic insights ─────────────────────────────────────────────────────────

const INSIGHTS: Record<string, NodeInsight> = {
  probability: {
    quote: 'The theory of probability as a mathematical discipline can and should be developed from axioms in exactly the same way as Geometry and Algebra.',
    attribution: 'Andrei Kolmogorov, Grundbegriffe der Wahrscheinlichkeitsrechnung (1933)',
    fact: 'The Borel–Cantelli lemma implies a fair coin tossed infinitely often shows heads infinitely often with probability 1 — yet any specific infinite sequence has probability exactly 0. Probability 0 and impossibility are not synonymous.',
    history: 'Kolmogorov\'s 1933 axiomatization unified frequentist and subjective probability under measure theory, resolving over 200 years of foundational ambiguity about what "probability" actually means mathematically.',
    misconception: '"Probability 0 means impossible." A continuous random variable takes any specific value with probability 0, yet it must take some value. Probability zero is a statement about measure, not about possibility.',
  },
  distributions: {
    quote: 'All models are wrong, but some are useful.',
    attribution: 'George Box, Journal of the American Statistical Association (1976)',
    fact: 'The normal distribution maximizes entropy among all distributions with fixed mean and variance — it is the "maximally uncertain" distribution given only those two constraints. This is why it appears so universally: it encodes minimal assumptions.',
    history: 'De Moivre derived the normal approximation to the binomial in 1733 as a computational shortcut, 75 years before Gauss or Laplace formalized it. It appeared in his work on gambling annuities, not physics.',
    misconception: '"The CLT justifies assuming normality." The CLT applies to sums and averages of measurements, not to the measurements themselves. Many natural phenomena are lognormal, Pareto, or heavy-tailed, and fitting a Gaussian to them discards that structure.',
  },
  'linear-algebra': {
    quote: 'The integers came from God. Everything else is the work of man. But the eigenvectors came from the data.',
    attribution: 'Attributed to Leopold Kronecker, paraphrased in the context of spectral methods',
    fact: 'The determinant of a matrix equals the product of its eigenvalues, and the trace equals their sum. You can therefore read the characteristic polynomial\'s first and last coefficients directly from spectral properties — no row operations required.',
    history: 'Cayley published the first abstract definition of matrix multiplication in 1858, but Grassmann\'s exterior algebra (1844) predated it as a more general framework and was almost entirely ignored for decades, rediscovered only after linear algebra had been independently rebuilt.',
    misconception: '"Solving Ax = b means computing A⁻¹." No numerical software computes A⁻¹ for linear systems. LU decomposition solves in O(n²) per right-hand side after O(n³) factorization; full inversion costs the same as n solves with no reuse benefit.',
  },
  clt: {
    quote: 'The normal distribution plays the role of a fixed point in the space of probability distributions under convolution and normalization.',
    attribution: 'Gnedenko & Kolmogorov, Limit Distributions for Sums of Independent Random Variables (1954)',
    fact: 'The CLT fails for distributions without finite variance. The sum of n Cauchy random variables divided by n is still Cauchy — it never converges to a Gaussian regardless of sample size, because the Cauchy distribution is in its own basin of attraction (α-stable with α = 1).',
    history: 'Lyapunov proved the CLT in full generality in 1901 using characteristic functions (Fourier transforms of distributions), establishing the technique of working in frequency space that dominated probability theory for the next 50 years.',
    misconception: '"Large samples are always approximately normal." The CLT requires finite variance and an n large enough relative to the distribution\'s tail behavior. For α-stable distributions with α < 2, the limiting distribution is stable but non-Gaussian, regardless of sample size.',
  },
  'distribution-explorer': {
    quote: 'Far better an approximate answer to the right question, which is often vague, than an exact answer to the wrong question, which can always be made precise.',
    attribution: 'John Tukey, The Future of Data Analysis (1962)',
    fact: 'The Beta distribution is the exact conjugate prior for the Binomial. If your prior is Beta(α, β) and you observe k successes in n trials, the posterior is exactly Beta(α+k, β+n−k) — closed form, no approximation, regardless of how many observations you have.',
    history: 'Pearson introduced his system of distributions (Pearson Types I–VII) in 1895 as a unified family of curves to describe biological measurements. His system preceded the modern concept of a parametric family and was the foundation of early 20th-century statistical practice.',
    misconception: '"Fitting a distribution means finding the best-looking curve." Maximum likelihood estimation finds parameters that maximize the probability of the observed data under the model — not the parameters that minimize visual residuals between histogram bars and the fitted curve.',
  },
  eigendecomposition: {
    quote: 'The most important attribute of a matrix is not its rank or determinant but its spectrum — the set of eigenvalues tells you almost everything about the long-term behavior of the linear map.',
    attribution: 'Paul Halmos, A Hilbert Space Problem Book (1967)',
    fact: 'A real symmetric matrix is always diagonalizable with real eigenvalues and orthogonal eigenvectors — even when its non-symmetric counterpart may have complex eigenvalues or defective (non-diagonalizable) Jordan blocks.',
    history: 'Cauchy proved the spectral theorem for symmetric matrices in 1829, but it was not recognized as the foundation of the theory of self-adjoint operators until Hilbert\'s work in 1904–1910 extended it to infinite-dimensional function spaces.',
    misconception: '"Eigenvalues are only meaningful for square matrices." SVD extends the spectral concept to any m×n matrix: A = UΣVᵀ factors arbitrary matrices into orthogonal transformations and singular values, generalizing eigendecomposition completely.',
  },
  'measure-theory': {
    quote: 'Integration is not the operation of adding up function values — it is the operation of assigning consistent weights to sets, and letting the function ride on top of that structure.',
    attribution: 'Henri Lebesgue, Leçons sur l\'intégration (1904)',
    fact: 'The Dirichlet function (1 on rationals, 0 on irrationals) is not Riemann-integrable — upper and lower Riemann sums permanently disagree. Its Lebesgue integral is exactly 0, because the rationals have measure zero.',
    history: 'Lebesgue presented his integration theory as his 1902 doctoral thesis. Riemann had died in 1866; his integral had been the standard for 36 years. Within two decades, Lebesgue integration had entirely replaced it in advanced analysis and probability theory.',
    misconception: '"Measure theory is abstract formalism with no practical payoff." Every convergence theorem in probability (dominated convergence, monotone convergence), the entire theory of stochastic processes, and the Radon-Nikodym theorem (which defines conditional expectation rigorously) are all measure-theoretic results with no classical analogs.',
  },
  'entropy-kl': {
    quote: 'I thought of calling it "information", but the word was overly used. Von Neumann told me: call it entropy — nobody knows what entropy really is, so in a debate you will always have the advantage.',
    attribution: 'Claude Shannon, recounting a conversation with John von Neumann (1940s)',
    fact: 'KL divergence is not a distance — it is asymmetric and violates the triangle inequality. D(P‖Q) measures how many extra bits you need if you code P-distributed data using a code optimized for Q. D(Q‖P) measures the reverse, a fundamentally different quantity.',
    history: 'Shannon derived H = −Σpᵢ log pᵢ in 1948 independently of thermodynamics. Jaynes showed in 1957 that it is the unique functional satisfying three axioms: continuity in probabilities, maximality at uniform distribution, and consistency across partitions.',
    misconception: '"High entropy means the distribution is noisy." Entropy measures uncertainty over outcomes, not the presence of noise. A uniform distribution over 1,000,000 outcomes has higher entropy than a bimodal one — the bimodal one is "more certain" despite having the same support.',
  },
  mcmc: {
    quote: 'The Gibbs sampler provides a practical and general method for computing marginal and conditional distributions in cases where direct computation is hopelessly infeasible.',
    attribution: 'Gelfand & Smith, Journal of the American Statistical Association (1990)',
    fact: 'The Metropolis algorithm was invented in 1953 at Los Alamos for simulating statistical mechanics of hard-sphere fluids — one of the first non-trivial uses of a computer for random sampling. All five authors (Metropolis, Rosenbluth ×2, Teller ×2) were physicists, not statisticians.',
    history: 'Hastings generalized the algorithm in 1970 to allow asymmetric proposals, but the Bayesian statistics community did not notice until Gelfand & Smith (1990) and Gelman & Rubin (1992) packaged it for posterior inference. The 37-year gap is one of the longest unrecognized results in statistics.',
    misconception: '"More iterations means better MCMC." The relevant metric is effective sample size (ESS = N/(1+2Σρ(k))), not chain length. A highly autocorrelated chain of 1,000,000 steps can have ESS below 200 — worse than 300 independent samples from the true posterior.',
  },
  'bias-variance': {
    quote: 'The tradeoff between bias and variance is the central dilemma of statistical learning: perfect fit to training data guarantees poor fit to new data.',
    attribution: 'Geman, Bienenstock & Doursat, Neural Computation (1992)',
    fact: 'The irreducible error σ² (noise variance of the true data-generating process) sets an absolute floor on MSE that no algorithm can breach regardless of model complexity, training data size, or computational budget. It is irreducible by definition.',
    history: 'The bias-variance decomposition was formalized by Geman et al. in 1992 for neural networks, though Tikhonov had understood the regularization–complexity trade-off implicitly since 1943. The formal MSE decomposition clarified why regularization works mathematically.',
    misconception: '"Ensemble methods reduce both bias and variance." Averaging only reduces variance: variance of the mean scales as σ²/n if predictions are uncorrelated. Bias is unchanged by averaging — to reduce bias you need models with individually low bias, not just more of them.',
  },
  pca: {
    quote: 'The method consists in finding the line in p-dimensional space such that the sum of squared perpendicular distances of the points from the line is a minimum.',
    attribution: 'Karl Pearson, Philosophical Magazine (1901) — the first statement of PCA',
    fact: 'PCA finds directions of maximum variance, but maximum variance is not maximum discriminative information. LDA instead maximizes the ratio of between-class to within-class variance — it finds directions that separate classes, not directions that spread the data.',
    history: 'Pearson invented PCA in 1901 for geometry of regression; Hotelling independently re-derived it in 1933 for psychology and named it "principal components." The two men did not know each other\'s work for years. The modern statistical formulation is Hotelling\'s.',
    misconception: '"PCA requires Gaussian data." PCA is purely a geometric operation on the sample covariance matrix. It works on any data distribution. Gaussianity only matters if you want the components to be statistically independent — for non-Gaussian data, use ICA instead.',
  },
  'gaussian-process': {
    quote: 'A Gaussian process is a distribution over functions; inference takes place directly in the space of functions, not in any finite-dimensional parameter space.',
    attribution: 'Rasmussen & Williams, Gaussian Processes for Machine Learning (2006)',
    fact: 'A GP with RBF kernel is equivalent to a Bayesian neural network with one infinitely wide hidden layer (Neal 1996). This connection — kernel = covariance structure of infinite neural network — opened the modern theory of neural tangent kernels and infinite-width network behavior.',
    history: 'Wiener developed continuous stochastic processes in the 1940s for signal processing. Krige independently invented kriging for spatial interpolation in South African gold mining in 1951. The connection to Bayesian regression wasn\'t formalized until O\'Hagan (1978).',
    misconception: '"GPs don\'t scale to large datasets." Exact GPs are O(n³), but sparse GP approximations (inducing points, FITC, variational free energy) reduce inference to O(nm²) where m ≪ n. Modern GP libraries handle millions of data points on GPUs.',
  },
  'kernel-methods': {
    quote: 'Kernel methods implicitly map data into a high-dimensional feature space in which linear algorithms become powerful nonlinear methods in the original space — without ever computing the feature vectors.',
    attribution: 'Schölkopf & Smola, Learning with Kernels (2002)',
    fact: 'The RBF kernel k(x,x′) = exp(−‖x−x′‖²/2ℓ²) corresponds to an infinite-dimensional feature space. The kernel trick computes the inner product in that space exactly — in O(d) time — without constructing or storing the infinite-dimensional feature vectors.',
    history: 'Aizerman, Braverman & Rozonoer introduced the kernel trick for potential functions in 1964 in Soviet pattern recognition literature, almost entirely unknown in the West. Boser, Guyon & Vapnik independently re-introduced it for SVMs in 1992, launching the kernel methods revolution.',
    misconception: '"Kernel methods are obsolete compared to deep learning." Kernel methods have provable generalization bounds via Rademacher complexity, interpretable hyperparameters, and exact inference. For small-to-medium datasets with geometric structure, they routinely outperform deep networks.',
  },
  'causal-dag': {
    quote: 'The difference between seeing and doing: P(y|x) ≠ P(y|do(x)). This single inequality is the origin of all causal inference, and no amount of statistical power can bridge it without causal assumptions.',
    attribution: 'Judea Pearl, Causality: Models, Reasoning, and Inference (2000)',
    fact: 'd-separation is both sound and complete for Markov-compatible DAGs: two sets of nodes are conditionally independent given Z in every distribution faithful to the DAG if and only if they are d-separated by Z.',
    history: 'Wright introduced path coefficients for genetics in 1921. Pearl formalized do-calculus in 1995, providing the first complete mathematical language for interventional queries. Robins (1986) independently developed G-computation for causal inference in epidemiology.',
    misconception: '"Randomized experiments always dominate observational studies." RCTs estimate Average Treatment Effects across the randomized population. Instrumental variable methods in observational data can identify Local Average Treatment Effects for subpopulations that an RCT cannot isolate.',
  },
  'curse-dim': {
    quote: 'The difficulties which arise in the analysis of functions of many variables form what I shall call the curse of dimensionality — a dramatic increase in volume that makes systematic exploration of parameter spaces infeasible.',
    attribution: 'Richard Bellman, Dynamic Programming (1957)',
    fact: 'In d dimensions, a unit hypercube has 2^d corners. As d grows, almost all of a hypercube\'s volume concentrates in a thin shell near its boundary: at d = 100, over 99.99% of volume lies within distance 0.01 of the surface. The interior is essentially empty.',
    history: 'Bellman coined the term in 1957 in the context of dynamic programming and control theory. The geometric interpretation — concentration of measure, shell fraction, distance concentration — was developed by David Scott (1992) for nonparametric density estimation.',
    misconception: '"More features always help a model." In k-nearest neighbor, adding irrelevant features strictly hurts performance because they dilute the signal in the distance metric. As d → ∞, max(dist)/min(dist) → 1 and all points become equidistant — the neighborhood concept collapses.',
  },
  sde: {
    quote: 'The Itô integral is not defined pathwise but in mean-square — it requires a correction term invisible to Newtonian calculus, yet without it the entire theory of stochastic differential equations collapses.',
    attribution: 'Kiyosi Itô, Stochastic Integral (1944)',
    fact: 'Itô\'s lemma introduces a second-order correction term (½σ²f″dt) absent from ordinary calculus. The Black-Scholes equation — and every subsequent derivative pricing formula — is essentially Itô\'s lemma applied to log-price dynamics. Remove the correction and prices are systematically wrong.',
    history: 'Itô published the stochastic integral in 1944 as a wartime paper in Japanese, unknown internationally for over a decade. Doob and others translated and extended the results in the 1950s. Black & Scholes applied Itô calculus directly in 1973, and the resulting formula won Scholes and Merton the Nobel Prize in 1997.',
    misconception: '"SDEs are ODEs with noise added." The Itô correction makes SDE calculus genuinely different from ordinary calculus. If X satisfies geometric Brownian motion dX = μX dt + σX dW, then d(log X) = (μ − σ²/2) dt + σ dW — the μ − σ²/2 drift correction has no ODE analog.',
  },
  martingale: {
    quote: 'A martingale is a fair game: your best prediction of tomorrow\'s fortune is today\'s fortune. The optional stopping theorem formalizes why no strategy can convert a fair game into an expected profit.',
    attribution: 'Joseph Doob, Stochastic Processes (1953)',
    fact: 'The optional stopping theorem says you cannot beat a martingale by choosing when to stop — but only if the stopping time has finite expected value. The St. Petersburg paradox constructs a martingale strategy with infinite expected stopping time to create the illusion of arbitrage.',
    history: 'Ville introduced the formal definition of a martingale as a sequence in 1939, inspired by gambling strategies. Doob developed the full measurable-process theory in the 1940s, culminating in his 1953 monograph. Doob\'s maximal inequality and convergence theorems are the backbone of modern stochastic analysis.',
    misconception: '"A random walk is always a martingale." Only the symmetric random walk (p = 0.5) is a martingale. A biased random walk (p ≠ 0.5) is a sub- or super-martingale — its conditional expected future value is strictly above or below its current value.',
  },
  brownian: {
    quote: 'The Brownian movement is perhaps the most fundamental of all random processes — the universal limit of all random walks with finite variance, the canonical noise of nature.',
    attribution: 'Norbert Wiener, Differential Space (1923)',
    fact: 'Brownian motion is continuous everywhere but differentiable nowhere, with probability 1. Yet its quadratic variation [B]_t = t is exactly deterministic — infinitely rough in the derivative sense, yet perfectly regular in the quadratic sense.',
    history: 'Brown observed pollen motion in 1827. Einstein gave the first mathematical theory in 1905. Bachelier had already used Brownian motion to model stock prices in his 1900 thesis — five years earlier — but his work was unknown outside France until Samuelson rediscovered it in the 1960s.',
    misconception: '"Brownian motion is just a rough curve." It is a precise mathematical object: Hölder continuous with exponent α < ½ for every α, but not ½. Its paths have Hausdorff fractal dimension 3/2, not 1 like a smooth curve.',
  },
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const NODE_W = 110
const NODE_H = 42
const R = 8

function nodeById(id: string): Node {
  return NODES.find(n => n.id === id)!
}

function edgeEndpoints(from: Node, to: Node) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const len = Math.sqrt(dx * dx + dy * dy) || 1
  const ux = dx / len
  const uy = dy / len
  const hx = NODE_W / 2 + 4
  const hy = NODE_H / 2 + 4
  const t = Math.min(
    ux !== 0 ? hx / Math.abs(ux) : Infinity,
    uy !== 0 ? hy / Math.abs(uy) : Infinity,
  )
  return { x1: from.x + ux * t, y1: from.y + uy * t, x2: to.x - ux * t, y2: to.y - uy * t }
}

// ── Constants ─────────────────────────────────────────────────────────────────

const LEVELS: Level[] = ['foundation', 'core', 'intermediate', 'advanced', 'expert']
const LEVEL_LABEL: Record<Level, string> = {
  foundation: 'Foundation', core: 'Core', intermediate: 'Intermediate',
  advanced: 'Advanced', expert: 'Expert',
}

const TAB_META: { id: InsightTab; label: string; icon: string; color: string }[] = [
  { id: 'quote',         label: 'Quote',        icon: '"',  color: '#6366f1' },
  { id: 'fact',          label: 'Fun Fact',      icon: '★',  color: '#0891b2' },
  { id: 'history',       label: 'History',       icon: '⊙',  color: '#7c3aed' },
  { id: 'misconception', label: 'Misconception', icon: '⚠',  color: '#dc2626' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function KnowledgeGraph() {
  const router = useRouter()
  const containerRef = useRef<HTMLDivElement>(null)

  const [tx, setTx] = useState(0)
  const [ty, setTy] = useState(0)
  const [scale, setScale] = useState(1)
  const [hovered, setHovered] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<InsightTab>('quote')
  const [isDragging, setIsDragging] = useState(false)

  const panRef = useRef<{ dragging: boolean; startX: number; startY: number; tx: number; ty: number }>({
    dragging: false, startX: 0, startY: 0, tx: 0, ty: 0,
  })
  const dragMovedRef = useRef(false)

  // ── Wheel zoom ────────────────────────────────────────────────────────────
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      setScale(s => {
        const next = Math.min(3, Math.max(0.3, s * (1 - e.deltaY * 0.001)))
        const ds = next / s
        setTx(t => cx - ds * (cx - t))
        setTy(t => cy - ds * (cy - t))
        return next
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // ── Pan ───────────────────────────────────────────────────────────────────
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    dragMovedRef.current = false
    panRef.current = { dragging: true, startX: e.clientX, startY: e.clientY, tx, ty }
    setIsDragging(false)
  }, [tx, ty])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!panRef.current.dragging) return
    const dx = e.clientX - panRef.current.startX
    const dy = e.clientY - panRef.current.startY
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) {
      dragMovedRef.current = true
      setIsDragging(true)
    }
    setTx(panRef.current.tx + dx)
    setTy(panRef.current.ty + dy)
  }, [])

  const onMouseUp = useCallback(() => {
    panRef.current.dragging = false
    setIsDragging(false)
  }, [])

  // ── Node interaction ──────────────────────────────────────────────────────
  const handleNodeClick = (node: Node) => {
    if (dragMovedRef.current) return
    if (selected === node.id) {
      setSelected(null)
    } else {
      setSelected(node.id)
      setActiveTab('quote')
    }
  }

  const handleNavigate = (e: React.MouseEvent, node: Node) => {
    if (dragMovedRef.current) return
    e.stopPropagation()
    if (node.href) router.push(node.href)
  }

  const resetView = () => { setTx(0); setTy(0); setScale(1) }

  const connectedEdges = hovered
    ? new Set(EDGES.filter(e => e.from === hovered || e.to === hovered).map(e => `${e.from}→${e.to}`))
    : null

  const selectedNode   = selected ? nodeById(selected)      : null
  const selectedInsight = selected ? INSIGHTS[selected]     : null

  return (
    // NOTE: bg-surface, border-border, text-text etc. are design-system tokens
    // from tailwind.config.ts — they use CSS variables and flip automatically
    // in dark mode. No dark: variants needed.
    <div className="rounded-xl border border-border bg-surface overflow-hidden select-none">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div>
          <h3 className="text-sm font-semibold text-text">Statistical Learning — Knowledge Graph</h3>
          <p className="text-xs text-text-muted mt-0.5">Scroll to zoom · Drag to pan · Click node for insights</p>
        </div>
        <button
          onClick={resetView}
          className="text-xs text-text-muted hover:text-text border border-border rounded px-2 py-1 transition-colors"
        >
          Reset view
        </button>
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3 px-4 py-2 border-b border-border bg-elevated">
        {LEVELS.map(lv => {
          const c = LEVEL_COLOR[lv]
          return (
            <div key={lv} className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm border" style={{ background: c.fill, borderColor: c.stroke }} />
              <span className="text-xs text-text-secondary">{LEVEL_LABEL[lv]}</span>
            </div>
          )
        })}
        <div className="flex items-center gap-1.5 ml-2">
          <div className="w-5 h-0 border-t border-dashed border-border-strong" />
          <span className="text-xs text-text-muted">No page yet</span>
        </div>
      </div>

      {/* ── Canvas ─────────────────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="relative overflow-hidden"
        style={{ height: 460, cursor: isDragging ? 'grabbing' : 'grab' }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
      >
        <svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
          <defs>
            <marker id="kg-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="var(--color-border-strong)" />
            </marker>
            <marker id="kg-arrow-hover" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#3b82f6" />
            </marker>
            <marker id="kg-arrow-sel" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
              <path d="M0,0 L0,6 L8,3 z" fill="#7c3aed" />
            </marker>
          </defs>

          <g transform={`translate(${tx}, ${ty}) scale(${scale})`}>

            {/* ── Edges ─────────────────────────────────────────────────── */}
            {EDGES.map(edge => {
              const from = nodeById(edge.from)
              const to   = nodeById(edge.to)
              if (!from || !to) return null
              const key        = `${edge.from}→${edge.to}`
              const isHovEdge  = connectedEdges?.has(key) ?? false
              const isSelEdge  = selected && (edge.from === selected || edge.to === selected)
              const isRelated  = hovered && (edge.from === hovered || edge.to === hovered)
              const dim        = (hovered && !isRelated) || (selected && !isSelEdge)
              const { x1, y1, x2, y2 } = edgeEndpoints(from, to)

              return (
                <line
                  key={key}
                  x1={x1} y1={y1} x2={x2} y2={y2}
                  stroke={isSelEdge ? '#7c3aed' : isHovEdge ? '#3b82f6' : 'var(--color-border-strong)'}
                  strokeWidth={isSelEdge ? 2 : isHovEdge ? 1.8 : 1}
                  strokeDasharray={(!from.href || !to.href) ? '4,3' : undefined}
                  strokeOpacity={dim ? 0.12 : 1}
                  markerEnd={isSelEdge ? 'url(#kg-arrow-sel)' : isHovEdge ? 'url(#kg-arrow-hover)' : 'url(#kg-arrow)'}
                  style={{ transition: 'stroke-opacity 0.15s, stroke 0.15s, stroke-width 0.15s' }}
                />
              )
            })}

            {/* ── Nodes ─────────────────────────────────────────────────── */}
            {NODES.map(node => {
              const c    = LEVEL_COLOR[node.level]
              const isHov = hovered === node.id
              const isSel = selected === node.id
              const isConnectedToHov = connectedEdges
                ? EDGES.some(e => (e.from === hovered && e.to === node.id) || (e.to === hovered && e.from === node.id))
                : false
              const isConnectedToSel = selected
                ? EDGES.some(e => (e.from === selected && e.to === node.id) || (e.to === selected && e.from === node.id))
                : false
              const dim = (!isSel && hovered && !isHov && !isConnectedToHov)
                       || (!isSel && selected && !isConnectedToSel)

              return (
                <g
                  key={node.id}
                  transform={`translate(${node.x - NODE_W / 2}, ${node.y - NODE_H / 2})`}
                  style={{ cursor: 'pointer', opacity: dim ? 0.2 : 1, transition: 'opacity 0.15s' }}
                  onMouseEnter={() => setHovered(node.id)}
                  onMouseLeave={() => setHovered(null)}
                  onClick={() => handleNodeClick(node)}
                >
                  {isSel && (
                    <rect x={-3} y={-3} width={NODE_W + 6} height={NODE_H + 6}
                      rx={R + 3} ry={R + 3} fill="none" stroke="#7c3aed" strokeWidth={2.5} strokeOpacity={0.45} />
                  )}
                  {isHov && !isSel && (
                    <rect x={-2} y={-2} width={NODE_W + 4} height={NODE_H + 4}
                      rx={R + 2} ry={R + 2} fill="none" stroke={c.stroke} strokeWidth={2.5} strokeOpacity={0.4} />
                  )}
                  <rect x={0} y={0} width={NODE_W} height={NODE_H} rx={R} ry={R}
                    fill={isSel ? '#7c3aed' : isHov ? c.stroke : c.fill}
                    stroke={isSel ? '#7c3aed' : c.stroke}
                    strokeWidth={isSel || isHov ? 0 : 1.5}
                  />
                  <text x={NODE_W / 2} y={NODE_H / 2 - 3}
                    textAnchor="middle" dominantBaseline="auto"
                    fontSize={11.5} fontWeight="600"
                    fill={(isSel || isHov) ? '#fff' : c.text}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {node.label}
                  </text>
                  <text x={NODE_W / 2} y={NODE_H / 2 + 10}
                    textAnchor="middle" dominantBaseline="auto" fontSize={8}
                    fill={(isSel || isHov) ? 'rgba(255,255,255,0.75)' : 'var(--color-muted)'}
                    style={{ pointerEvents: 'none', userSelect: 'none' }}
                  >
                    {node.sublabel}
                  </text>
                  {node.href && (
                    <circle cx={NODE_W - 8} cy={8} r={3}
                      fill={(isSel || isHov) ? 'rgba(255,255,255,0.6)' : c.stroke}
                      opacity={0.75}
                      style={{ cursor: 'pointer' }}
                      onClick={e => handleNavigate(e, node)}
                    />
                  )}
                </g>
              )
            })}

            {/* ── Level labels ──────────────────────────────────────────── */}
            {([
              [60, 'Foundation'], [180, 'Core'], [310, 'Intermediate'],
              [440, 'Advanced'],  [570, 'Expert'],
            ] as [number, string][]).map(([y, label]) => (
              <text key={label} x={8} y={y} fontSize={9}
                fill="var(--color-muted)" dominantBaseline="middle"
                style={{ userSelect: 'none', pointerEvents: 'none' }}
              >
                {label}
              </text>
            ))}
          </g>
        </svg>
      </div>

      {/* ── Insight panel ──────────────────────────────────────────────────── */}
      <div style={{
        maxHeight: selectedNode ? 270 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.28s cubic-bezier(0.4,0,0.2,1)',
      }}>
        {selectedNode && selectedInsight && (() => {
          const c   = LEVEL_COLOR[selectedNode.level]
          const tab = TAB_META.find(t => t.id === activeTab)!
          const content = selectedInsight[activeTab]

          return (
            <div className="border-t border-border">
              {/* Panel header */}
              <div className="flex items-center justify-between px-4 pt-3 pb-2"
                style={{ borderBottom: `2px solid ${c.stroke}28` }}>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: c.stroke }} />
                  <span className="text-xs font-semibold text-text">{selectedNode.label}</span>
                  <span className="text-xs text-text-muted hidden sm:inline">— {selectedNode.sublabel}</span>
                </div>
                <div className="flex items-center gap-1">
                  {selectedNode.href && (
                    <button
                      onClick={() => router.push(selectedNode.href!)}
                      className="text-xs px-2 py-0.5 rounded border transition-colors"
                      style={{ borderColor: c.stroke, color: c.stroke }}
                    >
                      Open →
                    </button>
                  )}
                  <button
                    onClick={() => setSelected(null)}
                    className="text-xs text-text-muted hover:text-text ml-1 px-1 transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-border">
                {TAB_META.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setActiveTab(t.id)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs transition-colors"
                    style={{
                      color: activeTab === t.id ? t.color : 'var(--color-muted)',
                      borderBottom: activeTab === t.id ? `2px solid ${t.color}` : '2px solid transparent',
                      fontWeight: activeTab === t.id ? 600 : 400,
                      background: 'transparent',
                    }}
                  >
                    <span style={{ fontSize: 11 }}>{t.icon}</span>
                    <span className="hidden sm:inline">{t.label}</span>
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="px-4 py-3" style={{ minHeight: 100 }}>
                {activeTab === 'quote' ? (
                  <div>
                    <blockquote
                      className="text-sm text-text-secondary leading-relaxed italic border-l-2 pl-3 mb-2"
                      style={{ borderColor: tab.color }}
                    >
                      "{content}"
                    </blockquote>
                    <p className="text-xs text-text-muted">— {selectedInsight.attribution}</p>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <span className="mt-0.5 text-base leading-none flex-shrink-0" style={{ color: tab.color }}>
                      {tab.icon}
                    </span>
                    <p className="text-xs text-text-secondary leading-relaxed">{content}</p>
                  </div>
                )}
              </div>
            </div>
          )
        })()}
      </div>

      {/* ── Status bar ─────────────────────────────────────────────────────── */}
      <div className="border-t border-border px-4 py-2 flex items-center justify-between bg-elevated">
        <span className="text-xs text-text-muted">
          {hovered
            ? (() => {
                const n = nodeById(hovered)
                const ins  = EDGES.filter(e => e.to === hovered).length
                const outs = EDGES.filter(e => e.from === hovered).length
                return `${n.label} · ${ins} prerequisite${ins !== 1 ? 's' : ''} · ${outs} dependent${outs !== 1 ? 's' : ''}`
              })()
            : selected
            ? 'Click another node or press ✕ to close'
            : `${NODES.length} concepts · ${EDGES.length} dependencies · click any node for insights`
          }
        </span>
        <span className="text-xs text-text-muted tabular-nums">{Math.round(scale * 100)}%</span>
      </div>
    </div>
  )
}
