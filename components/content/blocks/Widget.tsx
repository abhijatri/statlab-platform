'use client'

import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { FlaskConical, AlertTriangle, RefreshCw } from 'lucide-react'
import { WIDGET_REGISTRY } from '../widgets/registry'

// ── Error boundary ────────────────────────────────────────────────────────────
// Catches runtime errors inside any widget so a broken widget can never
// crash the surrounding page.

interface EBState { error: Error | null }

class WidgetErrorBoundary extends Component<{ children: ReactNode; id: string }, EBState> {
  state: EBState = { error: null }

  static getDerivedStateFromError(error: Error): EBState {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[Widget:${this.props.id}]`, error, info.componentStack)
    }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 bg-elevated px-6 py-10 text-center">
          <AlertTriangle size={18} className="text-crimson" />
          <div>
            <p className="text-sm font-medium text-text-secondary">Widget failed to render</p>
            <p className="mt-1 font-mono text-xs text-text-muted">{this.props.id}</p>
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="mt-1 flex items-center gap-1.5 text-xs text-accent transition-colors hover:text-accent-muted"
          >
            <RefreshCw size={11} />
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
// Shown by next/dynamic while the widget JS chunk is being fetched.
// Accepts height so the layout slot is reserved (no CLS).

function WidgetSkeleton({ height }: { height: number }) {
  return (
    <div
      className="flex flex-col gap-3 bg-elevated p-4"
      style={{ height }}
      aria-hidden="true"
    >
      <div className="flex items-center justify-between">
        <div className="widget-skeleton h-3 w-28 rounded" />
        <div className="widget-skeleton h-5 w-16 rounded" />
      </div>
      <div className="widget-skeleton flex-1 rounded-md" />
      <div className="flex gap-2">
        <div className="widget-skeleton h-6 w-20 rounded" />
        <div className="widget-skeleton h-6 w-16 rounded" />
        <div className="widget-skeleton h-6 w-24 rounded" />
      </div>
    </div>
  )
}

// ── Widget ────────────────────────────────────────────────────────────────────

interface WidgetProps {
  id: string
  title?: string
  /**
   * Explicit pixel height. Omit to let the widget size itself (e.g. KnowledgeGraph).
   * When provided, a matching skeleton is shown during bundle load.
   */
  height?: number
}

export function Widget({ id, title, height }: WidgetProps) {
  const WidgetComponent = WIDGET_REGISTRY[id]

  // ── Not found placeholder ─────────────────────────────────────────────────
  if (!WidgetComponent) {
    return (
      <figure
        className="my-8 overflow-hidden rounded-md border border-dashed border-border-strong"
        style={{ minHeight: height ?? 320 }}
        aria-label={`Widget placeholder: ${title ?? id}`}
      >
        <div
          className="flex h-full flex-col items-center justify-center gap-3 bg-elevated px-6 py-10 text-center"
          style={{ minHeight: height ?? 320 }}
        >
          <FlaskConical size={20} className="text-text-muted" />
          <p className="text-sm font-medium text-text-secondary">{title ?? id}</p>
          <p className="text-xs text-text-muted">
            Widget ID: <code className="font-mono text-accent">{id}</code>
          </p>
        </div>
      </figure>
    )
  }

  // ── Rendered widget ───────────────────────────────────────────────────────
  // • data-widget={id}  → CSS dark-mode overrides scoped to [data-widget]
  // • height style       → reserved layout slot; omitted for self-sizing widgets
  // • animate-fade-in    → smooth entrance after bundle loads
  return (
    <figure
      className="not-prose my-8 overflow-hidden rounded-md border border-border bg-surface animate-fade-in"
      style={height != null ? { height } : undefined}
      aria-label={title ? `Widget: ${title}` : `Widget: ${id}`}
      data-widget={id}
    >
      <WidgetErrorBoundary id={id}>
        <WidgetComponent />
      </WidgetErrorBoundary>
    </figure>
  )
}

// Re-export skeleton so registry.ts can reference it for next/dynamic loading=
export { WidgetSkeleton }
