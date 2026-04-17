'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import type { TocEntry } from '@/lib/content/types'

interface TableOfContentsProps {
  entries: TocEntry[]
}

/**
 * Sticky table of contents with Intersection Observer scroll spy.
 *
 * Watches heading elements in #main-content and highlights the
 * currently visible section. Click jumps to the heading.
 */
export function TableOfContents({ entries }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>(entries[0]?.id ?? '')

  useEffect(() => {
    if (entries.length === 0) return

    const observer = new IntersectionObserver(
      (intersections) => {
        // Find the topmost visible heading
        const visible = intersections
          .filter(i => i.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible.length > 0) {
          setActiveId(visible[0].target.id)
        }
      },
      {
        rootMargin: '0px 0px -60% 0px',
        threshold: 0,
      }
    )

    entries.forEach(({ id }) => {
      const el = document.getElementById(id)
      if (el) observer.observe(el)
    })

    return () => observer.disconnect()
  }, [entries])

  if (entries.length === 0) return null

  return (
    <nav aria-label="Table of contents" className="text-xs">
      <p className="label-xs mb-3">On this page</p>
      <ol className="space-y-0.5">
        {entries.map(({ id, text, depth }) => (
          <li key={id}>
            <a
              href={`#${id}`}
              className={cn(
                'block rounded px-2 py-1 leading-snug transition-colors',
                depth === 3 && 'pl-4',
                activeId === id
                  ? 'text-accent font-medium bg-accent-light'
                  : 'text-text-muted hover:text-text hover:bg-elevated'
              )}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                setActiveId(id)
              }}
            >
              {text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}
