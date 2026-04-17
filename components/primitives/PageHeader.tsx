import { cn } from '@/lib/cn'

interface PageHeaderProps {
  title: string
  description?: string
  eyebrow?: string
  actions?: React.ReactNode
  className?: string
}

/**
 * Standard page header with title, optional eyebrow label,
 * description, and action slot (right side).
 */
export function PageHeader({ title, description, eyebrow, actions, className }: PageHeaderProps) {
  return (
    <div className={cn('border-b border-border bg-surface px-8 py-7', className)}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {eyebrow && <p className="label-xs mb-2">{eyebrow}</p>}
          <h1 className="font-serif text-3xl text-text">{title}</h1>
          {description && (
            <p className="mt-2 max-w-2xl text-sm text-text-secondary leading-relaxed">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex flex-shrink-0 items-center gap-2">{actions}</div>
        )}
      </div>
    </div>
  )
}
