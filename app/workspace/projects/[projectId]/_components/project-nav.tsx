"use client";

/**
 * The project-level sub-navigation.
 *
 * Before this, every project-level link was hand-rolled inline in a page body, with no
 * active state and no two pages agreeing on the set — the overview offered Traceability
 * and Export as cards, the sources list linked back to the overview with an arrow, and
 * nothing told a reader where they were inside the project. One component now owns the
 * set and the active state, on the same `isActiveNav` rule the sidebar uses.
 *
 * **Rendered by the pages that want it, not by a layout.** A `layout.tsx` under
 * `[projectId]` would also wrap two surfaces that must not have chrome above them: the
 * analysis workspace, which is a full-height three-panel application view
 * (docs/design/INTERFACE.md §1), and the export print/preview routes, which are
 * documents rather than screens. Opting in from four page bodies is three lines each
 * and cannot break either.
 *
 * Carries `screen-only`, like every other piece of application chrome.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { isActiveNav } from "@/lib/workspace/nav";

export function ProjectNav({
  projectId,
  /** Traceability and Export are only meaningful once there is something to read. */
  hasItems,
}: {
  projectId: string;
  hasItems: boolean;
}) {
  const pathname = usePathname();
  const base = `/workspace/projects/${projectId}`;

  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/sources`, label: "Sources", ownsSubtree: true },
    { href: `/workspace/requirements?project=${projectId}`, label: "Requirements", external: true },
    ...(hasItems
      ? [
          { href: `${base}/traceability`, label: "Traceability" },
          { href: `${base}/exports`, label: "Export", ownsSubtree: true },
        ]
      : []),
  ];

  return (
    <nav aria-label="Project" className="screen-only -mx-1 overflow-x-auto">
      <ul className="flex w-max gap-0.5 rounded-[var(--radius-panel)] border border-border-soft bg-chrome p-0.5">
        {tabs.map((tab) => {
          // The Requirements tab leaves the project subtree entirely (it is the
          // workspace-wide view, pre-filtered), so it is never the active tab here.
          const active =
            !("external" in tab) &&
            isActiveNav(pathname, { href: tab.href, ownsSubtree: tab.ownsSubtree });

          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-[var(--radius-card)] px-3 text-sm whitespace-nowrap transition-colors lg:min-h-9 ${
                  active
                    ? "bg-accent-soft font-medium text-accent"
                    : "text-text-muted hover:bg-chrome-hover hover:text-text"
                }`}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
