/**
 * The protected shell — and the visible proof that slice 1 works.
 *
 * Everything on this page is read with the user's own client, so what renders is
 * exactly what RLS permits. The organization shown was created by the
 * `handle_new_user` trigger at sign-up, never by this application.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "../auth/actions";

export const metadata = { title: "Workspace — ReqWise AI" };

export default async function WorkspacePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The middleware already redirects signed-out traffic; this is the belt to its
  // braces, and it narrows the type.
  if (!user) redirect("/sign-in");

  const { data: memberships } = await supabase
    .from("organization_members")
    .select("role, organizations(id, name, is_personal)")
    .returns<
      { role: string; organizations: { id: string; name: string; is_personal: boolean } }[]
    >();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-8 p-6 sm:py-12">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-semibold">Workspace</h1>
          <p className="text-sm opacity-70">{user.email}</p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-black/15 px-3 py-1.5 text-sm
                       transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
          >
            Sign out
          </button>
        </form>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide opacity-60">
          Organizations
        </h2>
        <ul className="flex flex-col gap-2">
          {(memberships ?? []).map((m) => (
            <li
              key={m.organizations.id}
              className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/15"
            >
              {m.organizations.name}
              <span className="opacity-60">
                {" · "}
                {m.role}
                {m.organizations.is_personal ? " · personal" : ""}
              </span>
            </li>
          ))}
        </ul>
        {(memberships ?? []).length === 0 ? (
          <p className="text-sm text-red-600 dark:text-red-400">
            No organization found — the workspace bootstrap trigger did not run.
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide opacity-60">Projects</h2>
        {projects && projects.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {projects.map((p) => (
              <li
                key={p.id}
                className="rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/15"
              >
                {p.name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm opacity-70">
            No projects yet. Creating one is the next vertical slice.
          </p>
        )}
      </section>
    </main>
  );
}
