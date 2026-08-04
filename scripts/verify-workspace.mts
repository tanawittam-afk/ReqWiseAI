/**
 * Phase 5 runtime verification — the workspace-wide queries, against a real Postgres.
 *
 *   npm run verify:workspace      (needs .env.local pointing at a Supabase project)
 *
 * The question this script exists to answer is the one the UX/UI plan named as Phase
 * 5's risk: **cross-project queries are a new query shape, so RLS must be re-proven,
 * not assumed.** Every per-project query in this app is scoped by an id in the URL as
 * well as by policy; these four are scoped by policy alone. If `is_project_member()`
 * were ever wrong, this is the first place it would show.
 *
 * So the shape is: build a complete fixture for user **A** — an active project, an
 * archived one, items in every state the four buckets care about, a pending change
 * request and a review activity — then run the *real, shipped* functions from
 * `lib/workspace/queries.ts` twice: once on A's own client (they must see exactly their
 * own rows, and the derived counts must be exactly right) and once on **B**'s (they
 * must see **zero** of A's, on every one of the four).
 *
 * The service role appears only to build fixtures. Every assertion runs on an
 * authenticated user's own client, because that is the client the application uses and
 * therefore the only one whose behaviour is worth measuring.
 *
 * Companion to verify-db / projects / sources / analysis / review / workflow /
 * traceability / export / change-requests, same shape.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  getWorkspaceTotals,
  listPendingChangeRequests,
  listRecentActivity,
  listWorkspaceItems,
} from "../lib/workspace/queries.ts";
import {
  outstandingCounts,
  partitionOutstanding,
  totalOutstanding,
} from "../lib/workspace/outstanding.ts";

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

const stamp = Date.now();
const password = `Verify!${stamp}`;
const emailA = `reqwise-ws-a-${stamp}@example.com`;
const emailB = `reqwise-ws-b-${stamp}@example.com`;

/**
 * Project-name prefixes. **Both `scripts/verify-db-cleanup.sql` and its dry-run must
 * recognise these**, or the dry-run's `unknown` bucket stops being empty — and that
 * bucket's emptiness is the thing that proves every row in the project is accounted
 * for.
 */
const ACTIVE_NAME = `Workspace verification ${stamp}`;
const ARCHIVED_NAME = `Archived workspace project ${stamp}`;
const OUTSIDER_NAME = `Outsider workspace project ${stamp}`;

let userA = "";
let userB = "";
let clientA: SupabaseClient;
let clientB: SupabaseClient;
let profileId = "";
let projectActive = "";
let projectArchived = "";
let projectOutsider = "";
let approvedItem = "";

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

async function newProject(org: string, creator: string, name: string): Promise<string> {
  const { data, error } = await admin
    .from("projects")
    .insert({
      organization_id: org,
      domain_profile_id: profileId,
      name,
      created_by: creator,
      output_lang: "th",
    })
    .select("id")
    .single();
  if (error) throw new Error(`could not create project ${name}: ${error.message}`);
  return data.id as string;
}

async function newSource(project: string, creator: string): Promise<string> {
  const { data, error } = await admin
    .from("source_documents")
    .insert({
      project_id: project,
      title: "บันทึกการประชุม",
      kind: "meeting_notes",
      raw_text: "ลูกค้าอยากจองเองจากมือถือ ยังไม่สรุปเรื่องการคืนเงิน",
      created_by: creator,
    })
    .select("id")
    .single();
  if (error) throw new Error(`could not create source: ${error.message}`);
  return data.id as string;
}

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
      raw_provider_output: { items: [] },
      validated_output: { items: [] },
      created_by: creator,
    })
    .select("id")
    .single();
  if (error) throw new Error(`could not create run: ${error.message}`);
  return data.id as string;
}

let itemSeq = 0;

async function newItem(
  project: string,
  run: string,
  itemType: string,
  prefix: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  itemSeq += 1;
  const { data, error } = await admin
    .from("analysis_items")
    .insert({
      project_id: project,
      analysis_run_id: run,
      item_type: itemType,
      display_id: `${prefix}-${String(900 + itemSeq)}`,
      provider_key: `verify-ws-${itemSeq}`,
      title: `รายการที่ ${itemSeq}`,
      description: "Written by the verification script.",
      evidence_class: "stated",
      origin: "source_analysis",
      confidence: 0.7,
      ...overrides,
    })
    .select("id")
    .single();
  if (error) throw new Error(`could not create ${itemType}: ${error.message}`);
  return data.id as string;
}

/**
 * Move an item's review status the way the application does.
 *
 * Not an `UPDATE`: the database refuses to create or write any status other than
 * `draft` outside this RPC — "AI-generated requirements always start as Draft" is a
 * rule, not a convention, and the service role is refused too. Going through
 * `review_item` also means each transition writes a real `review_activities` row, which
 * is exactly what `listRecentActivity` is being tested against.
 */
async function review(
  client: SupabaseClient,
  itemId: string,
  activityType: string,
  toStatus: string,
  expectedStatus: string,
  comment: string | null = null,
): Promise<void> {
  const { error } = await client.rpc("review_item", {
    p_item_id: itemId,
    p_activity_type: activityType,
    p_to_status: toStatus,
    p_comment: comment,
    p_expected_status: expectedStatus,
  });
  if (error) throw new Error(`review_item → ${toStatus} failed: ${error.message}`);
}

async function answerQuestion(client: SupabaseClient, itemId: string): Promise<void> {
  const { error } = await client.rpc("resolve_open_question", {
    p_item_id: itemId,
    p_expected_state: "open",
    p_to_state: "answered",
    p_answer: "คำตอบจากผู้มีส่วนได้ส่วนเสีย",
    p_follow_up_on: null,
  });
  if (error) throw new Error(`resolve_open_question failed: ${error.message}`);
}

async function moveFinding(
  client: SupabaseClient,
  itemId: string,
  expected: string,
  to: string,
): Promise<void> {
  const { error } = await client.rpc("update_quality_finding", {
    p_item_id: itemId,
    p_expected_state: expected,
    p_to_state: to,
    p_note: to === "resolved" ? "แก้ไขข้อความให้ทดสอบได้แล้ว" : null,
  });
  if (error) throw new Error(`update_quality_finding → ${to} failed: ${error.message}`);
}

async function main(): Promise<void> {
  const { data: profile } = await admin
    .from("domain_profiles")
    .select("id")
    .eq("key", "booking_smart_space")
    .single();
  profileId = (profile as { id: string }).id;

  userA = await createUser(emailA, "Workspace A");
  userB = await createUser(emailB, "Workspace B");
  clientA = await signIn(emailA);
  clientB = await signIn(emailB);

  const orgA = await personalOrg(userA);
  const orgB = await personalOrg(userB);

  // --- A's fixture -------------------------------------------------------
  projectActive = await newProject(orgA, userA, ACTIVE_NAME);
  const sourceActive = await newSource(projectActive, userA);
  const runActive = await newRun(projectActive, sourceActive, userA);

  // Every item is born `draft` — the database refuses anything else, for anyone. The
  // states below are reached through the same RPCs the application calls.
  await newItem(projectActive, runActive, "business_requirement", "BR");
  const clarifyItem = await newItem(projectActive, runActive, "functional_requirement", "FR");
  const reviewedItem = await newItem(projectActive, runActive, "business_requirement", "BR");
  approvedItem = await newItem(projectActive, runActive, "business_requirement", "BR");
  const rejectedItem = await newItem(projectActive, runActive, "business_requirement", "BR");

  // Two that must count as awaiting review (draft, needs_clarification) …
  await review(
    clientA,
    clarifyItem,
    "request_clarification",
    "needs_clarification",
    "draft",
    "ยังไม่ชัดว่าใครเป็นผู้อนุมัติ",
  );
  // … and three that must not.
  await review(clientA, reviewedItem, "status_change", "reviewed", "draft");
  await review(clientA, approvedItem, "status_change", "reviewed", "draft");
  await review(clientA, approvedItem, "approve", "approved", "reviewed");
  await review(clientA, rejectedItem, "reject", "rejected", "draft", "ไม่อยู่ในขอบเขต");

  // One unanswered question; one answered, which must not count.
  await newItem(projectActive, runActive, "open_question", "Q", { workflow_state: "open" });
  const answeredQuestion = await newItem(projectActive, runActive, "open_question", "Q", {
    workflow_state: "open",
  });
  await answerQuestion(clientA, answeredQuestion);

  // One open finding and one acknowledged — both count. One resolved — does not.
  await newItem(projectActive, runActive, "quality_finding", "QF", { workflow_state: "open" });
  const acknowledgedFinding = await newItem(projectActive, runActive, "quality_finding", "QF", {
    workflow_state: "open",
  });
  await moveFinding(clientA, acknowledgedFinding, "open", "acknowledged");
  const resolvedFinding = await newItem(projectActive, runActive, "quality_finding", "QF", {
    workflow_state: "open",
  });
  await moveFinding(clientA, resolvedFinding, "open", "acknowledged");
  await moveFinding(clientA, resolvedFinding, "acknowledged", "resolved");

  // A soft-deleted item, which must appear in no list and in no count.
  await newItem(projectActive, runActive, "business_requirement", "BR", {
    deleted_at: new Date().toISOString(),
  });

  // An archived project with a draft item — visible in the list, never outstanding.
  projectArchived = await newProject(orgA, userA, ARCHIVED_NAME);
  const sourceArchived = await newSource(projectArchived, userA);
  const runArchived = await newRun(projectArchived, sourceArchived, userA);
  await newItem(projectArchived, runArchived, "business_requirement", "BR");
  // Through the RPC, not an `UPDATE`. A direct write of `status` is refused — archiving
  // is a lifecycle transition with its own audit, and the service role is not exempt.
  // (A silent no-op here is exactly what made this script's first run report the
  // archived project as active, so the result is checked rather than assumed.)
  const { error: archiveError } = await clientA.rpc("archive_project", {
    p_project: projectArchived,
    p_reason: "verification fixture",
  });
  if (archiveError) throw new Error(`could not archive project: ${archiveError.message}`);

  const { data: archivedRow } = await admin
    .from("projects")
    .select("status")
    .eq("id", projectArchived)
    .single();
  if ((archivedRow as { status: string } | null)?.status !== "archived") {
    throw new Error("archive_project did not archive the fixture project");
  }

  // A pending change request against the now-genuinely-approved item, opened through
  // the same RPC the inspector calls — `open_change_request` refuses anything not
  // already terminal, so this also proves the fixture reached `approved` for real.
  const { error: crError } = await clientA.rpc("open_change_request", {
    p_target_item_id: approvedItem,
    p_proposed_title: "ข้อความที่เสนอแก้",
    p_proposed_description: "รายละเอียดที่เสนอแก้",
    p_proposed_priority: "high",
    p_reason: "คำตอบจากผู้มีส่วนได้เสียขัดกับข้อความที่อนุมัติไปแล้ว",
    p_source_question_id: null,
  });
  if (crError) throw new Error(`could not open change request: ${crError.message}`);

  // --- B's own project, so "sees nothing" cannot be true trivially ------
  projectOutsider = await newProject(orgB, userB, OUTSIDER_NAME);
  const sourceOutsider = await newSource(projectOutsider, userB);
  const runOutsider = await newRun(projectOutsider, sourceOutsider, userB);
  await newItem(projectOutsider, runOutsider, "business_requirement", "BR");

  console.log("\nA sees their own rows, and the counts are exactly right");

  await check("listWorkspaceItems returns A's items and no other tenant's", async () => {
    const { items, truncated } = await listWorkspaceItems(clientA);
    const mine = items.filter((item) =>
      [projectActive, projectArchived].includes(item.project.id),
    );
    assert(mine.length === 11, `expected 11 of A's items, saw ${mine.length}`);
    assert(
      items.every((item) => item.project.id !== projectOutsider),
      "A can see B's project's items",
    );
    assert(!truncated, "the fixture should be nowhere near the ceiling");
    return `${mine.length} items, soft-deleted one excluded`;
  });

  await check("the soft-deleted item is in no list", async () => {
    const { items } = await listWorkspaceItems(clientA);
    const active = items.filter((item) => item.project.id === projectActive);
    assert(active.length === 10, `expected 10 live items in the active project, saw ${active.length}`);
    return "deleted_at is honoured";
  });

  await check("the four outstanding buckets are exactly right", async () => {
    const { items } = await listWorkspaceItems(clientA);
    const mine = items.filter((item) =>
      [projectActive, projectArchived].includes(item.project.id),
    );
    const crs = (await listPendingChangeRequests(clientA)).filter(
      (row) => row.project.id === projectActive,
    );
    const counts = outstandingCounts(partitionOutstanding(mine, crs));

    assert(counts.awaiting_review === 2, `awaiting_review ${counts.awaiting_review}, expected 2`);
    assert(
      counts.unanswered_questions === 1,
      `unanswered_questions ${counts.unanswered_questions}, expected 1`,
    );
    assert(counts.open_findings === 2, `open_findings ${counts.open_findings}, expected 2`);
    assert(
      counts.pending_change_requests === 1,
      `pending_change_requests ${counts.pending_change_requests}, expected 1`,
    );
    return `total ${totalOutstanding(counts)}`;
  });

  await check("the archived project's draft is visible but never outstanding", async () => {
    const { items } = await listWorkspaceItems(clientA);
    const archived = items.filter((item) => item.project.id === projectArchived);
    assert(archived.length === 1, `expected 1 archived-project item, saw ${archived.length}`);
    assert(archived[0].status === "draft", "the archived fixture item should be a draft");
    assert(archived[0].project.status === "archived", "project status did not come through");

    const work = partitionOutstanding(archived, []);
    assert(
      work.awaitingReview.length === 0,
      "an archived project's draft was counted as work — nobody may act on it",
    );
    return "read-only, so not work";
  });

  await check("listPendingChangeRequests resolves its target through RLS", async () => {
    const rows = (await listPendingChangeRequests(clientA)).filter(
      (row) => row.project.id === projectActive,
    );
    assert(rows.length === 1, `expected 1 pending change request, saw ${rows.length}`);
    assert(rows[0].targetItemId === approvedItem, "the target item id did not round-trip");
    assert(rows[0].targetDisplayId.startsWith("BR-"), "the target's display id is missing");
    assert(rows[0].project.name === ACTIVE_NAME, "the project name did not come through");
    return rows[0].targetDisplayId;
  });

  await check("listRecentActivity names the item, and never a person", async () => {
    const rows = (await listRecentActivity(clientA, 50)).filter(
      (row) => row.project.id === projectActive,
    );
    // Every transition above wrote one row; the exact number is the RPCs' business,
    // so this asserts the ones that must be there rather than a total that would
    // break the next time a workflow gains a step.
    assert(rows.length >= 5, `expected the review transitions to be recorded, saw ${rows.length}`);
    const approval = rows.find(
      (row) => row.itemId === approvedItem && row.toStatus === "approved",
    );
    assert(approval, "the approval is missing from the feed");
    assert(approval.itemDisplayId.startsWith("BR-"), "the item's display id is missing");
    assert(approval.project.name === ACTIVE_NAME, "the project name did not come through");
    // The row type has no actor field at all — this asserts the shape, not a value.
    assert(
      !Object.prototype.hasOwnProperty.call(approval, "actorId"),
      "the activity row carries an actor — profiles is RLS-scoped and must not be widened for a caption",
    );
    return `${rows.length} activities, no actor field`;
  });

  await check("getWorkspaceTotals counts only A's rows", async () => {
    const totals = await getWorkspaceTotals(clientA);
    assert(totals.activeProjects === 1, `activeProjects ${totals.activeProjects}, expected 1`);
    assert(totals.archivedProjects === 1, `archivedProjects ${totals.archivedProjects}, expected 1`);
    assert(totals.sources === 2, `sources ${totals.sources}, expected 2`);
    assert(totals.analysisRuns === 2, `analysisRuns ${totals.analysisRuns}, expected 2`);
    assert(totals.items === 11, `items ${totals.items}, expected 11 (soft-deleted excluded)`);
    return `${totals.items} items across ${totals.activeProjects + totals.archivedProjects} projects`;
  });

  console.log("\nB sees none of it — the check this script exists for");

  await check("listWorkspaceItems shows B zero of A's items", async () => {
    const { items } = await listWorkspaceItems(clientB);
    const leaked = items.filter((item) =>
      [projectActive, projectArchived].includes(item.project.id),
    );
    assert(leaked.length === 0, `B can see ${leaked.length} of A's items`);
    const own = items.filter((item) => item.project.id === projectOutsider);
    assert(own.length === 1, `B should still see their own item, saw ${own.length}`);
    return "B sees only their own";
  });

  await check("listPendingChangeRequests shows B zero of A's", async () => {
    const rows = await listPendingChangeRequests(clientB);
    const leaked = rows.filter((row) => row.project.id === projectActive);
    assert(leaked.length === 0, `B can see ${leaked.length} of A's change requests`);
    return "none";
  });

  await check("listRecentActivity shows B zero of A's", async () => {
    const rows = await listRecentActivity(clientB, 50);
    const leaked = rows.filter((row) => row.project.id === projectActive);
    assert(leaked.length === 0, `B can see ${leaked.length} of A's activities`);
    return "none";
  });

  await check("getWorkspaceTotals counts none of A's rows for B", async () => {
    const totals = await getWorkspaceTotals(clientB);
    assert(totals.activeProjects === 1, `B's activeProjects ${totals.activeProjects}, expected 1`);
    assert(totals.archivedProjects === 0, `B's archivedProjects ${totals.archivedProjects}, expected 0`);
    assert(totals.sources === 1, `B's sources ${totals.sources}, expected 1`);
    assert(totals.analysisRuns === 1, `B's analysisRuns ${totals.analysisRuns}, expected 1`);
    assert(totals.items === 1, `B's items ${totals.items}, expected 1`);
    return "B's totals describe only B's workspace";
  });

  await check("B's outstanding work is derived from B's rows alone", async () => {
    const { items } = await listWorkspaceItems(clientB);
    const crs = await listPendingChangeRequests(clientB);
    const counts = outstandingCounts(partitionOutstanding(items, crs));
    assert(counts.awaiting_review === 1, `B's awaiting_review ${counts.awaiting_review}, expected 1`);
    assert(counts.pending_change_requests === 0, "B inherited A's pending change request");
    return `B has ${totalOutstanding(counts)} outstanding, all their own`;
  });
}

function cleanupNotice(): void {
  if (!projectActive && !userA) return;
  console.log(
    "\nVerification rows remain — analysis runs and activities are immutable/append-only by design.\n" +
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
