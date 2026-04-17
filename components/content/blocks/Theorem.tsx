import { cn } from '@/lib/cn'

type TheoremVariant = 'theorem' | 'lemma' | 'corollary' | 'proposition'

interface TheoremProps {
  number?: number
  name?: string
  variant?: TheoremVariant
  children: React.ReactNode
  className?: string
}

const VARIANT_STYLES: Record<TheoremVariant, { border: string; bg: string; label: string }> = {
  theorem: {
    border: 'border-accent',
    bg: 'bg-accent-light',
    label: 'Theorem',
  },
  lemma: {
    border: 'border-accent-muted',
    bg: 'bg-accent-light/60',
    label: 'Lemma',
  },
  corollary: {
    border: 'border-forest',
    bg: 'bg-forest-light',
    label: 'Corollary',
  },
  proposition: {
    border: 'border-accent-muted',
    bg: 'bg-elevated',
    label: 'Proposition',
  },
}

/**
 * Theorem, Lemma, Corollary, or Proposition block.
 * All content inside is typeset with serif font to match mathematical convention.
 */
export function Theorem({
  number,
  name,
  variant = 'theorem',
  children,
  className,
}: TheoremProps) {
  const { border, bg, label } = VARIANT_STYLES[variant]
  const displayLabel = number != null ? `${label} ${number}` : label

  return (
    <div
      className={cn('my-6 rounded-md border', border, bg, 'px-5 py-4', className)}
      role="note"
      aria-label={name ? `${displayLabel}: ${name}` : displayLabel}
    >
      {/* Header */}
      <p className="mb-2.5 font-serif text-sm font-semibold italic text-accent">
        {displayLabel}
        {name && (
          <span className="ml-1.5 not-italic text-text-secondary">({name})</span>
        )}
        {'.'}
      </p>

      {/* Body — serif, slightly larger for mathematical statements */}
      <div className="prose-content font-serif text-[0.92rem] leading-[1.75] text-text">
        {children}
      </div>
    </div>
  )
}

// Convenience aliases

export function Lemma(props: Omit<TheoremProps, 'variant'>) {
  return <Theorem {...props} variant="lemma" />
}

export function Corollary(props: Omit<TheoremProps, 'variant'>) {
  return <Theorem {...props} variant="corollary" />
}

export function Proposition(props: Omit<TheoremProps, 'variant'>) {
  return <Theorem {...props} variant="proposition" />
}
