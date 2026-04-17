import { Sidebar } from './Sidebar'
import { Header } from './Header'

/**
 * AppShell — persistent layout wrapper for all pages.
 *
 * Desktop: [Sidebar 240px | Header + Content scrollable]
 * Mobile:  [Header + Content] with Sidebar as fixed overlay
 *
 * Sidebar and Header are Client Components; AppShell itself is a
 * Server Component — it adds no client JS overhead.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* Sidebar — sticky on desktop, fixed overlay on mobile */}
      <Sidebar />

      {/* Main area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header />
        <main
          id="main-content"
          className="flex-1 overflow-y-auto scrollbar-thin"
          tabIndex={-1}
        >
          {children}
        </main>
      </div>
    </div>
  )
}
