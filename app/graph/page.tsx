import type { Metadata } from 'next'
import { PageHeader } from '@/components/primitives/PageHeader'
import { Widget } from '@/components/content/blocks/Widget'

export const metadata: Metadata = {
  title: 'Knowledge Graph',
  description: 'Navigate the statistical concept space — 18 concepts, 29 dependency edges, academic insights.',
}

// Graph stats drawn from the actual KnowledgeGraph widget data
const GRAPH_STATS = [
  { label: 'Concepts',     value: '18',  description: 'From probability to Brownian motion' },
  { label: 'Dependencies', value: '29',  description: 'Directed prerequisite edges'         },
  { label: 'Levels',       value: '5',   description: 'Foundation → Expert'                 },
  { label: 'Insights',     value: '72',  description: 'Quotes, facts, history, misconceptions' },
]

export default function GraphPage() {
  return (
    <div className="min-h-full">
      <PageHeader
        title="Knowledge Graph"
        eyebrow="Modules"
        description="The conceptual topology of statistical learning. Every node is a concept; every edge is a prerequisite. Click any node for quotes, history, and common misconceptions."
      />

      <div className="px-6 py-8 space-y-8 max-w-5xl">

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {GRAPH_STATS.map(stat => (
            <div key={stat.label} className="rounded-md border border-border bg-surface px-4 py-4">
              <p className="font-serif text-3xl text-accent">{stat.value}</p>
              <p className="mt-1 text-xs font-medium text-text">{stat.label}</p>
              <p className="mt-0.5 text-2xs text-text-muted leading-relaxed">{stat.description}</p>
            </div>
          ))}
        </div>

        {/* Knowledge graph widget — self-sizing, no forced height */}
        <div>
          <p className="label-xs mb-3">Interactive Graph</p>
          <Widget id="knowledge-graph" title="Statistical Learning Knowledge Graph" />
        </div>

        {/* Usage guide */}
        <div className="rounded-md border border-border bg-surface p-5">
          <p className="label-xs mb-3">How to use</p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: '⟳', title: 'Scroll',      body: 'Zoom in and out on any point in the graph.' },
              { icon: '⊹', title: 'Drag',         body: 'Pan the canvas to explore all five levels.' },
              { icon: '●', title: 'Click node',   body: 'Open the insight panel: quote, fun fact, history, and misconception.' },
              { icon: '→', title: 'Navigate',     body: 'Nodes with a dot badge link to the full concept page.' },
            ].map(item => (
              <div key={item.title} className="flex gap-3">
                <span className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded bg-accent-light text-accent text-sm font-mono">
                  {item.icon}
                </span>
                <div>
                  <p className="text-xs font-medium text-text">{item.title}</p>
                  <p className="text-xs text-text-muted leading-relaxed mt-0.5">{item.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}
