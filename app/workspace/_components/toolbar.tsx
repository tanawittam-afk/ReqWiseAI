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
import { LangToggle } from "../../_components/lang-toggle";
import { ThemeToggle } from "./theme-toggle";

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
          <span aria-hidden="true">⌕</span>
          <span>Search</span>
          <kbd className="ml-2 rounded-[calc(var(--radius-card)_-_1px)] border border-border-soft bg-surface-muted px-1.5 py-0.5 font-mono text-[11px]">
            ⌘K
          </kbd>
        </button>
        {/* Sidebar carries the toggles on desktop (md+); the sidebar collapses to a
            horizontal strip below md with no room for them, so they live here instead. */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle compact />
          <LangToggle compact />
        </div>
        {children}
      </div>
    </header>
  );
}
