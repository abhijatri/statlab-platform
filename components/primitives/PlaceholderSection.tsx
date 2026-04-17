import { cn } from '@/lib/cn'

interface PlaceholderSectionProps {
  title: string
  description?: string
  icon?: React.ReactNode
  className?: string
}

/**
 * Used by future-module pages to communicate structure without
 * implementing placeholder/stub logic. Not a "coming soon" banner —
 * a genuine section skeleton that describes what will be there.
 */
export function PlaceholderSection({ title, description, icon, className }: PlaceholderSectionProps) {
  return (
    <div
      className={cn(
        'rounded-md border border-dashed border-border-strong',
        'bg-elevated px-6 py-8 text-center',
        className
      )}
    >
      {icon && (
        <div className="mb-3 flex justify-center text-text-muted">{icon}</div>
      )}
      <p className="font-medium text-sm text-text-secondary">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
          {description}
        </p>
      )}
    </div>
  )
}
