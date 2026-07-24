/**
 * Slice 2 runtime verification — the project lifecycle against a real Postgres.
 *
 *   npm run verify:projects        (needs .env.local pointing at a Supabase project)
 *
 * Ten assertions, all of them about things the application layer cannot be trusted to
 * enforce on its own: who may create a project where, who may see it, what a project
 * is born as, what archiving records, and what can never be deleted.
 *
 * Companion to scripts/verify-db.mts, same shape. Not part of `npm test`: this one
 * needs a network and writes real rows.
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

const admin = createClient(URL_, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

type Result = { name: string; ok: boolean };
const results: Result[] = [];

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

/** `.single()` types its data as nullable; a missing row here is a failed check. */
function row<T>(
  result: { data: unknown; error: { message: string } | null },
  what: string,
): T {
  assert(!result.error, `${what} failed: ${result.error?.message}`);
  assert(result.data, `${what} returned no row`);
  return result.data as T;
}

type ArchiveState = {
  status: string;
  archived_at: string | null;
  archived_by: string | null;
  archive_reason: string | null;
};

type ProjectContent = {
  name: string;
  description: string | null;
  business_objective: string | null;
  known_stakeholders: string[];
};

const stamp = Date.now();
const password = `Verify!${stamp}`;
const emailA = `reqwise-verify-a-${stamp}@example.com`;
const emailB = `reqwise-verify-b-${stamp}@example.com`;

let userA = "";
let userB = "";
let clientA: SupabaseClient;
let clientB: SupabaseClient;
let orgA = "";
let orgB = "";
let profileId = "";
let projectA = "";

async function createUser(email: string, displayName: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error) throw new Error(`could not create ${email}: ${error.message}`);
  return data.user.id;
}

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createClient(URL_, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`could not sign in ${email}: ${error.message}`);
  return client;
}

async function personalOrg(userId: string): Promise<string> {
  const { data } = await admin
    .from("organization_members")
    .select("organization_id, organizations!inner (is_personal)")
    .eq("user_id", userId)
    .eq("organizations.is_personal", true)
    .single();
  return (data as { organization_id: string }).organization_id;
}

async function main(): Promise<void> {
  console.log(`\nReqWise AI — Slice 2 project lifecycle verification against ${URL_}\n`);

  userA = await createUser(emailA, "Verify A");
  userB = await createUser(emailB, "Verify B");
  clientA = await signIn(emailA);
  clientB = await signIn(emailB);
  orgA = await personalOrg(userA);
  orgB = await personalOrg(userB);

  const { data: profile } = await clientA
    .from("domain_profiles")
    .select("id")
    .eq("key", "booking_smart_space")
    .single();
  assert(profile, "the booking_smart_space profile is missing — apply supabase/seed.sql");
  profileId = profile.id;

  // --- 1 ---------------------------------------------------------------
  await check("1. a user can create a project in their own personal workspace", async () => {
    const { data, error } = await clientA
      .from("projects")
      .insert({
        organization_id: orgA,
        domain_profile_id: profileId,
        name: "Slice 2 verification project",
        description: "Created by scripts/verify-projects.mts",
        business_objective: "Prove the lifecycle end to end",
        known_stakeholders: ["Front Desk Staff", "Operations Manager"],
        output_lang: "th",
        created_by: userA,
      })
      .select("id, status, known_stakeholders, output_lang")
      .single();

    assert(!error, `insert failed: ${error?.message}`);
    projectA = data.id;
    return `project ${data.id.slice(0, 8)}…, ${data.known_stakeholders.length} stakeholders, ${data.output_lang}`;
  });

  // --- 2 ---------------------------------------------------------------
  await check("2. a user cannot create a project in someone else's organization", async () => {
    const denied = refused(
      await clientA.from("projects").insert({
        organization_id: orgB,
        domain_profile_id: profileId,
        name: "trespass",
        created_by: userA,
      }),
      "inserting into user B's organization",
    );
    return denied;
  });

  // --- 3 ---------------------------------------------------------------
  await check("3. user B cannot see user A's project, by list or by id", async () => {
    const { data: list } = await clientB.from("projects").select("id");
    assert(list?.length === 0, `user B sees ${list?.length} projects`);

    const { data: direct } = await clientB
      .from("projects")
      .select("id, name")
      .eq("id", projectA)
      .maybeSingle();
    assert(direct === null, "user B can read user A's project by id");
    return "0 rows by list, null by direct id";
  });

  // --- 4 ---------------------------------------------------------------
  await check("4. a new project is born active with no archive metadata", async () => {
    const data = row<ArchiveState>(
      await clientA
        .from("projects")
        .select("status, archived_at, archived_by, archive_reason")
        .eq("id", projectA)
        .single(),
      "reading the project state",
    );

    assert(data.status === "active", `status is '${data.status}'`);
    assert(
      data.archived_at === null && data.archived_by === null && data.archive_reason === null,
      "a fresh project already carries archive metadata",
    );

    // The status column is not writable directly, even by its owner.
    const denied = refused(
      await clientA.from("projects").update({ status: "archived" }).eq("id", projectA),
      "a direct status UPDATE",
    );
    return `active; direct status update refused (${denied})`;
  });

  // --- 5 ---------------------------------------------------------------
  await check("5. archive records archived_at and archived_by from the JWT", async () => {
    const { error } = await clientA.rpc("archive_project", {
      p_project: projectA,
      p_reason: "verification run",
    });
    assert(!error, `archive_project failed: ${error?.message}`);

    const data = row<ArchiveState>(
      await clientA
        .from("projects")
        .select("status, archived_at, archived_by, archive_reason")
        .eq("id", projectA)
        .single(),
      "reading the project state",
    );

    assert(data.status === "archived", `status is '${data.status}'`);
    assert(data.archived_at !== null, "archived_at was not recorded");
    assert(data.archived_by === userA, "archived_by is not the acting user");
    assert(data.archive_reason === "verification run", "the reason was not stored");
    return `archived_by = the caller, reason kept`;
  });

  // --- 6 ---------------------------------------------------------------
  await check("6. an archived project keeps its data and is read-only", async () => {
    const data = row<ProjectContent>(
      await clientA
        .from("projects")
        .select("name, description, business_objective, known_stakeholders")
        .eq("id", projectA)
        .single(),
      "reading the archived project",
    );

    assert(data.name === "Slice 2 verification project", "the name changed");
    assert(data.known_stakeholders.length === 2, "stakeholders were lost");

    const denied = refused(
      await clientA.from("projects").update({ name: "edited while archived" }).eq("id", projectA),
      "editing an archived project",
    );
    return `data intact; edit refused (${denied})`;
  });

  // --- 7 ---------------------------------------------------------------
  await check("7. only an owner may restore, and restore clears the archive fields", async () => {
    const denied = refused(
      await clientB.rpc("restore_project", { p_project: projectA }),
      "user B restoring user A's project",
    );

    const { error } = await clientA.rpc("restore_project", { p_project: projectA });
    assert(!error, `restore_project failed: ${error?.message}`);

    const data = row<ArchiveState>(
      await clientA
        .from("projects")
        .select("status, archived_at, archived_by, archive_reason")
        .eq("id", projectA)
        .single(),
      "reading the project state",
    );

    assert(data.status === "active", `status is '${data.status}'`);
    assert(
      data.archived_at === null && data.archived_by === null && data.archive_reason === null,
      "archive metadata survived the restore",
    );
    return `cross-tenant restore refused (${denied}); fields cleared`;
  });

  // --- 8 ---------------------------------------------------------------
  await check("8. a project cannot be hard-deleted", async () => {
    const { data: rows, error } = await clientA
      .from("projects")
      .delete()
      .eq("id", projectA)
      .select("id");

    // No DELETE policy exists, so PostgREST matches nothing rather than raising.
    assert(error || (rows ?? []).length === 0, "a project was hard-deleted");

    const { data: still } = await clientA
      .from("projects")
      .select("id")
      .eq("id", projectA)
      .maybeSingle();
    assert(still, "the project disappeared after a delete attempt");
    return error ? error.message.split("\n")[0] : "no rows matched (no DELETE policy)";
  });

  // --- 9 ---------------------------------------------------------------
  await check("9. a built-in domain profile is readable but not writable", async () => {
    const { data: readable } = await clientA
      .from("domain_profiles")
      .select("id, key, name")
      .eq("id", profileId)
      .maybeSingle();
    assert(readable, "the profile is not readable by an authenticated user");

    const { data: updated } = await clientA
      .from("domain_profiles")
      .update({ name: "hijacked" })
      .eq("id", profileId)
      .select("id");
    assert((updated ?? []).length === 0, "a user edited a built-in domain profile");

    const denied = refused(
      await clientA.from("domain_profiles").insert({
        key: `rogue_${stamp}`,
        name: "Rogue",
        description: "should not exist",
      }),
      "inserting a domain profile",
    );
    return `readable; update matched 0 rows; insert refused (${denied})`;
  });

  // --- 10 --------------------------------------------------------------
  await check("10. immutable columns stay immutable, archived or not", async () => {
    const org = refused(
      await clientA.from("projects").update({ organization_id: orgB }).eq("id", projectA),
      "moving a project to another organization",
    );
    refused(
      await clientA.from("projects").update({ created_by: userB }).eq("id", projectA),
      "changing project.created_by",
    );
    refused(
      await clientA
        .from("projects")
        .update({ domain_profile_id: "00000000-0000-0000-0000-000000000000" })
        .eq("id", projectA),
      "changing the domain profile",
    );

    // A legitimate edit still works — the guard is narrow, not a blanket ban.
    const { error } = await clientA
      .from("projects")
      .update({ name: "Slice 2 verification project (renamed)" })
      .eq("id", projectA);
    assert(!error, `a permitted rename failed: ${error?.message}`);

    return `org (${org}); creator refused; domain refused; rename allowed`;
  });
}

function cleanupNotice(): void {
  if (!projectA && !userA) return;
  console.log(
    "\nVerification rows remain — projects cannot be deleted through the API by design.\n" +
      "Clear them with:\n\n  npx supabase db query --linked -f scripts/verify-db-cleanup.sql\n",
  );
}

let failed = false;
try {
  await main();
} catch (err) {
  failed = true;
  console.error(`\nverification aborted: ${err instanceof Error ? err.message : String(err)}`);
} finally {
  cleanupNotice();
}

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(failed || passed !== results.length ? 1 : 0);
