/**
 * Slice 5 runtime verification — requirement editing, human review, approval and
 * version history, against a real Postgres.
 *
 *   npm run verify:review        (needs .env.local pointing at a Supabase project)
 *
 * Every user-facing assertion runs on an authenticated user's own client, so RLS and
 * the RPCs' own auth.uid()/membership checks are what the test is measuring. The
 * service role appears only where a *fixture* has to exist (creating a run and its
 * items the way the analysis pipeline would) and never as a way around a rule under
 * test — and in the two places where it is deliberately pointed AT a rule, it is to
 * prove that even the service role is refused.
 *
 * Companion to verify-db / verify-projects / verify-sources / verify-analysis, same
 * shape and the same cleanup notice.
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
const emailA = `reqwise-review-a-${stamp}@example.com`;
const emailB = `reqwise-review-b-${stamp}@example.com`;

let userA = "";
let userB = "";
let clientA: SupabaseClient;
let clientB: SupabaseClient;
let orgA = "";
let orgB = "";
let profileId = "";
let projectA = "";
let projectArchived = "";

/** The run every item in the main project belongs to; its raw output must never move. */
let runA = "";
let sourceA = "";

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

async function newProject(client: SupabaseClient, org: string, creator: string, name: string): Promise<string> {
  const { data, error } = await client
    .from("projects")
    .insert({ organization_id: org, domain_profile_id: profileId, name, created_by: creator, output_lang: "th" })
    .select("id")
    .single();
  if (error) throw new Error(`could not create project ${name}: ${error.message}`);
  return data.id;
}

async function newSource(project: string, creator: string, title: string): Promise<string> {
  const { data, error } = await admin
    .from("source_documents")
    .insert({
      project_id: project,
      title,
      kind: "meeting_notes",
      raw_text: "ลูกค้าต้องการจองห้องประชุมผ่านเว็บไซต์ และพนักงานต้องเห็นรายการจอง",
      created_by: creator,
    })
    .select("id")
    .single();
  if (error) throw new Error(`could not create source: ${error.message}`);
  return data.id as string;
}

/** A run written the way the pipeline writes one, with raw output worth protecting. */
async function newRun(project: string, source: string, creator: string): Promise<string> {
  const { data, error } = await admin
    .from("analysis_runs")
    .insert({
      project_id: project,
      source_document_id: source,
      provider: "mock",
      schema_version: "1.0.0",
      output_lang: "th",
      validation_status: "valid",
      raw_provider_output: { items: [{ local_key: "fr-1", title: "ต้องจองผ่านเว็บไซต์" }] },
      validated_output: { items: [{ local_key: "fr-1", title: "ต้องจองผ่านเว็บไซต์" }] },
      created_by: creator,
    })
    .select("id")
    .single();
  if (error) throw new Error(`could not create run: ${error.message}`);
  return data.id as string;
}

let itemSeq = 0;

/** One draft item, born the only way the schema permits. */
async function newItem(
  project: string,
  run: string,
  itemType: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  itemSeq += 1;
  const { data, error } = await admin
    .from("analysis_items")
    .insert({
      project_id: project,
      analysis_run_id: run,
      item_type: itemType,
      display_id: `TST-${String(itemSeq).padStart(3, "0")}`,
      provider_key: `verify-${itemSeq}`,
      title: `ข้อกำหนดที่ ${itemSeq}`,
      description: "Original description written by the analysis.",
      evidence_class: "stated",
      origin: "source_analysis",
      confidence: 0.9,
      ...overrides,
    })
    .select("id")
    .single();
  if (error) throw new Error(`could not create ${itemType} item: ${error.message}`);
  return data.id as string;
}

async function statusOf(client: SupabaseClient, itemId: string): Promise<string> {
  const { data } = await client.from("analysis_items").select("status").eq("id", itemId).single();
  return (data as { status: string }).status;
}

async function versionOf(client: SupabaseClient, itemId: string): Promise<number> {
  const { data } = await client.from("analysis_items").select("version_no").eq("id", itemId).single();
  return (data as { version_no: number }).version_no;
}

async function activitiesFor(client: SupabaseClient, itemId: string) {
  const { data } = await client
    .from("review_activities")
    .select("activity_type, from_status, to_status, comment, actor_id, created_at")
    .eq("item_id", itemId)
    .order("created_at", { ascending: true });
  return (data ?? []) as Array<Record<string, unknown>>;
}

/** Byte-for-byte fingerprint of the parts of a run that must never move. */
async function runFingerprint(): Promise<string> {
  const { data } = await admin
    .from("analysis_runs")
    .select("raw_provider_output, validated_output, provider, schema_version, output_lang, validation_status, created_at")
    .eq("id", runA)
    .single();
  return JSON.stringify(data);
}

async function refsFingerprint(itemId: string): Promise<string> {
  const { data } = await admin
    .from("item_source_references")
    .select("excerpt, start_offset, end_offset, evidence_strength, offset_verified")
    .eq("item_id", itemId)
    .order("start_offset", { ascending: true });
  return JSON.stringify(data);
}

/** The sanctioned edit path, as the application calls it. */
function edit(
  client: SupabaseClient,
  itemId: string,
  expectedVersion: number,
  fields: { title?: string; description?: string; priority?: string; reason?: string | null } = {},
) {
  return client.rpc("edit_analysis_item", {
    p_item_id: itemId,
    p_expected_version: expectedVersion,
    p_title: fields.title ?? "ข้อกำหนดที่แก้ไขแล้ว",
    p_description: fields.description ?? "Edited description.",
    p_priority: fields.priority ?? "high",
    p_change_reason: fields.reason ?? null,
  });
}

function review(
  client: SupabaseClient,
  itemId: string,
  activity: string,
  toStatus: string,
  comment: string | null = null,
  expectedStatus: string | null = null,
) {
  return client.rpc("review_item", {
    p_item_id: itemId,
    p_activity_type: activity,
    p_to_status: toStatus,
    p_comment: comment,
    p_expected_status: expectedStatus,
  });
}

async function main(): Promise<void> {
  console.log("\nReqWise AI — slice 5 review-workflow verification\n");

  // --- fixtures ------------------------------------------------------------
  userA = await createUser(emailA, "Reviewer A");
  userB = await createUser(emailB, "Outsider B");
  clientA = await signIn(emailA);
  clientB = await signIn(emailB);
  orgA = await personalOrg(userA);
  orgB = await personalOrg(userB);

  const { data: profile } = await admin.from("domain_profiles").select("id").limit(1).single();
  profileId = (profile as { id: string }).id;

  projectA = await newProject(clientA, orgA, userA, `Review verification ${stamp}`);
  projectArchived = await newProject(clientA, orgA, userA, `Archived verification ${stamp}`);
  await newProject(clientB, orgB, userB, `Outsider project ${stamp}`);

  sourceA = await newSource(projectA, userA, "Review verification notes");
  runA = await newRun(projectA, sourceA, userA);

  // --- 1-8: the happy path, and what it must not disturb ---------------------
  const draftItem = await newItem(projectA, runA, "functional_requirement");
  await admin.from("item_source_references").insert({
    project_id: projectA,
    item_id: draftItem,
    source_document_id: sourceA,
    excerpt: "ลูกค้าต้องการจองห้องประชุมผ่านเว็บไซต์",
    start_offset: 0,
    end_offset: 37,
    evidence_strength: 0.9,
    offset_verified: true,
  });

  const runBefore = await runFingerprint();
  const refsBefore = await refsFingerprint(draftItem);

  await check("1. a member edits their own draft requirement", async () => {
    const result = await edit(clientA, draftItem, 1, {
      title: "ระบบต้องแสดงห้องว่างแบบเรียลไทม์",
      description: "Availability must reflect confirmed reservations in real time.",
      priority: "critical",
      reason: "Clarified after the stakeholder call",
    });
    assert(!result.error, `edit failed: ${result.error?.message}`);
    return `returned version ${(result.data as { version_no: number }).version_no}`;
  });

  await check("2. title, description and priority are updated", async () => {
    const { data } = await clientA
      .from("analysis_items")
      .select("title, description, priority")
      .eq("id", draftItem)
      .single();
    const row = data as { title: string; description: string; priority: string };
    assert(row.title === "ระบบต้องแสดงห้องว่างแบบเรียลไทม์", `title is '${row.title}'`);
    assert(row.description.startsWith("Availability must reflect"), `description is '${row.description}'`);
    assert(row.priority === "critical", `priority is '${row.priority}'`);
    return "all three fields written";
  });

  await check("3. the edit wrote an item_versions snapshot", async () => {
    const { data } = await clientA
      .from("item_versions")
      .select("version_no, changed_by, change_reason")
      .eq("item_id", draftItem);
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    assert(rows.length === 1, `expected 1 version row, got ${rows.length}`);
    assert(rows[0].changed_by === userA, "the snapshot was not stamped with the acting user");
    assert(
      rows[0].change_reason === "Clarified after the stakeholder call",
      `change_reason is '${rows[0].change_reason}'`,
    );
    return "one snapshot, with its actor and reason";
  });

  await check("4. version_no advanced by exactly one", async () => {
    const version = await versionOf(clientA, draftItem);
    assert(version === 2, `expected version_no 2, got ${version}`);
    return "1 → 2";
  });

  await check("5. the snapshot holds the values from BEFORE the edit", async () => {
    const { data } = await clientA
      .from("item_versions")
      .select("snapshot")
      .eq("item_id", draftItem)
      .eq("version_no", 1)
      .single();
    const snapshot = (data as { snapshot: Record<string, unknown> }).snapshot;
    assert(snapshot.title === "ข้อกำหนดที่ 1", `snapshot title is '${snapshot.title}'`);
    assert(snapshot.priority === "unassigned", `snapshot priority is '${snapshot.priority}'`);
    assert(snapshot.status === "draft", `snapshot status is '${snapshot.status}'`);
    return "pre-edit title, priority and status all preserved";
  });

  await check("6. the analysis run's raw output is unchanged, character for character", async () => {
    const after = await runFingerprint();
    assert(after === runBefore, "the analysis run changed during an item edit");
    return `${after.length} characters identical`;
  });

  await check("7. the item's source references are unchanged", async () => {
    const after = await refsFingerprint(draftItem);
    assert(after === refsBefore, "the item's source references changed during an edit");
    return "excerpt, offsets and verification flag identical";
  });

  await check("8. editing a draft leaves it a draft", async () => {
    const status = await statusOf(clientA, draftItem);
    assert(status === "draft", `expected 'draft', got '${status}'`);
    const activities = await activitiesFor(clientA, draftItem);
    assert(activities.length === 0, `a draft edit wrote ${activities.length} review activities`);
    return "still draft, no review activity";
  });

  // --- 9-10: a review does not survive a material edit ------------------------
  await check("9. editing a needs-clarification item returns it to draft, with an activity", async () => {
    const item = await newItem(projectA, runA, "business_requirement");
    const asked = await review(clientA, item, "request_clarification", "needs_clarification", "Which branches?");
    assert(!asked.error, `request_clarification failed: ${asked.error?.message}`);

    const result = await edit(clientA, item, 1);
    assert(!result.error, `edit failed: ${result.error?.message}`);
    assert((result.data as { status_reset: boolean }).status_reset === true, "the RPC did not report a reset");

    const status = await statusOf(clientA, item);
    assert(status === "draft", `expected 'draft' after the edit, got '${status}'`);

    const activities = await activitiesFor(clientA, item);
    const reset = activities.find((a) => a.activity_type === "edit");
    assert(reset, "no 'edit' activity was recorded for the reset");
    assert(reset.from_status === "needs_clarification" && reset.to_status === "draft", "the reset activity is wrong");
    assert(String(reset.comment).includes("clarification"), `reset comment is '${reset.comment}'`);
    return `${activities.length} activities; reset recorded`;
  });

  await check("10. editing a reviewed item returns it to draft, with an activity", async () => {
    const item = await newItem(projectA, runA, "user_story");
    const marked = await review(clientA, item, "status_change", "reviewed", null, "draft");
    assert(!marked.error, `mark reviewed failed: ${marked.error?.message}`);

    const result = await edit(clientA, item, 1);
    assert(!result.error, `edit failed: ${result.error?.message}`);

    const status = await statusOf(clientA, item);
    assert(status === "draft", `expected 'draft' after the edit, got '${status}'`);

    const reset = (await activitiesFor(clientA, item)).find((a) => a.activity_type === "edit");
    assert(reset, "no 'edit' activity was recorded for the reset");
    assert(reset.from_status === "reviewed" && reset.to_status === "draft", "the reset activity is wrong");
    assert(String(reset.comment).includes("Reviewed item changed"), `reset comment is '${reset.comment}'`);
    return "reviewed → draft, audited";
  });

  // --- 11-13: what an edit may not touch -------------------------------------
  let approvedItem = "";
  await check("11. an approved requirement cannot be edited", async () => {
    approvedItem = await newItem(projectA, runA, "acceptance_criterion");
    await review(clientA, approvedItem, "status_change", "reviewed", null, "draft");
    const approved = await review(clientA, approvedItem, "approve", "approved", null, "reviewed");
    assert(!approved.error, `approve failed: ${approved.error?.message}`);

    const viaRpc = refused(await edit(clientA, approvedItem, 1), "editing an approved item through the RPC");
    const direct = refused(
      await clientA.from("analysis_items").update({ title: "forced" }).eq("id", approvedItem),
      "editing an approved item directly",
    );
    return `RPC: ${viaRpc.slice(0, 46)}… / direct: ${direct.slice(0, 46)}…`;
  });

  let rejectedItem = "";
  await check("12. a rejected requirement cannot be edited", async () => {
    rejectedItem = await newItem(projectA, runA, "constraint");
    const rejected = await review(clientA, rejectedItem, "reject", "rejected", "Out of scope for this release", "draft");
    assert(!rejected.error, `reject failed: ${rejected.error?.message}`);
    return refused(await edit(clientA, rejectedItem, 1), "editing a rejected item").slice(0, 60);
  });

  await check("13. a stale expected version is refused", async () => {
    const version = await versionOf(clientA, draftItem);
    const message = refused(await edit(clientA, draftItem, version - 1), "an edit against a stale version");
    const unchangedVersion = await versionOf(clientA, draftItem);
    assert(unchangedVersion === version, "the refused edit still advanced the version");
    return message.slice(0, 60);
  });

  // --- 14-15: who and where --------------------------------------------------
  await check("14. a non-member cannot edit another tenant's requirement", async () => {
    const viaRpc = refused(await edit(clientB, draftItem, 2), "an outsider editing through the RPC");
    const direct = await clientB.from("analysis_items").update({ title: "stolen" }).eq("id", draftItem);
    // RLS refuses by matching nothing rather than raising, so verify the row itself.
    const { data } = await admin.from("analysis_items").select("title").eq("id", draftItem).single();
    assert(
      (data as { title: string }).title !== "stolen",
      "an outsider's direct UPDATE changed the row",
    );
    assert(!direct.error || direct.error, "");
    return `RPC refused (${viaRpc.slice(0, 40)}…); direct UPDATE matched no row`;
  });

  await check("15. an archived project's requirements cannot be edited", async () => {
    const archivedSource = await newSource(projectArchived, userA, "Archived notes");
    const archivedRun = await newRun(projectArchived, archivedSource, userA);
    const archivedItem = await newItem(projectArchived, archivedRun, "functional_requirement");

    const archived = await clientA.rpc("archive_project", { p_project: projectArchived, p_reason: "verification" });
    assert(!archived.error, `archive failed: ${archived.error?.message}`);

    const viaRpc = refused(await edit(clientA, archivedItem, 1), "editing in an archived project");
    const direct = refused(
      await clientA.from("analysis_items").update({ title: "forced" }).eq("id", archivedItem),
      "a direct edit in an archived project",
    );
    // Reading it is still allowed — archiving is read-only, not invisible.
    const { data } = await clientA.from("analysis_items").select("id").eq("id", archivedItem).maybeSingle();
    assert(data, "an archived project's items became unreadable");
    return `RPC: ${viaRpc.slice(0, 34)}… / direct: ${direct.slice(0, 34)}…; still readable`;
  });

  // --- 16: the rule Phase 3A established, still true --------------------------
  await check("16. a direct status UPDATE is refused, even for the service role", async () => {
    const asUser = refused(
      await clientA.from("analysis_items").update({ status: "approved" }).eq("id", draftItem),
      "a direct status UPDATE by a member",
    );
    const asService = refused(
      await admin.from("analysis_items").update({ status: "approved" }).eq("id", draftItem),
      "a direct status UPDATE by the service role",
    );
    return `member: ${asUser.slice(0, 40)}… / service role: ${asService.slice(0, 40)}…`;
  });

  // --- 17-22: the transition table -------------------------------------------
  await check("17. draft → reviewed succeeds and is audited", async () => {
    const item = await newItem(projectA, runA, "non_functional_requirement");
    const result = await review(clientA, item, "status_change", "reviewed", null, "draft");
    assert(!result.error, `mark reviewed failed: ${result.error?.message}`);
    assert(await statusOf(clientA, item) === "reviewed", "the item is not 'reviewed'");

    const activities = await activitiesFor(clientA, item);
    assert(activities.length === 1, `expected 1 activity, got ${activities.length}`);
    assert(activities[0].actor_id === userA, "the activity was not stamped with the acting user");
    assert(activities[0].from_status === "draft" && activities[0].to_status === "reviewed", "wrong transition recorded");
    return "status and audit row both written";
  });

  await check("18. draft → needs_clarification requires a note", async () => {
    const item = await newItem(projectA, runA, "assumption");
    const without = refused(
      await review(clientA, item, "request_clarification", "needs_clarification", null, "draft"),
      "a clarification request with no note",
    );
    assert(await statusOf(clientA, item) === "draft", "the refused request still changed the status");

    const withNote = await review(clientA, item, "request_clarification", "needs_clarification", "Which branches?", "draft");
    assert(!withNote.error, `clarification with a note failed: ${withNote.error?.message}`);
    return without.slice(0, 60);
  });

  await check("19. draft → rejected requires a note", async () => {
    const item = await newItem(projectA, runA, "risk");
    // Tabs and newlines, not just spaces: Postgres `trim()` removes spaces only, so a
    // note made of a newline and a tab satisfied this rule until 20260725000017.
    const without = refused(
      await review(clientA, item, "reject", "rejected", " \n\t ", "draft"),
      "a rejection with a whitespace-only note",
    );
    assert(await statusOf(clientA, item) === "draft", "the refused rejection still changed the status");

    const withNote = await review(clientA, item, "reject", "rejected", "Duplicate of TST-002", "draft");
    assert(!withNote.error, `rejection with a note failed: ${withNote.error?.message}`);
    return without.slice(0, 60);
  });

  await check("20. reviewed → approved succeeds", async () => {
    const item = await newItem(projectA, runA, "business_objective");
    await review(clientA, item, "status_change", "reviewed", null, "draft");
    const approved = await review(clientA, item, "approve", "approved", null, "reviewed");
    assert(!approved.error, `approve failed: ${approved.error?.message}`);
    assert(await statusOf(clientA, item) === "approved", "the item is not 'approved'");

    const skipped = refused(
      await review(clientA, await newItem(projectA, runA, "business_objective"), "approve", "approved", null, "draft"),
      "approving straight from draft",
    );
    return `approved; draft → approved refused (${skipped.slice(0, 40)}…)`;
  });

  await check("21. approved → draft is refused (approved is terminal)", async () => {
    const toDraft = refused(
      await review(clientA, approvedItem, "status_change", "draft", null, "approved"),
      "approved → draft",
    );
    const toClarification = refused(
      await review(clientA, approvedItem, "request_clarification", "needs_clarification", "reopen", "approved"),
      "approved → needs_clarification",
    );
    assert(await statusOf(clientA, approvedItem) === "approved", "the item left 'approved'");
    return `both refused (${toDraft.slice(0, 34)}… / ${toClarification.slice(0, 34)}…)`;
  });

  await check("22. rejected → draft is refused (rejected is terminal)", async () => {
    const message = refused(
      await review(clientA, rejectedItem, "status_change", "draft", null, "rejected"),
      "rejected → draft",
    );
    assert(await statusOf(clientA, rejectedItem) === "rejected", "the item left 'rejected'");
    return message.slice(0, 60);
  });

  // --- 23-25: item types and archived projects the review path must refuse ----
  await check("23. an open question cannot be approved", async () => {
    const item = await newItem(projectA, runA, "open_question", { display_id: `Q-${stamp % 900}` });
    const approve = refused(await review(clientA, item, "approve", "approved", null, "draft"), "approving a question");
    const reviewed = refused(
      await review(clientA, item, "status_change", "reviewed", null, "draft"),
      "reviewing a question",
    );
    const edited = refused(await edit(clientA, item, 1), "editing a question");
    assert(await statusOf(clientA, item) === "draft", "the question changed status");
    return `approve, review and edit all refused (${approve.slice(0, 30)}… / ${reviewed.slice(0, 20)}… / ${edited.slice(0, 20)}…)`;
  });

  await check("24. a quality finding cannot be approved", async () => {
    const item = await newItem(projectA, runA, "quality_finding", { display_id: `QF-${stamp % 900}` });
    const message = refused(
      await review(clientA, item, "approve", "approved", null, "draft"),
      "approving a quality finding",
    );
    assert(await statusOf(clientA, item) === "draft", "the finding changed status");
    return message.slice(0, 60);
  });

  await check("25. an archived project's requirements cannot be reviewed", async () => {
    const { data } = await admin
      .from("analysis_items")
      .select("id")
      .eq("project_id", projectArchived)
      .limit(1)
      .single();
    const itemId = (data as { id: string }).id;
    const message = refused(
      await review(clientA, itemId, "status_change", "reviewed", null, "draft"),
      "reviewing in an archived project",
    );
    // The record stays fully readable.
    const versions = await clientA.from("item_versions").select("id").eq("item_id", itemId);
    assert(!versions.error, "an archived project's version history became unreadable");
    return message.slice(0, 60);
  });

  // --- 26: optimistic concurrency, for real ----------------------------------
  await check("26. two concurrent edits: one wins, the other is refused", async () => {
    const item = await newItem(projectA, runA, "stakeholder");
    const version = await versionOf(clientA, item);

    // Both read version 1 and both submit against it, as two browser tabs would.
    const [first, second] = await Promise.all([
      edit(clientA, item, version, { title: "แก้ไขจากแท็บที่หนึ่ง" }),
      edit(clientA, item, version, { title: "แก้ไขจากแท็บที่สอง" }),
    ]);

    const wins = [first, second].filter((r) => !r.error);
    const loses = [first, second].filter((r) => r.error);
    assert(wins.length === 1, `expected exactly 1 success, got ${wins.length}`);
    assert(loses.length === 1, `expected exactly 1 refusal, got ${loses.length}`);
    assert(
      /version conflict/i.test(loses[0].error!.message),
      `the loser failed for the wrong reason: ${loses[0].error!.message}`,
    );

    const after = await versionOf(clientA, item);
    assert(after === version + 1, `expected version ${version + 1} after one winner, got ${after}`);

    const { data } = await clientA.from("item_versions").select("id").eq("item_id", item);
    assert((data ?? []).length === 1, `expected 1 snapshot, got ${(data ?? []).length}`);
    return "one write, one version, one refusal";
  });

  // --- 27-28: the audit tables are append-only --------------------------------
  await check("27. review activities cannot be updated or deleted", async () => {
    const { data } = await admin.from("review_activities").select("id").eq("item_id", approvedItem).limit(1).single();
    const id = (data as { id: string }).id;
    const updated = refused(
      await admin.from("review_activities").update({ comment: "rewritten" }).eq("id", id),
      "rewriting a review activity",
    );
    const deleted = refused(
      await admin.from("review_activities").delete().eq("id", id),
      "deleting a review activity",
    );
    return `update: ${updated.slice(0, 34)}… / delete: ${deleted.slice(0, 34)}…`;
  });

  await check("28. item versions cannot be updated or deleted", async () => {
    const { data } = await admin.from("item_versions").select("id").eq("item_id", draftItem).limit(1).single();
    const id = (data as { id: string }).id;
    const updated = refused(
      await admin.from("item_versions").update({ change_reason: "rewritten" }).eq("id", id),
      "rewriting a version snapshot",
    );
    const deleted = refused(await admin.from("item_versions").delete().eq("id", id), "deleting a version snapshot");
    return `update: ${updated.slice(0, 34)}… / delete: ${deleted.slice(0, 34)}…`;
  });

  // --- 29-30: crossing a boundary --------------------------------------------
  await check("29. an item from another project in the same org is still addressed by its own id", async () => {
    const otherProject = await newProject(clientA, orgA, userA, `Second project ${stamp}`);
    const otherSource = await newSource(otherProject, userA, "Second project notes");
    const otherRun = await newRun(otherProject, otherSource, userA);
    const otherItem = await newItem(otherProject, otherRun, "functional_requirement");

    // The loader the page uses filters on the route's project as well as the id, so an
    // id from another project is a miss even for a member of both.
    const { data } = await clientA
      .from("analysis_items")
      .select("id")
      .eq("project_id", projectA)
      .eq("id", otherItem)
      .maybeSingle();
    assert(data === null, "an item was found under the wrong project id");

    const edited = await edit(clientA, otherItem, 1);
    assert(!edited.error, `a member could not edit their own second project: ${edited.error?.message}`);
    return "cross-project lookup is a miss; the owner can still edit it in its own project";
  });

  await check("30. a cross-organization action is refused", async () => {
    const outsiderEdit = refused(await edit(clientB, draftItem, 2), "an outsider's edit");
    const outsiderReview = refused(
      await review(clientB, draftItem, "approve", "approved", null, "draft"),
      "an outsider's approval",
    );
    const outsiderRead = await clientB.from("analysis_items").select("id").eq("id", draftItem).maybeSingle();
    assert(outsiderRead.data === null, "an outsider could read another tenant's item");
    assert(
      /not found|not visible/i.test(outsiderEdit),
      `the refusal leaked more than 'not found': ${outsiderEdit}`,
    );
    return `edit: ${outsiderEdit.slice(0, 30)}… / review: ${outsiderReview.slice(0, 30)}… / read: null`;
  });
}

function cleanupNotice(): void {
  if (!projectA && !userA) return;
  console.log(
    "\nVerification rows remain — analysis runs, versions and activities are immutable/append-only by design.\n" +
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
