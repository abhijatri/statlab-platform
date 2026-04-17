import type { Metadata, Viewport } from 'next'
import { EB_Garamond, Inter, JetBrains_Mono } from 'next/font/google'
import { ThemeProvider } from '@/components/providers/ThemeProvider'
import { SidebarProvider } from '@/components/providers/SidebarProvider'
import { AppShell } from '@/components/layout/AppShell'
import './globals.css'
// KaTeX styles — loaded once globally, used by rehype-katex server-side rendering
import 'katex/dist/katex.min.css'

// ── Fonts ─────────────────────────────────────────────────────────────────────

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

const garamond = EB_Garamond({
  subsets: ['latin'],
  variable: '--font-garamond',
  display: 'swap',
  weight: ['400', '500'],
  style: ['normal', 'italic'],
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500'],
})

// ── Metadata ──────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: {
    default: 'StatLab',
    template: '%s — StatLab',
  },
  description:
    'Research-grade interactive statistics. Fisher information, optimal tests, asymptotic theory, and Bayesian inference — with exact computation.',
  keywords: ['statistics', 'probability', 'Bayesian inference', 'hypothesis testing', 'estimation theory'],
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#F9F8F5' },
    { media: '(prefers-color-scheme: dark)', color: '#0F0F0E' },
  ],
}

// ── Root layout ───────────────────────────────────────────────────────────────

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      // suppressHydrationWarning is required when using next-themes;
      // the class attribute differs between server and client renders.
    >
      <body
        className={`${inter.variable} ${garamond.variable} ${jetbrainsMono.variable} antialiased`}
      >
        <ThemeProvider>
          <SidebarProvider>
            <AppShell>{children}</AppShell>
          </SidebarProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
