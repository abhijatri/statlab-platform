'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

interface ProofProps {
  children: React.ReactNode
  /** Label override — e.g. "Proof of Theorem 2" */
  label?: string
  /** Start collapsed. Default: false (proofs visible by default) */
  collapsible?: boolean
  defaultOpen?: boolean
  className?: string
}

/**
 * Mathematical proof block.
 *
 * - Always shows "Proof." label in italic.
 * - Ends with a QED tombstone (□).
 * - Optionally collapsible (useful for long proofs readers may want to attempt first).
 * - Client Component because it manages open/close state.
 */
export function Proof({
  children,
  label = 'Proof',
  collapsible = false,
  defaultOpen = true,
  className,
}: ProofProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  if (!collapsible) {
    return (
      <div
        className={cn(
          'my-5 border-l border-border-strong pl-5 py-1',
          className
        )}
      >
        <ProofBody label={label}>{children}</ProofBody>
      </div>
    )
  }

  return (
    <div className={cn('my-5', className)}>
      <button
        onClick={() => setIsOpen(prev => !prev)}
        className={cn(
          'flex w-full items-center gap-2 rounded px-3 py-2 text-left',
          'border border-border bg-elevated',
          'text-xs text-text-muted transition-colors hover:bg-border/40',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
        )}
        aria-expanded={isOpen}
      >
        <ChevronDown
          size={12}
          className={cn(
            'flex-shrink-0 transition-transform duration-150',
            isOpen ? 'rotate-0' : '-rotate-90'
          )}
        />
        <span className="font-serif italic text-text-secondary">{label}</span>
        {!isOpen && (
          <span className="ml-auto text-2xs text-text-muted">(click to expand)</span>
        )}
      </button>

      {isOpen && (
        <div className="mt-0 border-l border-border-strong pl-5 py-1 border-t-0">
          <ProofBody label="">{children}</ProofBody>
        </div>
      )}
    </div>
  )
}

// ── Internal body ─────────────────────────────────────────────────────────────

function ProofBody({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="prose-content text-sm leading-relaxed text-text">
      {label && (
        <span className="mr-1 font-serif italic text-text-secondary">{label}.</span>
      )}
      {children}
      {/* QED tombstone — right-aligned */}
      <div className="mt-2 flex justify-end">
        <span
          className="inline-block h-3.5 w-3.5 border border-text-secondary"
          aria-label="QED"
          title="Quod erat demonstrandum"
        />
      </div>
    </div>
  )
}
