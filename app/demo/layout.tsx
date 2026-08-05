/**
 * The demo shell. Deliberately not `app/workspace/layout.tsx` — that layout calls
 * `getUser()` and redirects a signed-out visitor to `/sign-in`, which is exactly the
 * traffic this route exists to receive. `/demo` is also excluded from `proxy.ts`'s
 * matcher (Phase 2 of the 2026-08-03 UX/UI plan), so nothing here or upstream ever
 * touches Supabase — this page renders from the engine's own output, not a query.
 *
 * Same one-viewport-tall shell convention as the workspace layout, so the Analysis
 * Workspace beneath it gets the same scroll behaviour (each panel scrolls on its own,
 * the page itself never does).
 */

import { SiteHeader } from "../_components/site-header";

export default function DemoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col bg-app">
      <SiteHeader />
      <main
        id="main-content"
        tabIndex={-1}
        className="flex min-h-0 flex-1 flex-col overflow-hidden focus-visible:outline-2 focus-visible:outline-accent focus-visible:-outline-offset-2"
      >
        {children}
      </main>
    </div>
  );
}
