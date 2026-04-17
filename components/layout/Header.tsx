'use client'

import { usePathname } from 'next/navigation'
import { Menu, Sun, Moon, Monitor } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { useSidebar } from '@/components/providers/SidebarProvider'
import { ROUTE_METADATA } from '@/lib/navigation'

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  // Avoid hydration mismatch — only render after client mount
  useEffect(() => setMounted(true), [])
  if (!mounted) return <div className="h-8 w-8" />

  const cycles: Array<{ value: string; icon: React.ReactNode; label: string }> = [
    { value: 'light', icon: <Sun size={14} />, label: 'Light mode' },
    { value: 'dark', icon: <Moon size={14} />, label: 'Dark mode' },
    { value: 'system', icon: <Monitor size={14} />, label: 'System theme' },
  ]

  const current = cycles.find(c => c.value === theme) ?? cycles[2]
  const nextTheme = cycles[(cycles.indexOf(current) + 1) % cycles.length]

  return (
    <button
      onClick={() => setTheme(nextTheme.value)}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded',
        'text-text-muted hover:bg-elevated hover:text-text',
        'transition-colors'
      )}
      title={`Switch to ${nextTheme.label}`}
      aria-label={`Current: ${current.label}. Click to switch to ${nextTheme.label}`}
    >
      {current.icon}
    </button>
  )
}

export function Header() {
  const pathname = usePathname()
  const { toggle } = useSidebar()

  const meta = ROUTE_METADATA[pathname]
  const title = meta?.title ?? 'StatLab'
  const topic = meta?.topic

  return (
    <header className="sticky top-0 z-20 flex h-14 flex-shrink-0 items-center gap-3 border-b border-border bg-surface/90 px-4 backdrop-blur-sm">
      {/* Mobile: hamburger */}
      <button
        onClick={toggle}
        className={cn(
          'flex h-8 w-8 items-center justify-center rounded lg:hidden',
          'text-text-muted hover:bg-elevated hover:text-text transition-colors'
        )}
        aria-label="Toggle navigation"
      >
        <Menu size={16} />
      </button>

      {/* Page context */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {topic && (
          <>
            <span className="label-xs hidden sm:block">{topic}</span>
            <span className="text-text-muted hidden sm:block" aria-hidden>/</span>
          </>
        )}
        <h1 className="truncate font-serif text-lg text-text">{title}</h1>
      </div>

      {/* Actions */}
      <div className="flex flex-shrink-0 items-center gap-1">
        <ThemeToggle />
      </div>
    </header>
  )
}
