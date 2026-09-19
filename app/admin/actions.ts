"use server";

/**
 * `/admin`'s two writes (Phase 1, Slice 4): toggle sign-up, reset a user's daily
 * counter. Both independently re-run `requireAdminUser()` — never trust that the page
 * already checked; a Server Action is its own entry point and must refuse on its own.
 * Both then call the service-role client, the only client `admin_set_sign_up_enabled`
 * and `admin_reset_daily_usage` are reachable from (no grant to `authenticated`).
 */

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { readServerEnvironment } from "@/lib/config/env";
import { requireAdminUser } from "@/lib/admin/guard";
import { setSignUpEnabled } from "@/lib/admin/sign-up-toggle";
import { resetUsage } from "@/lib/admin/usage";
import type { ToggleSignUpFormState } from "./form-state";

const NOT_AUTHORIZED = "Not authorized.";

export async function toggleSignUpAction(
  _prev: ToggleSignUpFormState,
  formData: FormData,
): Promise<ToggleSignUpFormState> {
  const supabase = await createClient();
  const guard = await requireAdminUser(supabase, readServerEnvironment().adminEmail.email);
  if (!guard.ok) return { error: NOT_AUTHORIZED };

  // The button's hidden field carries the TARGET state — computed server-side in
  // sign-up-toggle-section.tsx as the opposite of the current state, so submitting it
  // needs no client-side JS to decide what "toggle" means.
  const enabled = formData.get("enabled") === "true";

  const result = await setSignUpEnabled(createAdminClient(), enabled, guard.user.id);
  if (!result.ok) return { error: result.error };

  revalidatePath("/admin");
  return {
    success: enabled ? "Sign-ups are now open." : "Sign-ups are now closed.",
  };
}

/** Bound to a plain `<form action={resetUsageAction}>` with one hidden `targetUserId`
 * field — void return, no bound state, same shape as `deleteGeminiKeyAction`; the
 * revalidated table is the confirmation. */
export async function resetUsageAction(formData: FormData): Promise<void> {
  const supabase = await createClient();
  const guard = await requireAdminUser(supabase, readServerEnvironment().adminEmail.email);
  if (!guard.ok) return;

  const targetUserId = String(formData.get("targetUserId") ?? "").trim();
  if (targetUserId.length === 0) return;

  await resetUsage(createAdminClient(), targetUserId);
  revalidatePath("/admin");
}
