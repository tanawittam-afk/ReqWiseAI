/**
 * The demo's own chrome — deliberately not `app/workspace/_components/toolbar.tsx` or
 * `sidebar.tsx`, both of which assume a signed-in `/workspace` route (a workspace name,
 * an account menu, `usePathname()`-driven nav to pages a visitor cannot reach). A
 * public page gets a minimal header of its own rather than a reused shell with parts
 * disabled.
 */

import Link from "next/link";
import { T } from "@/app/_components/t";
import { LangToggle } from "@/app/_components/lang-toggle";
import { ThemeToggle } from "@/app/workspace/_components/theme-toggle";

export function DemoHeader() {
  return (
    <header className="flex shrink-0 items-center gap-3 border-b border-border-soft bg-chrome px-4 py-2.5 sm:px-6">
      <Link href="/" className="flex items-center gap-2.5">
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-[var(--radius-card)] bg-accent text-sm font-semibold text-on-accent"
        >
          R
        </span>
        <span className="hidden font-display text-sm font-bold text-text sm:inline">ReqWise AI</span>
      </Link>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle compact />
        <LangToggle compact />
        <Link
          href="/sign-up"
          className="hidden min-h-9 items-center rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 text-sm font-medium
                     text-text transition-colors hover:bg-surface-hover sm:flex"
        >
          <T en="Create account" th="สร้างบัญชี" />
        </Link>
        <Link
          href="/sign-in"
          className="flex min-h-9 items-center rounded-[var(--radius-card)] bg-accent px-3 text-sm font-semibold text-on-accent
                     transition-colors hover:bg-accent-hover"
        >
          <T en="Sign in" th="เข้าสู่ระบบ" />
        </Link>
      </div>
    </header>
  );
}
