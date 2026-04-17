# StatLab — Deployment Guide (Vercel)

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | ≥ 20 (LTS) |
| pnpm / npm / yarn | any |
| Vercel CLI (optional) | `npm i -g vercel` |

---

## 1. Local build verification

Always verify the production build passes locally before pushing.

```bash
# Install dependencies
npm install

# Type-check (catches TS errors without emitting)
npm run type-check

# Production build
npm run build

# Preview production server locally
npm run start
```

A successful build produces `.next/` with:
- **Server components** pre-rendered as RSC payloads
- **Client components** code-split into per-widget JS chunks
- **Static pages** for all `/concepts/[slug]` routes (via `generateStaticParams`)

---

## 2. Deploy to Vercel

### Option A — Git integration (recommended)

1. Push the repository to GitHub / GitLab / Bitbucket.
2. Go to [vercel.com/new](https://vercel.com/new) → Import Repository.
3. Vercel auto-detects Next.js. No framework override needed.
4. Leave all build settings at defaults:
   - **Build command:** `npm run build`
   - **Output directory:** `.next`
   - **Install command:** `npm install`
5. Click **Deploy**.

Every `git push` to `main` triggers an automatic production deployment.
Pull requests receive preview URLs automatically.

### Option B — Vercel CLI

```bash
# First-time setup (login + link project)
vercel

# Deploy to production
vercel --prod
```

---

## 3. Environment variables

StatLab currently requires **no environment variables** for the core platform.

If you add analytics, auth, or a CMS later, add variables in:
- Vercel Dashboard → Project → Settings → Environment Variables
- Never commit `.env.local` to the repository

---

## 4. Build output characteristics

| Metric | Value |
|---|---|
| Rendering strategy | Static (SSG) for concept pages; Server for dynamic routes |
| JS per widget | ~10–40 kB gzipped (loaded on demand via dynamic import) |
| Initial bundle | ~80 kB gzipped (layout + providers only) |
| Fonts | Served via `next/font` (self-hosted on Vercel edge, no Google DNS lookup) |
| Math rendering | KaTeX CSS served from `node_modules` (bundled, no CDN dependency) |

---

## 5. Adding a new concept page

1. Create `content/concepts/<slug>.mdx` with valid frontmatter:

```yaml
---
title: "Your Concept Title"
slug: "your-slug"
topic: "Estimation Theory"      # see lib/content/types.ts for valid values
difficulty: 3                   # 1–5
tags: ["tag1", "tag2"]
prerequisites: ["slug-a"]
leadsTo: ["slug-b"]
description: "One-sentence description shown in metadata and cards."
keyResults:
  - "Key result 1"
  - "Key result 2"
relatedWidgets: ["widget-id"]   # optional
---
```

2. Write the MDX body using available blocks:
   `<Definition>`, `<Theorem>`, `<Proof>`, `<Intuition>`, `<Example>`,
   `<Remark>`, `<Warning>`, `<Figure>`, `<Widget id="..." />`

3. No code changes needed — `generateStaticParams` picks up new slugs automatically.

---

## 6. Adding a new widget

1. Create `components/content/widgets/MyWidget.tsx` with `'use client'` at the top.
2. Add a dynamic import to `components/content/widgets/registry.ts`:
   ```ts
   const MyWidget = dynamic(
     () => import('./MyWidget').then(m => ({ default: m.MyWidget })),
     { ssr: false }
   )
   // then add to WIDGET_REGISTRY:
   'my-widget': MyWidget,
   ```
3. Reference it in any MDX file: `<Widget id="my-widget" />`.

Widget JS is only downloaded when a page containing that widget is visited.

---

## 7. Performance checklist before shipping

- [ ] `npm run build` exits with no errors
- [ ] `npm run type-check` exits with no errors
- [ ] Lighthouse score ≥ 90 on Performance, Accessibility, Best Practices
- [ ] Dark mode verified: toggle in header, check all pages and widgets
- [ ] Mobile layout verified at 375px viewport width
- [ ] All concept pages load (check `/concepts` index, click each link)
- [ ] Knowledge graph loads at `/graph`
- [ ] KaTeX renders correctly in concept pages with math content

---

## 8. Custom domain

In Vercel Dashboard → Project → Settings → Domains → Add Domain.
Vercel provisions a Let's Encrypt TLS certificate automatically.

---

## 9. Final project structure

```
statlab-platform/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout: fonts, providers, AppShell
│   ├── globals.css               # Design tokens, dark mode, widget overrides
│   ├── page.tsx                  # Home page
│   ├── graph/page.tsx            # Knowledge graph module
│   ├── distributions/
│   │   ├── page.tsx              # Distribution lab index
│   │   └── [id]/page.tsx         # Individual distribution page
│   ├── lab/page.tsx              # Interactive lab module
│   ├── topics/page.tsx           # Topic explorer
│   └── concepts/
│       ├── page.tsx              # All concepts index
│       └── [slug]/page.tsx       # Dynamic concept page (SSG)
│
├── components/
│   ├── layout/
│   │   ├── AppShell.tsx          # Sidebar + main shell (server)
│   │   ├── Header.tsx            # Top bar, theme toggle (client)
│   │   └── Sidebar.tsx           # Navigation tree (client)
│   ├── providers/
│   │   ├── ThemeProvider.tsx     # next-themes wrapper
│   │   └── SidebarProvider.tsx   # Mobile sidebar context
│   ├── primitives/
│   │   ├── Badge.tsx             # Semantic badge variants
│   │   ├── PageHeader.tsx        # Sticky page header with eyebrow
│   │   └── PlaceholderSection.tsx
│   └── content/
│       ├── MDXContent.tsx        # MDX renderer with custom components (server)
│       ├── TableOfContents.tsx   # Scroll-spy TOC (client)
│       ├── blocks/
│       │   ├── Widget.tsx        # Widget embedder with error boundary
│       │   ├── Definition.tsx
│       │   ├── Theorem.tsx       # + Lemma, Corollary, Proposition
│       │   ├── Proof.tsx         # Collapsible, QED tombstone
│       │   ├── Intuition.tsx
│       │   ├── Example.tsx
│       │   ├── Remark.tsx
│       │   ├── Warning.tsx
│       │   └── Figure.tsx
│       └── widgets/
│           ├── registry.ts       # Dynamic imports for all 18 widgets
│           ├── KnowledgeGraph.tsx
│           ├── GaussianProcess.tsx
│           ├── MCMCSimulator.tsx
│           ├── BiasVariance.tsx
│           ├── KernelViz.tsx
│           ├── PCAExplorer.tsx
│           ├── CurseDimensionality.tsx
│           ├── CausalDAG.tsx
│           ├── EntropyKL.tsx
│           ├── EigendecompositionExplorer.tsx
│           ├── CLTSimulator.tsx
│           ├── LinearTransformViz.tsx
│           ├── DistributionExplorer.tsx
│           ├── BrownianMotion.tsx
│           ├── SDESolver.tsx
│           ├── MartingaleViz.tsx
│           ├── MeasureTheory.tsx
│           └── distributions/
│               ├── DistributionEngine.tsx
│               ├── defs.ts
│               ├── math.ts
│               ├── types.ts
│               └── Plot.tsx
│
├── content/
│   └── concepts/                 # MDX files (one per concept)
│       ├── bias-variance.mdx
│       ├── clt.mdx
│       ├── distributions.mdx
│       ├── eigendecomposition.mdx
│       ├── gaussian-process.mdx
│       ├── kernel-methods.mdx
│       ├── law-of-large-numbers.mdx
│       ├── lebesgue-integration.mdx
│       ├── linear-transform.mdx
│       └── mcmc.mdx
│
├── lib/
│   ├── cn.ts                     # clsx + tailwind-merge
│   ├── navigation.ts             # Single source of truth for routes/nav
│   └── content/
│       ├── loader.ts             # MDX file loading, frontmatter parsing
│       ├── mdx-options.ts        # remark-math + rehype-katex pipeline
│       └── types.ts              # ConceptFrontmatter, Difficulty, TopicArea
│
├── next.config.ts                # Security headers, image formats, bundle opts
├── tailwind.config.ts            # CSS variable colors, academic type scale
├── tsconfig.json                 # Strict TypeScript, @ path alias
└── package.json
```

---

## 10. Design system reference

### Color tokens (CSS variables)

| Token | Light | Dark | Usage |
|---|---|---|---|
| `--color-bg` | `#F9F8F5` | `#0F0F0E` | Page background |
| `--color-surface` | `#FFFFFF` | `#1A1A18` | Card / widget background |
| `--color-elevated` | `#F2F1EE` | `#222220` | Toolbars, legends, status bars |
| `--color-border` | `#E5E2DA` | `#2E2E2C` | Default borders |
| `--color-border-strong` | `#C8C4BB` | `#3E3E3A` | Emphasis borders |
| `--color-text` | `#1A1A1A` | `#F0EDE8` | Body text |
| `--color-text-secondary` | `#4A4A4A` | `#C0BDB8` | Secondary labels |
| `--color-muted` | `#7A7774` | `#807C79` | Placeholders, hints |
| `--color-accent` | `#1A1A6E` | `#9090D4` | Primary actions, links |
| `--color-accent-light` | `#EEEEF8` | `#1E1E3A` | Accent backgrounds |

### Typography

| Class | Size | Usage |
|---|---|---|
| `text-2xs` | 0.65rem | Fine print, badges |
| `text-xs` | 0.72rem | Labels, captions |
| `text-sm` | 0.82rem | Body, list items |
| `text-base` | 0.9rem | Main content |
| `font-serif` | EB Garamond | Headings, theorems |
| `font-mono` | JetBrains Mono | Code, math identifiers |

### Widget authoring rules

- Always `'use client'` at the top
- Use `bg-surface`, `border-border`, `text-text` etc. (never raw `bg-white` or `text-slate-*`)
- SVG data-viz fills can use hardcoded palette — they are intentional
- SVG chrome (labels, axis text) should use `fill="var(--color-muted)"` etc.
- Register in `registry.ts` with a dynamic import (`ssr: false`)
