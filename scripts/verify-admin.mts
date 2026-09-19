/**
 * Phase 1, Slice 4 runtime verification — the /admin privilege boundary, against a real
 * Postgres.
 *
 *   npm run verify:admin        (needs .env.local pointing at a Supabase project, with
 *                                 20260919000026_app_settings.sql already applied)
 *
 * This migration is the first in the schema to ship SECURITY DEFINER functions with NO
 * grant to `authenticated` at all (admin_set_sign_up_enabled, admin_list_daily_usage,
 * admin_reset_daily_usage) — every earlier RPC in this schema is reachable by any
 * signed-in user on their own client. What this script proves, that a unit test cannot,
 * is that Supabase's real default privileges actually enforce that: an ordinary
 * authenticated user's own client must be refused; only the service-role client
 * succeeds. It also round-trips sign_up_is_enabled() through an anonymous (signed-out)
 * client, since that is the one function in this schema that must work pre-auth.
 *
 * The Node-side admin-email check (lib/admin/guard.ts: does user.email === ADMIN_EMAIL)
 * has its own unit coverage in tests/admin/guard.test.ts — this script does not
 * re-simulate "signing in as the real admin", since ADMIN_EMAIL is the owner's real
 * account and a script cannot safely mint a second user with that same email (Supabase
 * enforces unique emails). Combined, unit tests + this script cover both halves: the
 * Node-side identity check, and the database-side privilege boundary underneath it.
 *
 * Companion to verify-db / projects / sources / analysis / review / workflow, same shape.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..");

function loadEnv(): Record<string, string> {
  const env: Record<string, string> = {};
  for (const name of [".env.local", ".env"]) {
    let raw: string;
    try {
      raw = readFileSync(join(root, name), "utf8");
    } catch {
      continue;
    }
    for (const line of raw.split(/\r?\n/)) {
      const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (!match) continue;
      const value = match[2].trim().replace(/^["']|["']$/g, "");
      if (value && env[match[1]] === undefined) env[match[1]] = value;
    }
  }
  return { ...env, ...process.env } as Record<string, string>;
}

const env = loadEnv();
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_ || !ANON || !SERVICE) {
  console.error("missing env — need the Supabase URL, anon key and service-role key in .env.local");
  process.exit(1);
}

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false, autoRefreshToken: false } });

type Check = { name: string; ok: boolean };
const results: Check[] = [];

async function check(name: string, fn: () => Promise<string>): Promise<void> {
  try {
    const detail = await fn();
    results.push({ name, ok: true });
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (err) {
    results.push({ name, ok: false });
    console.log(`  FAIL  ${name} — ${err instanceof Error ? err.message : String(err)}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function refused(result: { error: { message: string } | null }, what: string): string {
  assert(result.error, `${what} was ALLOWED but must be refused`);
  return result.error.message.split("\n")[0];
}

const stamp = Date.now();
const password = `Verify!${stamp}`;
const email = `reqwise-admin-verify-${stamp}@example.com`;

let userId = "";
let client: SupabaseClient;

async function createUser(): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`could not create ${email}: ${error.message}`);
  return data.user.id;
}

async function signIn(): Promise<SupabaseClient> {
  const c = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await c.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`could not sign in ${email}: ${error.message}`);
  return c;
}

function anonClient(): SupabaseClient {
  return createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function main(): Promise<void> {
  console.log("\nReqWise AI — Phase 1, Slice 4 /admin privilege boundary verification\n");

  userId = await createUser();
  client = await signIn();

  await check("1. sign_up_is_enabled() works with no session at all (anon-granted)", async () => {
    const { data, error } = await anonClient().rpc("sign_up_is_enabled");
    assert(!error, `anon call failed: ${error?.message}`);
    assert(typeof data === "boolean", `expected a boolean, got ${JSON.stringify(data)}`);
    return `returned ${data} for a signed-out caller`;
  });

  await check("2. an ordinary authenticated user is refused admin_set_sign_up_enabled", async () => {
    const message = refused(
      await client.rpc("admin_set_sign_up_enabled", { p_enabled: false, p_admin_user_id: userId }),
      "an ordinary user toggling sign-up",
    );
    return message.slice(0, 60);
  });

  await check("3. an ordinary authenticated user is refused admin_list_daily_usage", async () => {
    const message = refused(
      await client.rpc("admin_list_daily_usage"),
      "an ordinary user listing everyone's usage",
    );
    return message.slice(0, 60);
  });

  await check("4. an ordinary authenticated user is refused admin_reset_daily_usage", async () => {
    const message = refused(
      await client.rpc("admin_reset_daily_usage", { p_target_user_id: userId }),
      "an ordinary user resetting a counter (even their own)",
    );
    return message.slice(0, 60);
  });

  await check("5. the service-role client can toggle sign-up, and it round-trips", async () => {
    const off = await admin.rpc("admin_set_sign_up_enabled", { p_enabled: false, p_admin_user_id: userId });
    assert(!off.error, `service-role toggle-off failed: ${off.error?.message}`);
    const afterOff = await anonClient().rpc("sign_up_is_enabled");
    assert(afterOff.data === false, `expected false after toggling off, got ${afterOff.data}`);

    const on = await admin.rpc("admin_set_sign_up_enabled", { p_enabled: true, p_admin_user_id: userId });
    assert(!on.error, `service-role toggle-on failed: ${on.error?.message}`);
    const afterOn = await anonClient().rpc("sign_up_is_enabled");
    assert(afterOn.data === true, `expected true after toggling back on, got ${afterOn.data}`);

    return "off → anon read false; on → anon read true; left at true";
  });

  await check("6. the service-role client can list and reset a real user's usage", async () => {
    const spend = await client.rpc("increment_daily_usage", { p_limit: 10 });
    assert(!spend.error, `spending a slot failed: ${spend.error?.message}`);

    const listed = await admin.rpc("admin_list_daily_usage");
    assert(!listed.error, `service-role list failed: ${listed.error?.message}`);
    const row = (listed.data as Array<{ user_id: string; email: string; analyses_count: number }>).find(
      (r) => r.user_id === userId,
    );
    assert(row, "the just-spent slot did not appear in admin_list_daily_usage()");
    assert(row.email === email, `listed email '${row.email}' does not match '${email}'`);
    assert(row.analyses_count >= 1, `expected at least 1 spent, got ${row.analyses_count}`);

    const reset = await admin.rpc("admin_reset_daily_usage", { p_target_user_id: userId });
    assert(!reset.error, `service-role reset failed: ${reset.error?.message}`);

    const after = await admin.rpc("admin_list_daily_usage");
    const rowAfter = (after.data as Array<{ user_id: string; analyses_count: number }>).find(
      (r) => r.user_id === userId,
    );
    assert(!rowAfter || rowAfter.analyses_count === 0, "the reset did not zero the counter");

    return `listed (${row.analyses_count} spent), reset to 0`;
  });

  await check("7. admin_reset_daily_usage on a user with no row today is a harmless no-op", async () => {
    const freshEmail = `reqwise-admin-verify-nouser-${stamp}@example.com`;
    const { data, error } = await admin.auth.admin.createUser({
      email: freshEmail,
      password,
      email_confirm: true,
    });
    assert(!error, `could not create a fresh user: ${error?.message}`);
    const result = await admin.rpc("admin_reset_daily_usage", { p_target_user_id: data.user.id });
    assert(!result.error, `reset on a user with no usage row failed: ${result.error?.message}`);
    return "no error on a user with nothing to reset";
  });
}

let failed = false;
try {
  await main();
} catch (err) {
  failed = true;
  console.error(`\nverification aborted: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  if (userId) {
    console.log(
      "\nVerification users remain (auth.users) — delete manually if unwanted:\n" +
        `  ${email}\n`,
    );
  }
}

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(failed || passed !== results.length ? 1 : 0);
