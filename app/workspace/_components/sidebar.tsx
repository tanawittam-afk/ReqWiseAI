"use client";

/**
 * The application sidebar.
 *
 * Behaves like a desktop productivity app rather than a website nav: persistent on
 * desktop, collapsible to icons, and reduced to a horizontal scroll strip on tablet
 * portrait and phones.
 *
 * **Every entry here works.** The convention this file used to follow — all nine
 * destinations listed, unbuilt ones rendered as a disabled `<span>` — was honest about
 * the plan and useless to a person: seven of nine did nothing. As of Phase 5 an entry
 * exists only if its route does. `docs/design/INTERFACE.md` §7 was rewritten in the
 * same commit; if the two ever disagree again, the code is not the thing to change
 * back.
 *
 * Active state is derived from the pathname, never passed down, so no page has to
 * remember to tell the sidebar where it is.
 *
 * Carries `screen-only`: a printed export is a document, not a screenshot of the
 * application, so the print rules in `app/globals.css` remove the whole shell.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { isActiveNav, type NavTarget } from "@/lib/workspace/nav";
import { T } from "../../_components/t";
import { LangToggle } from "../../_components/lang-toggle";
import { ThemeToggle } from "./theme-toggle";

type Item = NavTarget & {
  label: React.ReactNode;
  icon: string;
};

/**
 * The five destinations of docs/design/INTERFACE.md §7, in that order. Icons are plain
 * geometry — never a copy of a macOS or Apple application icon (§7).
 *
 * Two entries the old nine had are gone rather than disabled, and both for the same
 * reason — the feature is real but does not live at workspace scope:
 *
 * - **Analysis Runs** — a run is reached through its project and its source, which is
 *   the only context in which "run 3 of 4" means anything. The Requirements view
 *   answers the cross-project question a global run list was standing in for.
 * - **Traceability** — per-project by design, at
 *   `/workspace/projects/:id/traceability`. A matrix spanning unrelated projects would
 *   draw lines between requirements that have nothing to do with each other.
 *
 * **Domain Profiles** is also gone as its own entry: Settings absorbed it, since a
 * profile is data to read about, not a place to work.
 *
 * Labels are wrapped in `<T>` — chrome only, never requirement content
 * (CLAUDE.md → the UI language and an analysis's output language are separate axes).
 */
const ITEMS: Item[] = [
  {
    href: "/workspace/dashboard",
    label: <T en="Dashboard" th="แดชบอร์ด" />,
    icon: "▤",
    // `/workspace` redirects here, so that path counts as Dashboard. An **alias**, not
    // a prefix: `/workspace` as a prefix would own the entire application.
    aliases: ["/workspace"],
  },
  {
    href: "/workspace/projects",
    label: <T en="Projects" th="โปรเจกต์" />,
    icon: "▣",
    // An analysis run, a source and an export are all reached through a project and
    // have no sidebar entry of their own, so the project entry stays lit under them.
    ownsSubtree: true,
  },
  {
    href: "/workspace/requirements",
    label: <T en="Requirements" th="ความต้องการ" />,
    icon: "≡",
  },
  { href: "/workspace/reviews", label: <T en="Reviews" th="การรีวิว" />, icon: "✓" },
  { href: "/workspace/settings", label: <T en="Settings" th="ตั้งค่า" />, icon: "⚙" },
];

export function Sidebar({ workspaceName }: { workspaceName: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <nav
      aria-label="Workspace"
      data-collapsed={collapsed}
      className="screen-only flex shrink-0 flex-col border-b border-border-soft bg-chrome
                 md:h-dvh md:w-[248px] md:border-r md:border-b-0
                 md:data-[collapsed=true]:w-[68px]"
    >
      <div className="flex items-center gap-2.5 px-4 py-3 md:px-3 md:py-4">
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-card)] bg-accent text-sm font-semibold text-on-accent"
        >
          R
        </span>
        <span className={`flex min-w-0 flex-col ${collapsed ? "md:hidden" : ""}`}>
          <span className="truncate font-display text-sm font-bold text-text">ReqWise AI</span>
          <span className="truncate font-mono text-[11px] text-text-faint">{workspaceName}</span>
        </span>
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          className="ml-auto hidden size-8 shrink-0 place-items-center rounded-[var(--radius-card)] text-text-faint
                     transition-colors hover:bg-chrome-hover hover:text-text md:grid"
        >
          <span aria-hidden="true">{collapsed ? "»" : "«"}</span>
          <span className="sr-only">{collapsed ? "Expand sidebar" : "Collapse sidebar"}</span>
        </button>
      </div>

      <ul
        className="flex gap-1 overflow-x-auto px-3 pb-3 md:min-h-0 md:flex-1 md:flex-col md:overflow-x-visible md:overflow-y-auto md:px-2 md:pb-2"
      >
        {ITEMS.map((item) => {
          const active = isActiveNav(pathname, item);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-2.5 rounded-[var(--radius-card)] px-3 py-2 text-sm whitespace-nowrap transition-colors md:min-h-0 md:py-2 ${
                  active
                    ? "bg-accent-soft font-medium text-accent"
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

      <div
        className={`hidden shrink-0 gap-2 border-t border-border-soft p-2 md:flex md:justify-center ${
          collapsed ? "md:flex-col" : ""
        }`}
      >
        <ThemeToggle compact={collapsed} />
        <LangToggle compact={collapsed} />
      </div>
    </nav>
  );
}
