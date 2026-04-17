'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { ChevronDown, FlaskConical, BarChart3, Network, Home, BookOpen, Compass } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useSidebar } from '@/components/providers/SidebarProvider'
import { NAV_TOP, NAV_SECTIONS, type NavBranch, type NavLeaf, type NavSection } from '@/lib/navigation'

// ── Icon map — keeps nav config free of React imports ────────────────────────

const ICONS: Record<string, React.ReactNode> = {
  home: <Home size={14} />,
  lab: <FlaskConical size={14} />,
  distributions: <BarChart3 size={14} />,
  graph: <Network size={14} />,
  'topics-explorer': <Compass size={14} />,
  'all-concepts': <BookOpen size={14} />,
}

// ── Components ────────────────────────────────────────────────────────────────

function LeafItem({ item, depth = 0 }: { item: NavLeaf; depth?: number }) {
  const pathname = usePathname()
  const isActive = pathname === item.href

  return (
    <Link
      href={item.href}
      className={cn(
        'flex items-center gap-2 rounded px-2.5 py-1.5 text-sm transition-colors',
        depth === 0 && 'font-medium',
        depth === 1 && 'pl-7 text-xs',
        isActive
          ? 'bg-accent-light text-accent font-medium'
          : 'text-text-secondary hover:bg-elevated hover:text-text'
      )}
    >
      {depth === 0 && ICONS[item.id] && (
        <span className={cn('flex-shrink-0', isActive ? 'text-accent' : 'text-text-muted')}>
          {ICONS[item.id]}
        </span>
      )}
      <span>{item.label}</span>
      {item.badge && (
        <span className="ml-auto rounded-sm bg-accent-light px-1 py-0.5 text-2xs font-medium text-accent">
          {item.badge}
        </span>
      )}
    </Link>
  )
}

function BranchItem({ item }: { item: NavBranch }) {
  const pathname = usePathname()
  const { close } = useSidebar()

  // Auto-expand if any child is active
  const hasActiveChild = item.children.some(c => pathname.startsWith(c.href))
  const isParentActive = pathname.startsWith(item.href)

  const [isExpanded, setIsExpanded] = useState(hasActiveChild || isParentActive)

  // Re-evaluate when route changes
  useEffect(() => {
    if (hasActiveChild || isParentActive) setIsExpanded(true)
  }, [hasActiveChild, isParentActive])

  return (
    <div>
      {/*
        Split into two targets:
        - Link (label text) → navigates to the topic overview page
        - button (chevron only) → toggles expand/collapse
        This fixes the "clicking does nothing" issue where the whole
        row was a button that only toggled and never navigated.
      */}
      <div
        className={cn(
          'flex w-full items-center rounded text-sm font-medium transition-colors',
          isParentActive || hasActiveChild
            ? 'text-accent'
            : 'text-text-secondary hover:text-text'
        )}
      >
        <Link
          href={item.href}
          onClick={close}
          className={cn(
            'flex-1 rounded-l px-2.5 py-1.5 text-left transition-colors',
            isParentActive || hasActiveChild
              ? 'hover:bg-accent-light'
              : 'hover:bg-elevated'
          )}
        >
          {item.label}
        </Link>
        <button
          onClick={() => setIsExpanded(prev => !prev)}
          className={cn(
            'flex h-full items-center rounded-r px-2 py-1.5 transition-colors',
            isParentActive || hasActiveChild
              ? 'hover:bg-accent-light'
              : 'hover:bg-elevated'
          )}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? 'Collapse' : 'Expand'}
        >
          <ChevronDown
            size={12}
            className={cn(
              'flex-shrink-0 text-text-muted transition-transform duration-150',
              isExpanded ? 'rotate-0' : '-rotate-90'
            )}
          />
        </button>
      </div>

      {isExpanded && (
        <div className="mt-0.5 space-y-0.5 border-l border-border ml-4 pl-2">
          {item.children.map(child => (
            <LeafItem key={child.id} item={child} depth={1} />
          ))}
        </div>
      )}
    </div>
  )
}

function SectionGroup({ section }: { section: NavSection }) {
  return (
    <div className="space-y-0.5">
      <p className="label-xs px-2.5 py-1.5">{section.label}</p>
      {section.items.map(item =>
        item.kind === 'branch'
          ? <BranchItem key={item.id} item={item} />
          : <LeafItem key={item.id} item={item} />
      )}
    </div>
  )
}

// ── Sidebar root ──────────────────────────────────────────────────────────────

export function Sidebar() {
  const { isOpen, close } = useSidebar()

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={close}
          aria-hidden="true"
        />
      )}

      {/* Sidebar panel */}
      <aside
        className={cn(
          // Structure
          'fixed inset-y-0 left-0 z-30 flex w-sidebar flex-col',
          // Desktop: part of normal flow
          'lg:sticky lg:top-0 lg:z-auto lg:h-screen',
          // Colors
          'bg-surface border-r border-border',
          // Mobile animation
          'transition-transform duration-200 ease-out',
          isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {/* Brand */}
        <div className="flex h-14 flex-shrink-0 items-center border-b border-border px-5">
          <Link href="/" className="flex items-center gap-2 group" onClick={close}>
            <span className="font-serif text-xl italic text-accent">
              Stat<span className="not-italic font-semibold">Lab</span>
            </span>
          </Link>
        </div>

        {/* Navigation */}
        <nav
          className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4 space-y-5"
          aria-label="Main navigation"
        >
          {/* Top items */}
          <div className="space-y-0.5">
            {NAV_TOP.map(item => (
              <LeafItem key={item.id} item={item} />
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Sections */}
          {NAV_SECTIONS.map(section => (
            <SectionGroup key={section.id} section={section} />
          ))}
        </nav>

        {/* Footer */}
        <div className="flex-shrink-0 border-t border-border px-5 py-3">
          <p className="text-2xs text-text-muted">
            Research-grade statistics
          </p>
        </div>
      </aside>
    </>
  )
}
