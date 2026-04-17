import { cn } from '@/lib/cn'

interface RemarkProps {
  number?: number
  title?: string
  children: React.ReactNode
  className?: string
}

/**
 * Mathematical remark — a non-theorem observation worth noting.
 * Less visually prominent than theorems; more prominent than body text.
 */
export function Remark({ number, title, children, className }: RemarkProps) {
  const label = number != null ? `Remark ${number}` : 'Remark'

  return (
    <div
      className={cn('my-5 flex gap-3 text-sm', className)}
      role="note"
    >
      <div className="mt-0.5 flex-shrink-0 select-none font-serif italic text-text-muted text-sm">
        {label}{title ? ` (${title})` : ''}.
      </div>
      <div className="prose-content leading-relaxed text-text-secondary">
        {children}
      </div>
    </div>
  )
}
