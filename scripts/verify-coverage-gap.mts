/**
 * Phase 3, Slice 3 runtime verification — the `coverage_gap` schema and
 * `update_coverage_gap()`, against a real Postgres. Scaffolded now, ahead of the
 * orchestration that actually creates gap items during a real analysis (Slice 5), so
 * the workflow RPC itself is proven before anything calls it for real. A gap item is
 * inserted directly here (service role) to simulate what Slice 5's persistence will do.
 *
 *   npm run verify:coverage-gap   (needs .env.local pointing at a Supabase project,
 *                                   with 20260921000031/032/033 already applied)
 *
 * Every user-facing assertion runs on an authenticated user's own client, so RLS and
 * the RPC's own auth.uid()/membership/active checks are what is being measured. The
 * service role appears only to build fixtures and to insert the one gap item directly
 * (there is still no RPC that creates one — that is Slice 5).
 *
 * Companion to verify-manual-add / verify-workflow, same shape.
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
const emailA = `reqwise-coverage-gap-a-${stamp}@example.com`;
const emailB = `reqwise-coverage-gap-b-${stamp}@example.com`;

async function createUser(email: string): Promise<string> {
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`could not create ${email}: ${error.message}`);
  return data.user.id;
}

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
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

async function newProject(org: string, creator: string, name: string, profileId: string): Promise<string> {
  const { data, error } = await admin
    .from("projects")
    .insert({ organization_id: org, domain_profile_id: profileId, name, created_by: creator, output_lang: "en" })
    .select("id")
    .single();
  if (error) throw new Error(`could not create project ${name}: ${error.message}`);
  return data.id as string;
}

/** Simulates what Slice 5's orchestration will do — inserting a `coverage_gap` item
 *  directly, as `persist_analysis_result()` will once it accepts gap items. There is
 *  still no RPC that creates one on its own. */
async function newGapItem(project: string, displayId: string): Promise<string> {
  const { data, error } = await admin
    .from("analysis_items")
    .insert({
      project_id: project,
      analysis_run_id: null,
      item_type: "coverage_gap",
      display_id: displayId,
      provider_key: `gap-${displayId}`,
      title: "Statement discussed but not written",
      description: "A source-text statement no requirement currently covers.",
      priority: "unassigned",
      status: "draft",
      version_no: 1,
      evidence_class: "stated",
      origin: "quality_rule",
      confidence: 1.0,
    })
    .select("id")
    .single();
  if (error) throw new Error(`could not insert gap item: ${error.message}`);
  return data.id as string;
}

async function main(): Promise<void> {
  console.log("\nReqWise AI — Phase 3, Slice 3 coverage-gap schema verification\n");

  const userA = await createUser(emailA);
  await createUser(emailB);
  const clientA = await signIn(emailA);
  const clientB = await signIn(emailB);
  const orgA = await personalOrg(userA);

  const { data: profile } = await admin.from("domain_profiles").select("id").limit(1).single();
  const profileId = (profile as { id: string }).id;

  const projectA = await newProject(orgA, userA, `Coverage gap A ${stamp}`, profileId);

  let gapId = "";
  await check("1. a coverage_gap item is inserted with workflow_state 'open'", async () => {
    gapId = await newGapItem(projectA, "GAP-001");
    const { data } = await admin
      .from("analysis_items")
      .select("workflow_state, status, origin")
      .eq("id", gapId)
      .single();
    const row = data as { workflow_state: string | null; status: string; origin: string };
    assert(row.workflow_state === "open", `workflow_state is '${row.workflow_state}'`);
    assert(row.status === "draft", `status is '${row.status}'`);
    assert(row.origin === "quality_rule", `origin is '${row.origin}'`);
    return "workflow_state=open, status=draft, origin=quality_rule";
  });

  await check("2. acknowledge (no note required)", async () => {
    const result = await clientA.rpc("update_coverage_gap", {
      p_item_id: gapId,
      p_expected_state: "open",
      p_to_state: "acknowledged",
    });
    assert(!result.error, `acknowledge failed: ${result.error?.message}`);
    const activity = (result.data as { activity_id: string }).activity_id;
    const { data } = await admin
      .from("review_activities")
      .select("activity_type")
      .eq("id", activity)
      .single();
    assert((data as { activity_type: string }).activity_type === "gap_acknowledged", "wrong activity type");
    return "gap_acknowledged recorded";
  });

  await check("3. resolve (note required)", async () => {
    const result = await clientA.rpc("update_coverage_gap", {
      p_item_id: gapId,
      p_expected_state: "acknowledged",
      p_to_state: "resolved",
      p_note: "Covered by a new requirement added from this gap.",
    });
    assert(!result.error, `resolve failed: ${result.error?.message}`);
    return "resolved";
  });

  await check("4. reopen, then dismiss — both require a note", async () => {
    const reopened = await clientA.rpc("update_coverage_gap", {
      p_item_id: gapId,
      p_expected_state: "resolved",
      p_to_state: "open",
      p_note: "Turned out not to be fully covered after all.",
    });
    assert(!reopened.error, `reopen failed: ${reopened.error?.message}`);
    const dismissed = await clientA.rpc("update_coverage_gap", {
      p_item_id: gapId,
      p_expected_state: "open",
      p_to_state: "dismissed",
      p_note: "Actually chit-chat, not a real requirement gap.",
    });
    assert(!dismissed.error, `dismiss failed: ${dismissed.error?.message}`);
    return "reopened then dismissed";
  });

  await check("5. resolving without a note is refused", async () => {
    const message = refused(
      await clientA.rpc("update_coverage_gap", {
        p_item_id: gapId,
        p_expected_state: "dismissed",
        p_to_state: "open",
      }),
      "reopening without a note",
    );
    return message.slice(0, 60);
  });

  let findingId = "";
  await check("6. calling update_coverage_gap() on a quality_finding is refused", async () => {
    const { data, error } = await admin
      .from("analysis_items")
      .insert({
        project_id: projectA,
        analysis_run_id: null,
        item_type: "quality_finding",
        display_id: "QF-001",
        provider_key: "gap-check-fixture-qf-001",
        title: "Not a gap",
        description: "A real quality finding, not a coverage gap.",
        priority: "unassigned",
        status: "draft",
        version_no: 1,
        evidence_class: "stated",
        origin: "quality_rule",
        confidence: 1.0,
        attributes: { finding: "ambiguous", target_keys: [] },
      })
      .select("id")
      .single();
    if (error) throw new Error(`could not insert quality_finding fixture: ${error.message}`);
    findingId = data.id as string;

    const message = refused(
      await clientA.rpc("update_coverage_gap", {
        p_item_id: findingId,
        p_expected_state: "open",
        p_to_state: "acknowledged",
      }),
      "calling update_coverage_gap() on a quality_finding",
    );
    assert(/not a coverage gap/i.test(message), `wrong refusal: ${message}`);
    return message.slice(0, 60);
  });

  await check("7. a non-member is refused with the generic 'not found' message", async () => {
    const message = refused(
      await clientB.rpc("update_coverage_gap", {
        p_item_id: gapId,
        p_expected_state: "dismissed",
        p_to_state: "open",
        p_note: "Trying to reopen someone else's gap.",
      }),
      "an outsider updating another tenant's gap",
    );
    assert(/not found|not visible/i.test(message), `the refusal leaked more than 'not found': ${message}`);
    return message.slice(0, 60);
  });

  await check(
    "9. display_id_prefix('coverage_gap') returns 'GAP', not null — Slice 5's persist_analysis_result() path",
    async () => {
      const result = await clientA.rpc("display_id_prefix", { p_type: "coverage_gap" });
      assert(!result.error, `call failed: ${result.error?.message}`);
      assert(result.data === "GAP", `expected 'GAP', got '${result.data}'`);
      return "GAP";
    },
  );

  await check(
    "8. add_manual_requirement() refuses item_type 'coverage_gap' — is_reviewable_item_type() fix",
    async () => {
      const message = refused(
        await clientA.rpc("add_manual_requirement", {
          p_project: projectA,
          p_item_type: "coverage_gap",
          p_title: "Trying to fake a gap by hand",
          p_description: "A human should never be able to create a coverage_gap directly.",
          p_priority: "medium",
        }),
        "manually creating a coverage_gap via add_manual_requirement()",
      );
      return message.slice(0, 60);
    },
  );
}

let failed = false;
try {
  await main();
} catch (err) {
  failed = true;
  console.error(`\nverification aborted: ${err instanceof Error ? err.message : String(err)}`);
}

const passed = results.filter((r) => r.ok).length;
console.log(`\n${passed}/${results.length} checks passed`);
process.exit(failed || passed !== results.length ? 1 : 0);
