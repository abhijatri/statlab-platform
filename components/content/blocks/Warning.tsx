import { TriangleAlert } from 'lucide-react'
import { cn } from '@/lib/cn'

interface WarningProps {
  title?: string
  children: React.ReactNode
  className?: string
}

/**
 * Mathematical pitfall or common misconception.
 * Used to flag subtle errors students frequently make.
 */
export function Warning({ title = 'Common Pitfall', children, className }: WarningProps) {
  return (
    <div
      className={cn(
        'my-6 rounded-md border border-crimson/30 bg-crimson-light px-5 py-4',
        className
      )}
      role="alert"
    >
      <div className="mb-2 flex items-center gap-2">
        <TriangleAlert size={12} className="flex-shrink-0 text-crimson" />
        <span className="text-xs font-semibold tracking-label uppercase text-crimson">
          {title}
        </span>
      </div>
      <div className="prose-content text-sm leading-relaxed text-text">
        {children}
      </div>
    </div>
  )
}
