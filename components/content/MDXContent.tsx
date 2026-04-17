import { MDXRemote } from 'next-mdx-remote/rsc'
import { MDX_OPTIONS } from '@/lib/content/mdx-options'

// Block-level semantic components
import { Definition } from './blocks/Definition'
import { Theorem, Lemma, Corollary, Proposition } from './blocks/Theorem'
import { Proof } from './blocks/Proof'
import { Intuition } from './blocks/Intuition'
import { Example } from './blocks/Example'
import { Remark } from './blocks/Remark'
import { Warning } from './blocks/Warning'
import { Figure } from './blocks/Figure'
import { Widget } from './blocks/Widget'

// ── Custom HTML element overrides ─────────────────────────────────────────────
// These give base elements the right typographic treatment without
// requiring manual class names in every .mdx file.

const HTML_OVERRIDES = {
  h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h2
      {...props}
      className="mb-3 mt-10 scroll-mt-20 font-serif text-2xl text-text first:mt-0"
    />
  ),
  h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
    <h3
      {...props}
      className="mb-2 mt-7 scroll-mt-20 font-serif text-lg text-text"
    />
  ),
  p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
    <p {...props} className="my-3 text-sm leading-[1.85] text-text-secondary" />
  ),
  ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
    <ul {...props} className="my-3 ml-5 list-disc space-y-1 text-sm text-text-secondary" />
  ),
  ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
    <ol {...props} className="my-3 ml-5 list-decimal space-y-1 text-sm text-text-secondary" />
  ),
  li: (props: React.HTMLAttributes<HTMLLIElement>) => (
    <li {...props} className="leading-relaxed" />
  ),
  code: ({ className, ...props }: React.HTMLAttributes<HTMLElement>) => {
    // Block code (wrapped in pre) vs inline code
    const isBlock = className?.includes('language-')
    if (isBlock) {
      return <code {...props} className={className} />
    }
    return (
      <code
        {...props}
        className="rounded bg-elevated px-1.5 py-0.5 font-mono text-xs text-text-secondary border border-border"
      />
    )
  },
  pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
    <pre
      {...props}
      className="my-4 overflow-x-auto rounded-md border border-border bg-elevated p-4 text-xs leading-relaxed"
    />
  ),
  blockquote: (props: React.HTMLAttributes<HTMLQuoteElement>) => (
    <blockquote
      {...props}
      className="my-4 border-l-2 border-border-strong pl-4 text-sm italic text-text-muted"
    />
  ),
  hr: () => <hr className="my-8 border-border" />,
  strong: (props: React.HTMLAttributes<HTMLElement>) => (
    <strong {...props} className="font-semibold text-text" />
  ),
  a: ({ href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      href={href}
      {...props}
      className="text-accent underline decoration-accent/40 underline-offset-2 hover:decoration-accent transition-colors"
    />
  ),
  // KaTeX injects .katex-display wrappers — add spacing via CSS, not overrides
  table: (props: React.HTMLAttributes<HTMLTableElement>) => (
    <div className="my-5 overflow-x-auto">
      <table {...props} className="w-full text-xs border-collapse" />
    </div>
  ),
  th: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
    <th {...props} className="border border-border px-3 py-2 text-left font-semibold text-text bg-elevated" />
  ),
  td: (props: React.HTMLAttributes<HTMLTableCellElement>) => (
    <td {...props} className="border border-border px-3 py-2 text-text-secondary" />
  ),
}

// ── MDX component map ─────────────────────────────────────────────────────────
// Every custom component used in .mdx files must be listed here.
// Adding a new component: (1) create it in blocks/, (2) add it here.

const COMPONENTS = {
  // Semantic blocks
  Definition,
  Theorem,
  Lemma,
  Corollary,
  Proposition,
  Proof,
  Intuition,
  Example,
  Remark,
  Warning,
  Figure,
  Widget,
  // HTML overrides
  ...HTML_OVERRIDES,
}

// ── MDXContent ────────────────────────────────────────────────────────────────

interface MDXContentProps {
  source: string
}

/**
 * Server Component — compiles MDX source and renders it with the
 * custom component map. KaTeX math is rendered server-side via
 * rehype-katex; no client JS required for math display.
 */
export async function MDXContent({ source }: MDXContentProps) {
  return (
    <MDXRemote
      source={source}
      options={{ mdxOptions: MDX_OPTIONS }}
      components={COMPONENTS}
    />
  )
}
