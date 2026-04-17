import { cn } from '@/lib/cn'

interface FigureProps {
  number?: number
  caption?: string
  children: React.ReactNode
  className?: string
}

/**
 * Captioned figure container.
 * Wraps D3 SVGs, static images, or diagram components.
 */
export function Figure({ number, caption, children, className }: FigureProps) {
  const label = number != null ? `Figure ${number}` : undefined

  return (
    <figure
      className={cn(
        'my-8 overflow-hidden rounded-md border border-border bg-surface',
        className
      )}
    >
      <div className="p-4">{children}</div>

      {(label || caption) && (
        <figcaption className="border-t border-border bg-elevated px-4 py-2.5">
          {label && (
            <span className="mr-1.5 text-xs font-semibold text-text-muted">
              {label}.
            </span>
          )}
          {caption && (
            <span className="text-xs text-text-secondary leading-relaxed">
              {caption}
            </span>
          )}
        </figcaption>
      )}
    </figure>
  )
}
