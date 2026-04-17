import { cn } from '@/lib/cn'

type BadgeVariant = 'default' | 'accent' | 'crimson' | 'forest' | 'muted'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  className?: string
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  default: 'bg-elevated text-text-secondary border-border',
  accent: 'bg-accent-light text-accent border-transparent',
  crimson: 'bg-crimson-light text-crimson border-transparent',
  forest: 'bg-forest-light text-forest border-transparent',
  muted: 'bg-elevated text-text-muted border-transparent',
}

export function Badge({ children, variant = 'default', className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border px-1.5 py-0.5',
        'text-2xs font-medium tracking-label uppercase',
        VARIANT_CLASSES[variant],
        className
      )}
    >
      {children}
    </span>
  )
}
