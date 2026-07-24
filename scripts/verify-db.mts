/**
 * Runtime verification of the Phase 3A schema against a real Postgres.
 *
 *   npm run verify:db          (needs .env.local pointing at a Supabase project)
 *
 * Proves the seven acceptance checks in `supabase/README.md`. Everything the schema
 * claims — bootstrap, tenant isolation, immutability, "the AI never decides",
 * versioning, the review audit trail, display-id allocation — is asserted here against
 * the database itself, not against application code.
 *
 * This is deliberately NOT part of `npm test`: the default suite stays offline and
 * deterministic. This script needs a network and it writes real rows, which it cleans
 * up on the way out.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { loadDomainProfileByKey } from "../lib/domain/load-profile.ts";

// --- env -------------------------------------------------------------------

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
  console.error(
    "missing env. Need NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and " +
      "SUPABASE_SERVICE_ROLE_KEY in .env.local (copy .env.example).",
  );
  process.exit(1);
}

const admin = createClient(URL_, SERVICE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function userClient(): SupabaseClient {
  return createClient(URL_, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// --- tiny assertion harness ------------------------------------------------

type Result = { name: string; ok: boolean; detail: string };
const results: Result[] = [];

async function check(name: string, fn: () => Promise<string>): Promise<void> {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    console.log(`  PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    results.push({ name, ok: false, detail });
    console.log(`  FAIL  ${name} — ${detail}`);
  }
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Asserts a Supabase call was refused, and returns the refusal message. */
function refused(result: { error: { message: string } | null }, what: string): string {
  assert(result.error, `${what} was ALLOWED but must be refused`);
  return result.error.message.split("\n")[0];
}

const stamp = Date.now();
const password = `Verify!${stamp}`;
const emailA = `reqwise-verify-a-${stamp}@example.com`;
const emailB = `reqwise-verify-b-${stamp}@example.com`;

let userA = "";
let userB = "";
let clientA: SupabaseClient;
let clientB: SupabaseClient;
let orgA = "";
let projectA = "";
let sourceA = "";
let runA = "";
let itemA = "";

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
  const client = userClient();
  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw new Error(`could not sign in ${email}: ${error.message}`);
  return client;
}

async function main(): Promise<void> {
  console.log(`\nReqWise AI — Phase 3A runtime verification against ${URL_}\n`);

  userA = await createUser(emailA, "Verify A");
  userB = await createUser(emailB, "Verify B");
  clientA = await signIn(emailA);
  clientB = await signIn(emailB);

  // --- 1. bootstrap --------------------------------------------------------
  await check("1. workspace bootstrap on sign-up", async () => {
    const { data: profile } = await admin
      .from("profiles")
      .select("user_id, display_name")
      .eq("user_id", userA)
      .maybeSingle();
    assert(profile, "no profiles row was created for the new user");

    const { data: memberships, error } = await admin
      .from("organization_members")
      .select("organization_id, role, organizations(is_personal, name)")
      .eq("user_id", userA);
    assert(!error, `membership query failed: ${error?.message}`);
    assert(memberships?.length === 1, `expected 1 membership, got ${memberships?.length}`);

    const membership = memberships[0] as unknown as {
      organization_id: string;
      role: string;
      organizations: { is_personal: boolean; name: string };
    };
    assert(membership.role === "owner", `expected role 'owner', got '${membership.role}'`);
    assert(membership.organizations.is_personal, "the bootstrap org is not personal");
    orgA = membership.organization_id;
    return `1 personal org (owner), profile "${profile.display_name}"`;
  });

  // --- domain profile: the seeded content must parse through the real loader
  await check("0. seeded domain profile loads and validates", async () => {
    const profile = await loadDomainProfileByKey(clientA, "booking_smart_space");
    assert(profile.terminology.length > 0, "profile content is empty — was seed.sql applied?");
    return `${profile.name}: ${profile.terminology.length} terms, ` +
      `${profile.commonWorkflows.length} workflows`;
  });

  // set-up rows owned by A
  const { data: dp } = await clientA
    .from("domain_profiles")
    .select("id")
    .eq("key", "booking_smart_space")
    .single();
  assert(dp, "domain profile row missing — apply supabase/seed.sql");

  const { data: project, error: projectError } = await clientA
    .from("projects")
    .insert({
      organization_id: orgA,
      domain_profile_id: dp.id,
      name: "Verification project",
      created_by: userA,
    })
    .select("id")
    .single();
  assert(!projectError, `project insert failed: ${projectError?.message}`);
  projectA = project.id;

  const { data: source, error: sourceError } = await clientA
    .from("source_documents")
    .insert({
      project_id: projectA,
      kind: "meeting_notes",
      title: "Verification source",
      raw_text: "ลูกค้าจองห้องล่วงหน้าและชำระเงินก่อนเข้าใช้บริการ",
      created_by: userA,
    })
    .select("id")
    .single();
  assert(!sourceError, `source insert failed: ${sourceError?.message}`);
  sourceA = source.id;

  // --- 2. RLS isolation ----------------------------------------------------
  await check("2. RLS isolation between tenants", async () => {
    const { data: projects } = await clientB.from("projects").select("id");
    assert(projects?.length === 0, `user B can see ${projects?.length} of user A's projects`);

    const { data: sources } = await clientB.from("source_documents").select("id");
    assert(sources?.length === 0, `user B can see ${sources?.length} of user A's sources`);

    const denied = refused(
      await clientB.from("projects").insert({
        organization_id: orgA,
        domain_profile_id: dp.id,
        name: "trespass",
        created_by: userB,
      }),
      "user B inserting into user A's organization",
    );
    return `B sees 0 projects, 0 sources; cross-tenant insert refused (${denied})`;
  });

  // --- 3. immutability -----------------------------------------------------
  await check("3. sources freeze on analysis; runs are immutable outright", async () => {
    // Slice 3 narrowed this rule deliberately (20260724000008). A source used to be
    // write-once, which was right while a source arrived already analysed and wrong
    // once a BA could paste notes and re-read them before running anything. What is
    // immutable now is a revision something *cites* — which is what this checks.
    const { error: editError } = await clientA
      .from("source_documents")
      .update({ title: "edited before any analysis" })
      .eq("id", sourceA);
    assert(!editError, `an unanalysed source refused a legitimate edit: ${editError?.message}`);

    const { data: run, error: runError } = await admin
      .from("analysis_runs")
      .insert({
        project_id: projectA,
        source_document_id: sourceA,
        provider: "mock",
        schema_version: "1.0.0",
        output_lang: "th",
        validation_status: "valid",
        created_by: userA,
      })
      .select("id")
      .single();
    assert(!runError, `analysis_run insert failed: ${runError?.message}`);
    runA = run.id;

    // The run now cites the source, so the source is frozen — for its owner and for
    // the service role alike, because this one is a trigger rather than a policy.
    const userFrozen = refused(
      await clientA.from("source_documents").update({ title: "edited after analysis" }).eq("id", sourceA),
      "editing a source that an analysis run cites",
    );
    const adminFrozen = refused(
      await admin.from("source_documents").update({ title: "edited after analysis" }).eq("id", sourceA),
      "editing a cited source as service role",
    );
    const deleteFrozen = refused(
      await admin.from("source_documents").delete().eq("id", sourceA),
      "deleting a source as service role",
    );

    const updateRun = refused(
      await admin.from("analysis_runs").update({ provider: "gemini" }).eq("id", runA),
      "updating an analysis run",
    );
    return (
      `unanalysed edit allowed; after analysis frozen (user: ${userFrozen}; ` +
      `service role: ${adminFrozen}); delete refused (${deleteFrozen}); ` +
      `run update refused (${updateRun})`
    );
  });

  // --- 4. the AI never decides --------------------------------------------
  await check("4. items are born draft and cannot self-approve", async () => {
    const bornApproved = refused(
      await admin.from("analysis_items").insert({
        project_id: projectA,
        analysis_run_id: runA,
        item_type: "business_requirement",
        display_id: "BR-999",
        provider_key: "br-approved",
        title: "Illegally approved at birth",
        description: "This insert must be refused by the trigger.",
        status: "approved",
        evidence_class: "stated",
        origin: "source_analysis",
        confidence: 0.9,
      }),
      "inserting an item with status 'approved'",
    );

    const { data: item, error: itemError } = await admin
      .from("analysis_items")
      .insert({
        project_id: projectA,
        analysis_run_id: runA,
        item_type: "business_requirement",
        display_id: "BR-001",
        provider_key: "br-verification",
        title: "ระบบต้องแสดงห้องว่างแบบเรียลไทม์",
        description: "Availability must reflect confirmed reservations in real time.",
        evidence_class: "stated",
        origin: "source_analysis",
        confidence: 0.9,
      })
      .select("id, status, version_no")
      .single();
    assert(!itemError, `draft item insert failed: ${itemError?.message}`);
    assert(item.status === "draft", `item was created as '${item.status}', not 'draft'`);
    itemA = item.id;

    const directApprove = refused(
      await clientA.from("analysis_items").update({ status: "approved" }).eq("id", itemA),
      "a direct status UPDATE",
    );
    return `insert-as-approved refused (${bornApproved}); direct status update refused (${directApprove})`;
  });

  // --- 5. versioning -------------------------------------------------------
  await check("5. editing an item writes the previous version", async () => {
    const originalTitle = "ระบบต้องแสดงห้องว่างแบบเรียลไทม์";
    const { error } = await clientA
      .from("analysis_items")
      .update({ title: "ระบบต้องแสดงห้องว่างแบบเรียลไทม์ (แก้ไข)" })
      .eq("id", itemA);
    assert(!error, `edit failed: ${error?.message}`);

    const { data: item } = await clientA
      .from("analysis_items")
      .select("version_no, title")
      .eq("id", itemA)
      .single();
    assert(item?.version_no === 2, `expected version_no 2, got ${item?.version_no}`);

    const { data: versions } = await clientA
      .from("item_versions")
      .select("version_no, snapshot")
      .eq("item_id", itemA);
    assert(versions?.length === 1, `expected 1 version row, got ${versions?.length}`);
    const snapshot = versions[0].snapshot as { title: string };
    assert(
      snapshot.title === originalTitle,
      `the version snapshot holds '${snapshot.title}', not the pre-edit title`,
    );
    return "version_no 1 → 2, snapshot holds the OLD title";
  });

  // --- 6. review audit trail ----------------------------------------------
  await check("6. status changes only through review_item(), always audited", async () => {
    const toReviewed = await clientA.rpc("review_item", {
      p_item_id: itemA,
      p_activity_type: "status_change",
      p_to_status: "reviewed",
      p_comment: "verification pass",
    });
    assert(!toReviewed.error, `review_item(reviewed) failed: ${toReviewed.error?.message}`);

    const toApproved = await clientA.rpc("review_item", {
      p_item_id: itemA,
      p_activity_type: "approve",
      p_to_status: "approved",
      p_comment: null,
    });
    assert(!toApproved.error, `review_item(approved) failed: ${toApproved.error?.message}`);

    const invalid = refused(
      await clientA.rpc("review_item", {
        p_item_id: itemA,
        p_activity_type: "status_change",
        p_to_status: "draft",
        p_comment: null,
      }),
      "an invalid transition approved → draft",
    );

    const { data: item } = await clientA
      .from("analysis_items")
      .select("status")
      .eq("id", itemA)
      .single();
    assert(item?.status === "approved", `expected status 'approved', got '${item?.status}'`);

    const { data: activities } = await clientA
      .from("review_activities")
      .select("actor_id, activity_type, from_status, to_status")
      .eq("item_id", itemA)
      .order("to_status");
    assert(activities?.length === 2, `expected 2 activity rows, got ${activities?.length}`);
    assert(
      activities.every((a) => a.actor_id === userA),
      "an activity row was not stamped with the acting user",
    );
    return `draft → reviewed → approved, 2 audit rows stamped with the actor; invalid transition refused (${invalid})`;
  });

  // --- 7. display ids ------------------------------------------------------
  await check("7. display ids are allocated per project and per type", async () => {
    const first = await clientA.rpc("next_display_id", {
      p_project: projectA,
      p_type: "business_requirement",
    });
    assert(!first.error, `next_display_id failed: ${first.error?.message}`);

    const { error: insertError } = await admin.from("analysis_items").insert({
      project_id: projectA,
      analysis_run_id: runA,
      item_type: "business_requirement",
      display_id: first.data,
      provider_key: "br-second",
      title: "Second requirement",
      description: "Allocated through next_display_id().",
      evidence_class: "inferred",
      origin: "source_analysis",
      confidence: 0.6,
    });
    assert(!insertError, `insert with allocated id failed: ${insertError?.message}`);

    const second = await clientA.rpc("next_display_id", {
      p_project: projectA,
      p_type: "business_requirement",
    });
    const other = await clientA.rpc("next_display_id", {
      p_project: projectA,
      p_type: "user_story",
    });
    assert(first.data === "BR-002", `expected BR-002 after BR-001, got ${first.data}`);
    assert(second.data === "BR-003", `expected BR-003, got ${second.data}`);
    assert(other.data === "US-001", `expected US-001 for a fresh type, got ${other.data}`);
    return `${first.data} → ${second.data}, independent per type (${other.data})`;
  });
}

// --- cleanup ---------------------------------------------------------------

function cleanupNotice(): void {
  if (!projectA && !userA) return;
  console.log(
    "\nTest data cannot be removed through the API — the immutability triggers refuse " +
      "DELETE even for the service role, and a projects cascade hits them too. That is " +
      "the schema working. Clear it with:\n" +
      "\n  npx supabase db query --linked -f scripts/verify-db-cleanup.sql\n",
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
