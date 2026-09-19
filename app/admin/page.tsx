/**
 * The `/admin` page (Phase 1, Slice 4) — the last piece of the Protection phase.
 * Standalone route, sibling of `app/workspace/`, not nested under it: no sidebar entry,
 * since this is a single-admin-only surface, and the App Router gives that for free by
 * not nesting under `app/workspace/layout.tsx`.
 *
 * Two-step gate, same shape as every other authenticated page in this app plus one more
 * check: `auth.getUser()` first (redirect `/sign-in` if signed out — `proxy.ts` also
 * protects this prefix, this is the same intentional doubling `settings/page.tsx` has),
 * then `requireAdminUser()` (redirect `/workspace`, not a "you are not the admin"
 * message — least disclosure). Every read past the gate uses the service-role client:
 * `admin_list_daily_usage` has no grant to `authenticated` at all (see the migration),
 * so there is no other way to call it.
 */

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readServerEnvironment } from "@/lib/config/env";
import { requireAdminUser } from "@/lib/admin/guard";
import { isSignUpEnabled } from "@/lib/admin/sign-up-toggle";
import { listTodayUsage } from "@/lib/admin/usage";
import { T } from "@/app/_components/t";
import { SignUpToggleSection } from "./sign-up-toggle-section";
import { UsageTable } from "./usage-table";

export const metadata = { title: "Admin — ReqWise AI" };

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in");

  const guard = await requireAdminUser(supabase, readServerEnvironment().adminEmail.email);
  if (!guard.ok) redirect("/workspace");

  const adminClient = createAdminClient();
  const [toggle, usage] = await Promise.all([
    isSignUpEnabled(adminClient),
    listTodayUsage(adminClient),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-[var(--space-shell-gap)] px-[var(--space-shell-x)] py-[var(--space-shell-y)] sm:px-[var(--space-shell-x-lg)] sm:py-[var(--space-shell-y-lg)]">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">
          <T en="Admin" th="ผู้ดูแลระบบ" />
        </h1>
        <p className="text-sm text-text-muted">
          <T
            en="Sign-up control and today's per-user analysis usage. Visible only to the admin account."
            th="ควบคุมการสมัครสมาชิกและการใช้งานวิเคราะห์รายวันของแต่ละผู้ใช้ในวันนี้ มองเห็นได้เฉพาะบัญชีผู้ดูแลระบบ"
          />
        </p>
      </header>

      <SignUpToggleSection enabled={toggle.ok ? toggle.enabled : true} />

      <UsageTable rows={usage} />
    </main>
  );
}
