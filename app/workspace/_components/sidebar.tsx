"use client";

/**
 * The application sidebar.
 *
 * Behaves like a desktop productivity app rather than a website nav: persistent and
 * collapsible from `md` up, and below `md` a **stacked** navigation behind a Menu
 * button (docs/design/INTERFACE.md §13). It used to be a horizontally scrolling strip
 * at every width under `md`; on a 390px screen that showed three of five entries and
 * hid the rest behind a scrollbar nobody would think to drag.
 *
 * Touch targets stay at 44px until **`lg`**, not `md`. `md` is the width at which a
 * sidebar column fits, which is not the same question as whether a finger is doing the
 * pointing — a 768px tablet is touch-operated and gets the same targets a phone does.
 * Density arrives at `lg`, where a mouse is the overwhelming likelihood.
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
import { Icon, type IconName } from "../../_components/icon";
import { T } from "../../_components/t";
import { LangToggle } from "../../_components/lang-toggle";
import { ThemeToggle } from "./theme-toggle";

type Item = NavTarget & {
  label: React.ReactNode;
  icon: IconName;
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
    icon: "dashboard",
    // `/workspace` redirects here, so that path counts as Dashboard. An **alias**, not
    // a prefix: `/workspace` as a prefix would own the entire application.
    aliases: ["/workspace"],
  },
  {
    href: "/workspace/projects",
    label: <T en="Projects" th="โปรเจกต์" />,
    icon: "projects",
    // An analysis run, a source and an export are all reached through a project and
    // have no sidebar entry of their own, so the project entry stays lit under them.
    ownsSubtree: true,
  },
  {
    href: "/workspace/requirements",
    label: <T en="Requirements" th="ความต้องการ" />,
    icon: "requirements",
  },
  { href: "/workspace/reviews", label: <T en="Reviews" th="การรีวิว" />, icon: "reviews" },
  { href: "/workspace/settings", label: <T en="Settings" th="ตั้งค่า" />, icon: "settings" },
];

export function Sidebar({ workspaceName }: { workspaceName: string }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <nav
      aria-label="Workspace"
      data-collapsed={collapsed}
      className="screen-only flex shrink-0 flex-col border-b border-border-soft bg-chrome
                 md:h-dvh md:w-[248px] md:border-r md:border-b-0
                 md:data-[collapsed=true]:w-[68px]"
    >
      <div className="flex items-center gap-2.5 px-4 py-2 md:px-3 md:py-4">
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

        {/* Desktop: collapse the column to icons. */}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          aria-expanded={!collapsed}
          className="ml-auto hidden size-11 shrink-0 place-items-center rounded-[var(--radius-card)] text-text-faint
                     transition-colors hover:bg-chrome-hover hover:text-text md:grid lg:size-8"
        >
          <Icon name={collapsed ? "sidebar-expand" : "sidebar-collapse"} size={16} />
          <span className="sr-only">
            {collapsed ? <T en="Expand sidebar" th="ขยายแถบด้านข้าง" /> : <T en="Collapse sidebar" th="ย่อแถบด้านข้าง" />}
          </span>
        </button>

        {/*
         * Below `md`: open the stacked navigation. A real 44px control, and the whole
         * mobile nav is behind it — closed, the application chrome is one row instead of
         * three, which on a 390×844 screen is the difference between seeing the first
         * dashboard tile and not.
         */}
        <button
          type="button"
          onClick={() => setMenuOpen((value) => !value)}
          aria-expanded={menuOpen}
          aria-controls="workspace-nav-items"
          className="ml-auto flex min-h-11 shrink-0 items-center gap-2 rounded-[var(--radius-card)] px-3 text-sm
                     text-text-muted transition-colors hover:bg-chrome-hover hover:text-text md:hidden"
        >
          <Icon name={menuOpen ? "close" : "menu"} size={16} />
          <span>
            <T en="Menu" th="เมนู" />
          </span>
        </button>
      </div>

      {/*
       * One list, two layouts.
       *
       * Below `md` it is a **stacked** navigation (docs/design/INTERFACE.md §13), hidden
       * until the Menu button opens it. It used to be a horizontally scrolling strip:
       * on a 390px screen that showed three of the five entries and put the other two
       * behind a scrollbar nobody would think to drag — a menu that hides half of itself
       * is not navigation.
       *
       * From `md` up it is the persistent column, unchanged.
       */}
      <ul
        id="workspace-nav-items"
        className={`flex-col gap-1 px-3 pb-3 md:flex md:min-h-0 md:flex-1 md:overflow-y-auto md:px-2 md:pb-2 ${
          menuOpen ? "flex" : "hidden"
        }`}
      >
        {ITEMS.map((item) => {
          const active = isActiveNav(pathname, item);

          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                // Tapping a destination closes the menu — on mobile the panel covers the
                // page it just navigated to, so leaving it open would hide the answer.
                onClick={() => setMenuOpen(false)}
                // Framed at rest, not only on hover/active. An audit found these read as
                // bare text until you happened to point at them — the same "หาปุ่มไม่เจอ"
                // problem as the text-link actions, in the one place a person looks first.
                className={`flex min-h-11 items-center gap-2.5 rounded-[var(--radius-card)] border px-3 py-2 text-sm whitespace-nowrap transition-colors lg:min-h-0 md:py-2 ${
                  active
                    ? "border-accent-border bg-accent-soft font-medium text-accent"
                    : "border-border-soft bg-surface text-text-muted hover:bg-chrome-hover hover:text-text"
                }`}
              >
                <span className="grid w-4 place-items-center">
                  <Icon name={item.icon} size={16} />
                </span>
                <span className={collapsed ? "md:hidden" : ""}>{item.label}</span>
              </Link>
            </li>
          );
        })}

        {/*
         * The toggles ride inside the open mobile menu, at full size.
         *
         * They used to sit in the toolbar in their `compact` form — but `compact` was
         * built for the *collapsed desktop column*, so it stacks its two options
         * vertically and shrinks each to 32px. In a horizontal toolbar that rendered as
         * ☀ above ☾ and EN above TH, four sub-44px targets in a space meant for one
         * row. Here there is width for the real control, and it matches where the
         * toggles live on desktop: in the navigation, not the toolbar.
         */}
        <li className="mt-1 flex flex-wrap gap-2 border-t border-border-soft pt-3 md:hidden">
          <ThemeToggle />
          <LangToggle />
        </li>
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
