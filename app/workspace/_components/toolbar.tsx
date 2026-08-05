"use client";

/**
 * The compact toolbar.
 *
 * Stays visually identical between project pages — only the context label changes —
 * so moving around the app feels like changing workspaces inside one window rather
 * than loading new pages. Search and the command palette are placeholders for the
 * slices that will own them; they are shown disabled rather than hidden so the shape
 * of the finished toolbar is legible now.
 */

import { usePathname } from "next/navigation";
import { Icon } from "../../_components/icon";

function contextLabel(pathname: string): string {
  if (pathname === "/workspace/projects/new") return "New project";
  if (pathname.includes("/analyses/")) return "Analysis";
  if (pathname.includes("/sources/")) return "Source";
  if (pathname.startsWith("/workspace/projects/")) return "Project";
  if (pathname.startsWith("/workspace/projects")) return "Projects";
  return "Workspace";
}

export function Toolbar({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // `screen-only` keeps the toolbar out of a printed export (globals.css → printing).
  return (
    <header className="screen-only sticky top-0 z-10 flex items-center gap-3 border-b border-border-soft bg-chrome/85 px-4 py-2.5 backdrop-blur-md sm:px-6">
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
        <span className="hidden font-mono text-[11px] tracking-wide text-text-faint uppercase sm:inline">
          ReqWise AI
        </span>
        <span aria-hidden="true" className="hidden text-text-faint sm:inline">
          /
        </span>
        <span className="truncate font-medium text-text">{contextLabel(pathname)}</span>
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          disabled
          title="Search and command palette arrive with the analysis workspace"
          className="hidden h-9 items-center gap-2 rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 text-sm text-text-faint sm:flex"
        >
          <Icon name="search" size={14} />
          <span>Search</span>
          <kbd className="ml-2 rounded-[calc(var(--radius-card)_-_1px)] border border-border-soft bg-surface-muted px-1.5 py-0.5 font-mono text-[11px]">
            ⌘K
          </kbd>
        </button>
        {/*
         * The theme and language toggles live in the navigation at every width — in the
         * sidebar's footer on desktop, inside the stacked mobile menu below `md`. They
         * used to be duplicated here in their `compact` form for mobile, but `compact`
         * is the *collapsed desktop column's* shape: it stacks its two options
         * vertically and shrinks each to 32px, which in a horizontal toolbar came out
         * as ☀ over ☾ and EN over TH — four sub-44px targets, and a toolbar that looked
         * broken. One home for them is also one fewer thing to keep in step.
         */}
        {children}
      </div>
    </header>
  );
}
