/**
 * The application shell: sidebar, toolbar, workspace surface.
 *
 * Written once here so every page below is only about its own subject, and so moving
 * between pages changes the workspace area rather than the whole window. `proxy.ts`
 * has already turned away signed-out traffic; the `getUser()` call is what turns a
 * session into a name, and the membership read is what names the workspace.
 */

import { redirect } from "next/navigation";
import { SkipLink } from "@/app/_components/skip-link";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../auth/actions";
import { Sidebar } from "./_components/sidebar";
import { Toolbar } from "./_components/toolbar";

export default async function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const { data: membership } = await supabase
    .from("organization_members")
    .select("organizations (name)")
    .limit(1)
    .maybeSingle();

  const organizations = (membership as { organizations: { name: string } | null } | null)
    ?.organizations;

  /*
   * On desktop the window is the application: the shell is exactly one viewport tall
   * and never scrolls. Scrolling belongs to the content area — or, on the analysis
   * workspace, to each panel individually (docs/design/INTERFACE.md §1). Below `md`
   * the sidebar is a strip above the content and the page scrolls normally.
   *
   * `md:flex-none` is load-bearing: the root layout's `<body>` is a column flex
   * container, and a flex item with `flex: 1 1 0%` takes its height from the
   * container's content rather than from its own `height`, which would make `h-dvh`
   * silently do nothing and let the whole page grow past the viewport.
   */
  return (
    <div
      className="flex min-h-dvh flex-1 flex-col bg-app
                 md:h-dvh md:flex-none md:flex-row md:overflow-hidden"
    >
      <SkipLink />
      <Sidebar workspaceName={organizations?.name ?? "Personal workspace"} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Toolbar>
          <details className="relative">
            {/* 44px until `lg`: a tablet is touch-operated at 768px just as a phone
                is at 390px, so density waits for the width where a mouse is likely. */}
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-[var(--radius-card)] px-2 text-sm text-text-muted transition-colors hover:bg-chrome-hover hover:text-text lg:min-h-9">
              <span
                aria-hidden="true"
                className="grid size-6 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
              >
                {(user.email ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden max-w-[16ch] truncate sm:inline">{user.email}</span>
            </summary>
            {/* Transient overlay, not a resting panel — the one other deliberate shadow
                exception besides the inspector drawer (docs/design/INTERFACE.md §9). */}
            <div className="absolute right-0 z-20 mt-1 w-56 rounded-[var(--radius-panel)] border border-border-soft bg-surface p-1.5 shadow-[0_8px_24px_rgba(27,26,24,0.12)]">
              <p className="truncate px-2.5 py-1.5 text-xs text-text-faint">{user.email}</p>
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex min-h-11 w-full items-center rounded-[var(--radius-card)] px-2.5 text-left text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text lg:min-h-9"
                >
                  Sign out
                </button>
              </form>
            </div>
          </details>
        </Toolbar>

        {/*
         * Not a `<main>` tag: every page under this layout already renders its own
         * `<main>` (the correct single landmark per page) — wrapping a second one here
         * would nest landmarks, which assistive tech treats as invalid. This `id` is
         * only the skip link's jump target, sharing the name (`main-content`) the
         * public site header's `<main>` uses so one skip-link component works both
         * places (docs/design/INTERFACE.md, Implementation notes).
         */}
        <div id="main-content" className="flex min-h-0 flex-1 flex-col overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}
