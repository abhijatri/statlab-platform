import { Lightbulb } from 'lucide-react'
import { cn } from '@/lib/cn'

interface IntuitionProps {
  title?: string
  children: React.ReactNode
  className?: string
}

/**
 * Informal intuition / motivation block.
 *
 * Visually distinct from theorem blocks — warmer background, lightbulb icon.
 * Content is intentionally less formal: complete sentences, analogies, mental models.
 * Not a substitute for the proof; always follows or precedes formal statements.
 */
export function Intuition({ title = 'Intuition', children, className }: IntuitionProps) {
  return (
    <div
      className={cn(
        'my-6 rounded-md border border-border bg-elevated px-5 py-4',
        className
      )}
    >
      <div className="mb-2.5 flex items-center gap-2">
        <Lightbulb size={13} className="flex-shrink-0 text-text-muted" />
        <span className="text-xs font-semibold tracking-label uppercase text-text-muted">
          {title}
        </span>
      </div>
      <div className="prose-content text-sm leading-[1.8] text-text-secondary">
        {children}
      </div>
    </div>
  )
}
