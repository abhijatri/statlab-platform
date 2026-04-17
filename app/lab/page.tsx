import type { Metadata } from 'next'
import { PageHeader } from '@/components/primitives/PageHeader'
import { Widget } from '@/components/content/blocks/Widget'

export const metadata: Metadata = {
  title: 'Interactive Lab',
  description: 'Estimation, hypothesis testing, asymptotics, and Bayesian inference — fully interactive',
}

export default function LabPage() {
  return (
    <div className="min-h-full">
      <PageHeader
        title="Interactive Lab"
        eyebrow="Modules"
        description="Four pillars of mathematical statistics. All computations are exact — adjust parameters and observe results update in real time."
      />

      <div className="px-8 py-8 space-y-16">

        {/* ── Estimation Theory ── */}
        <section>
          <div className="flex items-center gap-3 mb-1 pb-3 border-b border-border">
            <h2 className="font-serif text-xl text-text">Estimation Theory</h2>
          </div>
          <p className="text-sm text-text-muted mb-6 leading-relaxed max-w-2xl">
            Fisher information quantifies how much data reveals about a parameter.
            The Cramér-Rao bound sets the minimum possible variance for any unbiased estimator.
            The MLE achieves this bound asymptotically.
          </p>

          <div className="space-y-2 mb-3">
            <p className="text-xs font-medium text-text-secondary">Cramér-Rao Explorer</p>
            <p className="text-xs text-text-muted">
              Select a distribution · Adjust parameters · Draw a sample to see the empirical MLE · Compare against the theoretical CR lower bound
            </p>
          </div>
          <Widget id="cramer-rao-explorer" title="Cramér-Rao Explorer" height={500} />

          <div className="mt-10 space-y-2 mb-3">
            <p className="text-xs font-medium text-text-secondary">Bias-Variance Tradeoff</p>
            <p className="text-xs text-text-muted">
              Visualize the decomposition of MSE = Bias² + Variance across model complexities
            </p>
          </div>
          <Widget id="bias-variance" title="Bias-Variance Tradeoff" height={420} />
        </section>

        {/* ── Hypothesis Testing ── */}
        <section>
          <div className="flex items-center gap-3 mb-1 pb-3 border-b border-border">
            <h2 className="font-serif text-xl text-text">Hypothesis Testing</h2>
          </div>
          <p className="text-sm text-text-muted mb-6 leading-relaxed max-w-2xl">
            The Neyman-Pearson lemma guarantees the likelihood ratio test is the most powerful test at any fixed size.
            The power function β(θ) maps each parameter value to the probability of rejection.
          </p>

          <div className="space-y-2 mb-3">
            <p className="text-xs font-medium text-text-secondary">Power Function Visualizer</p>
            <p className="text-xs text-text-muted">
              Choose a test · Set parameters · See the power curve update instantly · Compute required sample size for target power
            </p>
          </div>
          <Widget id="power-function" title="Power Function" height={520} />
        </section>

        {/* ── Asymptotic Theory ── */}
        <section>
          <div className="flex items-center gap-3 mb-1 pb-3 border-b border-border">
            <h2 className="font-serif text-xl text-text">Asymptotic Theory</h2>
          </div>
          <p className="text-sm text-text-muted mb-6 leading-relaxed max-w-2xl">
            The Central Limit Theorem drives virtually all large-sample statistical inference.
            The Berry-Esseen theorem bounds the error in normal approximation at rate O(1/√n).
            The delta method propagates asymptotic normality through smooth transformations.
          </p>

          <div className="space-y-2 mb-3">
            <p className="text-xs font-medium text-text-secondary">CLT Simulator</p>
            <p className="text-xs text-text-muted">
              Watch √n(X̄−μ)/σ converge to N(0,1) · Compare empirical histogram to normal density · Observe Berry-Esseen rate
            </p>
          </div>
          <Widget id="clt-simulator" title="CLT Simulator" height={420} />
        </section>

        {/* ── Bayesian Inference ── */}
        <section>
          <div className="flex items-center gap-3 mb-1 pb-3 border-b border-border">
            <h2 className="font-serif text-xl text-text">Bayesian Inference</h2>
          </div>
          <p className="text-sm text-text-muted mb-6 leading-relaxed max-w-2xl">
            Conjugate priors enable closed-form prior-to-posterior updates.
            The Bernstein-von Mises theorem shows the posterior converges to a Gaussian centered at the MLE,
            reconciling Bayesian and frequentist inference for large samples.
          </p>

          <div className="space-y-2 mb-3">
            <p className="text-xs font-medium text-text-secondary">Conjugate Analysis</p>
            <p className="text-xs text-text-muted">
              Select a conjugate family · Set prior hyperparameters · Observe prior and posterior densities · 95% credible interval updates in real time
            </p>
          </div>
          <Widget id="conjugate-analysis" title="Conjugate Analysis" height={500} />

          <div className="mt-10 space-y-2 mb-3">
            <p className="text-xs font-medium text-text-secondary">MCMC Simulator</p>
            <p className="text-xs text-text-muted">
              Metropolis-Hastings sampler · Tune proposal variance · Watch chain mixing and autocorrelation
            </p>
          </div>
          <Widget id="mcmc-simulator" title="MCMC Simulator" height={440} />
        </section>

      </div>
    </div>
  )
}
