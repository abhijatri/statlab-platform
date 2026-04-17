import { cn } from '@/lib/cn'

interface DefinitionProps {
  number?: number
  name: string
  children: React.ReactNode
  className?: string
}

/**
 * Formal mathematical definition block.
 * Rendered with a left rule in accent color and a bold label.
 */
export function Definition({ number, name, children, className }: DefinitionProps) {
  const label = number != null ? `Definition ${number}` : 'Definition'

  return (
    <div
      className={cn(
        'my-6 rounded-r-md border-l-2 border-accent bg-accent-light px-5 py-4',
        className
      )}
      role="note"
      aria-label={`${label}: ${name}`}
    >
      <p className="mb-2 text-xs font-semibold tracking-label uppercase text-accent">
        {label}
        {name && (
          <span className="ml-1.5 font-normal normal-case tracking-normal not-italic text-accent-muted">
            ({name})
          </span>
        )}
      </p>
      <div className="prose-content text-sm leading-relaxed text-text">
        {children}
      </div>
    </div>
  )
}
