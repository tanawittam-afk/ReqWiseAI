"use client";

/**
 * The application sidebar.
 *
 * Behaves like a desktop productivity app rather than a website nav: persistent on
 * desktop, collapsible to icons, and reduced to a horizontal scroll strip on tablet
 * portrait and phones. Sections that later slices will fill are listed and disabled —
 * visible structure is honest about where the product is going, a hidden one is not.
 *
 * Active state is derived from the pathname, never passed down, so no page has to
 * remember to tell the sidebar where it is.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

type Item = {
  href: string;
  label: string;
  icon: string;
  ready: boolean;
};

const ITEMS: Item[] = [
  { href: "/workspace/dashboard", label: "Dashboard", icon: "▤", ready: false },
  { href: "/workspace/projects", label: "Projects", icon: "▣", ready: true },
  { href: "/workspace/analysis", label: "Analysis Workspace", icon: "◫", ready: false },
  { href: "/workspace/questions", label: "Open Questions", icon: "◌", ready: false },
  { href: "/workspace/traceability", label: "Traceability", icon: "⟋", ready: false },
  { href: "/workspace/settings", label: "Settings", icon: "⚙", ready: false },
];

export function Sidebar({ workspaceName }: { workspaceName: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  const isActive = (item: Item) => pathname.startsWith(item.href);

  return (
    <nav
      aria-label="Workspace"
      data-collapsed={collapsed}
      className="flex shrink-0 flex-col border-b border-border-soft bg-chrome
                 md:h-dvh md:w-[248px] md:border-r md:border-b-0
                 md:data-[collapsed=true]:w-[68px]"
    >
      <div className="flex items-center gap-2.5 px-4 py-3 md:px-3 md:py-4">
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-lg bg-accent text-sm font-semibold text-on-accent"
        >
          R
        </span>
        <span className={`flex min-w-0 flex-col ${collapsed ? "md:hidden" : ""}`}>
          <span className="truncate text-sm font-semibold text-text">ReqWise AI</span>
          <span className="truncate text-xs text-text-faint">{workspaceName}</span>
        </span>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          className="ml-auto hidden size-8 shrink-0 place-items-center rounded-md text-text-faint
                     transition-colors hover:bg-chrome-hover hover:text-text md:grid"
        >
          <span aria-hidden="true">{collapsed ? "»" : "«"}</span>
          <span className="sr-only">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
        </button>
      </div>

      <ul
        className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:overflow-visible md:px-2 md:pb-2"
      >
        {ITEMS.map((item) => {
          const active = isActive(item);
          const shared =
            "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors min-h-11 md:min-h-0 md:py-2";

          if (!item.ready) {
            return (
              <li key={item.href}>
                <span
                  aria-disabled="true"
                  title="Coming in a later slice"
                  className={`${shared} cursor-not-allowed text-text-faint`}
                >
                  <span aria-hidden="true" className="w-4 text-center">
                    {item.icon}
                  </span>
                  <span className={collapsed ? "md:hidden" : ""}>{item.label}</span>
                </span>
              </li>
            );
          }

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`${shared} ${
                  active
                    ? "bg-surface font-medium text-text shadow-[0_1px_2px_rgba(27,26,24,0.06)] ring-1 ring-border-soft"
                    : "text-text-muted hover:bg-chrome-hover hover:text-text"
                }`}
              >
                <span aria-hidden="true" className="w-4 text-center">
                  {item.icon}
                </span>
                <span className={collapsed ? "md:hidden" : ""}>{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
