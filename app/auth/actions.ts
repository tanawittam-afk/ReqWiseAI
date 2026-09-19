"use server";

/**
 * Email auth, as Server Actions.
 *
 * Credentials never touch a Client Component's state and no token is handled in
 * React — `@supabase/ssr` writes the session cookie, the middleware refreshes it.
 * Errors come back as a returned value rather than a thrown exception so the form can
 * render them; `redirect()` is only reached on success.
 */

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSignUpEnabled } from "@/lib/admin/sign-up-toggle";
import type { AuthState } from "./state";

/** Only allow relative paths back into this app — never an open redirect. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "";
  return next.startsWith("/") && !next.startsWith("//") ? next : "/workspace";
}

function readCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("password") ?? ""),
  };
}

export async function signIn(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  if (!email || !password) return { error: "Email and password are required.", notice: null };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message, notice: null };

  revalidatePath("/", "layout");
  redirect(safeNext(formData.get("next")));
}

export async function signUp(_prev: AuthState, formData: FormData): Promise<AuthState> {
  const { email, password } = readCredentials(formData);
  const displayName = String(formData.get("display_name") ?? "").trim();
  if (!email || !password) return { error: "Email and password are required.", notice: null };

  const supabase = await createClient();

  // Phase 1, Slice 4 — the admin sign-up switch. A deliberate `enabled: false` blocks;
  // an RPC failure (outage, not a toggle) fails open rather than silently freezing
  // sign-up indefinitely — see lib/admin/sign-up-toggle.ts.
  const toggle = await isSignUpEnabled(supabase);
  if (toggle.ok && !toggle.enabled) {
    return { error: "Sign-ups are currently closed. Contact the site owner.", notice: null };
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    // Read by the handle_new_user trigger to name the personal workspace.
    options: { data: displayName ? { display_name: displayName } : undefined },
  });
  if (error) return { error: error.message, notice: null };

  // With email confirmation enabled there is no session yet; the workspace bootstrap
  // still ran, but the user cannot sign in until they confirm.
  if (!data.session) {
    return {
      error: null,
      notice: `Account created. Confirm the link sent to ${email}, then sign in.`,
    };
  }

  revalidatePath("/", "layout");
  redirect("/workspace");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/sign-in");
}
