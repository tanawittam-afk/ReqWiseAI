/**
 * The application shell: sidebar, toolbar, workspace surface.
 *
 * Written once here so every page below is only about its own subject, and so moving
 * between pages changes the workspace area rather than the whole window. `proxy.ts`
 * has already turned away signed-out traffic; the `getUser()` call is what turns a
 * session into a name, and the membership read is what names the workspace.
 */

import { redirect } from "next/navigation";
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

  return (
    <div className="flex min-h-dvh flex-1 flex-col bg-app md:flex-row">
      <Sidebar workspaceName={organizations?.name ?? "Personal workspace"} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Toolbar>
          <details className="relative">
            <summary className="flex h-9 cursor-pointer list-none items-center gap-2 rounded-lg px-2 text-sm text-text-muted transition-colors hover:bg-chrome-hover hover:text-text">
              <span
                aria-hidden="true"
                className="grid size-6 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
              >
                {(user.email ?? "?").slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden max-w-[16ch] truncate sm:inline">{user.email}</span>
            </summary>
            <div className="absolute right-0 z-20 mt-1 w-56 rounded-xl border border-border-soft bg-surface p-1.5 shadow-[0_8px_24px_rgba(27,26,24,0.12)]">
              <p className="truncate px-2.5 py-1.5 text-xs text-text-faint">{user.email}</p>
              <form action={signOut}>
                <button
                  type="submit"
                  className="w-full rounded-lg px-2.5 py-2 text-left text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
                >
                  Sign out
                </button>
              </form>
            </div>
          </details>
        </Toolbar>

        {children}
      </div>
    </div>
  );
}
