/**
 * The shared chrome for pages outside the signed-in `/workspace` shell — the landing
 * page and the public demo. Deliberately not `app/workspace/_components/toolbar.tsx`
 * or `sidebar.tsx`, both of which assume a signed-in route (a workspace name, an
 * account menu, `usePathname()`-driven nav to pages a visitor cannot reach).
 *
 * Promoted here in Phase 3 of the 2026-08-03 UX/UI plan from `app/demo/_components/`,
 * where it first shipped in Phase 2 — the landing page needed the identical header,
 * not a second copy of it.
 */

import Link from "next/link";
import { T } from "./t";
import { LangToggle } from "./lang-toggle";
import { SkipLink } from "./skip-link";
import { ThemeToggle } from "../workspace/_components/theme-toggle";

export function SiteHeader() {
  /*
   * Touch targets are 44px until `lg`, the same rule the workspace chrome follows
   * (`app/workspace/_components/sidebar.tsx`): `md` is the width at which a sidebar
   * column fits, which is a different question from whether a finger is doing the
   * pointing. A 768px tablet is touch-operated; density waits for `lg`.
   *
   * The toggles are **not** `compact` here. `compact` is the collapsed desktop
   * column's shape — it stacks its two options vertically and shrinks each to 32px —
   * and in a horizontal header that rendered as ☀ over ☾ and EN over TH, four
   * sub-44px targets in a row meant for one.
   */
  return (
    <>
      <SkipLink />
      <header className="flex shrink-0 items-center gap-2 border-b border-border-soft bg-chrome px-4 py-2 sm:gap-3 sm:px-6">
      <Link href="/" className="flex min-h-11 items-center gap-2.5 lg:min-h-0">
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-card)] bg-accent text-sm font-semibold text-on-accent"
        >
          R
        </span>
        <span className="hidden font-display text-sm font-bold text-text sm:inline">ReqWise AI</span>
      </Link>

      <div className="ml-auto flex flex-wrap items-center justify-end gap-2">
        <ThemeToggle />
        <LangToggle />
        <Link
          href="/sign-up"
          className="hidden min-h-11 items-center rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 text-sm font-medium
                     text-text transition-colors hover:bg-surface-hover sm:flex lg:min-h-9"
        >
          <T en="Create account" th="สร้างบัญชี" />
        </Link>
        <Link
          href="/sign-in"
          className="flex min-h-11 items-center rounded-[var(--radius-card)] bg-accent px-3 text-sm font-semibold text-on-accent
                     transition-colors hover:bg-accent-hover lg:min-h-9"
        >
          <T en="Sign in" th="เข้าสู่ระบบ" />
        </Link>
      </div>
      </header>
    </>
  );
}
