import { cn } from '@/lib/cn'

interface ExampleProps {
  number?: number
  title?: string
  children: React.ReactNode
  className?: string
}

/**
 * Worked example block.
 * Numbered for reference within a concept page.
 */
export function Example({ number, title, children, className }: ExampleProps) {
  const label = number != null ? `Example ${number}` : 'Example'

  return (
    <div
      className={cn(
        'my-6 rounded-md border border-border bg-surface',
        className
      )}
    >
      {/* Header bar */}
      <div className="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span className="text-xs font-semibold tracking-label uppercase text-text-muted">
          {label}
        </span>
        {title && (
          <span className="text-xs text-text-secondary">{title}</span>
        )}
      </div>

      {/* Content */}
      <div className="prose-content px-5 py-4 text-sm leading-relaxed text-text">
        {children}
      </div>
    </div>
  )
}
