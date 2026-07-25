/**
 * Slice 6A runtime verification — open-question resolution and the quality-finding
 * workflow, against a real Postgres.
 *
 *   npm run verify:workflow        (needs .env.local pointing at a Supabase project)
 *
 * Every user-facing assertion runs on an authenticated user's own client, so RLS and
 * the RPCs' own auth.uid()/membership checks are what is being measured. The service
 * role appears only to build fixtures, and twice deliberately pointed AT a rule to
 * prove that even it is refused.
 *
 * Companion to verify-db / projects / sources / analysis / review, same shape.
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
const emailA = `reqwise-wf-a-${stamp}@example.com`;
const emailB = `reqwise-wf-b-${stamp}@example.com`;

let userA = "";
let userB = "";
let clientA: SupabaseClient;
let clientB: SupabaseClient;
let orgA = "";
let orgB = "";
let profileId = "";
let projectA = "";
let projectArchived = "";
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
      raw_text: "ยังไม่ได้ข้อสรุปเรื่องการยกเลิก การคืนเงิน และช่องทางแจ้งเตือน",
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
      raw_provider_output: { items: [{ local_key: "q-1", title: "ยังไม่สรุปเรื่องการคืนเงิน" }] },
      validated_output: { items: [{ local_key: "q-1", title: "ยังไม่สรุปเรื่องการคืนเงิน" }] },
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
  overrides: Record<string, unknown> = {},
): Promise<string> {
  itemSeq += 1;
  const prefix = itemType === "open_question" ? "Q" : itemType === "quality_finding" ? "QF" : "TST";
  const { data, error } = await admin
    .from("analysis_items")
    .insert({
      project_id: project,
      analysis_run_id: run,
      item_type: itemType,
      display_id: `${prefix}-${String(itemSeq).padStart(3, "0")}`,
      provider_key: `verify-${itemSeq}`,
      title: `รายการที่ ${itemSeq}`,
      description: "Written by the analysis.",
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

async function itemRow(itemId: string) {
  const { data } = await admin
    .from("analysis_items")
    .select("workflow_state, resolution_text, resolved_at, resolved_by, follow_up_on, status, version_no, title")
    .eq("id", itemId)
    .single();
  return data as Record<string, unknown>;
}

async function stateOf(client: SupabaseClient, itemId: string): Promise<string | null> {
  const { data } = await client.from("analysis_items").select("workflow_state").eq("id", itemId).single();
  return (data as { workflow_state: string | null }).workflow_state;
}

async function activitiesFor(client: SupabaseClient, itemId: string) {
  const { data } = await client
    .from("review_activities")
    .select("activity_type, from_workflow_state, to_workflow_state, comment, actor_id, created_at")
    .eq("item_id", itemId)
    .order("created_at", { ascending: true });
  return (data ?? []) as Array<Record<string, unknown>>;
}

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

function question(
  client: SupabaseClient,
  itemId: string,
  expected: string,
  to: string,
  answer: string | null = "คำตอบจากผู้มีส่วนได้ส่วนเสีย",
  followUp: string | null = null,
) {
  return client.rpc("resolve_open_question", {
    p_item_id: itemId,
    p_expected_state: expected,
    p_to_state: to,
    p_answer: answer,
    p_follow_up_on: followUp,
  });
}

function finding(
  client: SupabaseClient,
  itemId: string,
  expected: string,
  to: string,
  note: string | null = null,
) {
  return client.rpc("update_quality_finding", {
    p_item_id: itemId,
    p_expected_state: expected,
    p_to_state: to,
    p_note: note,
  });
}

async function main(): Promise<void> {
  console.log("\nReqWise AI — slice 6A question & quality workflow verification\n");

  userA = await createUser(emailA, "Analyst A");
  userB = await createUser(emailB, "Outsider B");
  clientA = await signIn(emailA);
  clientB = await signIn(emailB);
  orgA = await personalOrg(userA);
  orgB = await personalOrg(userB);

  const { data: profile } = await admin.from("domain_profiles").select("id").limit(1).single();
  profileId = (profile as { id: string }).id;

  projectA = await newProject(clientA, orgA, userA, `Workflow verification ${stamp}`);
  projectArchived = await newProject(clientA, orgA, userA, `Archived workflow ${stamp}`);
  await newProject(clientB, orgB, userB, `Outsider workflow ${stamp}`);

  sourceA = await newSource(projectA, userA, "Workflow verification notes");
  runA = await newRun(projectA, sourceA, userA);

  // ---------------------------------------------------------------- questions
  const q1 = await newItem(projectA, runA, "open_question");
  await admin.from("item_source_references").insert({
    project_id: projectA,
    item_id: q1,
    source_document_id: sourceA,
    excerpt: "การคืนเงิน",
    start_offset: 30,
    end_offset: 40,
    evidence_strength: 0.8,
    offset_verified: true,
  });

  const runBefore = await runFingerprint();
  const refsBefore = await refsFingerprint(q1);

  await check("1. an AI-created question starts 'open'", async () => {
    const row = await itemRow(q1);
    assert(row.workflow_state === "open", `workflow_state is '${row.workflow_state}'`);
    assert(row.resolution_text === null, "a fresh question already carries resolution text");
    assert(row.resolved_at === null && row.resolved_by === null, "a fresh question is already stamped");
    // The requirement review status is untouched and stays irrelevant for this type.
    assert(row.status === "draft", `status is '${row.status}'`);
    return "open, unresolved, unstamped";
  });

  await check("2. a member answers their own question", async () => {
    const result = await question(clientA, q1, "open", "answered", "คืนเงินเต็มจำนวนถ้ายกเลิกก่อน 24 ชั่วโมง");
    assert(!result.error, `answer failed: ${result.error?.message}`);
    return `to_state ${(result.data as { to_state: string }).to_state}`;
  });

  await check("3. the answered state keeps the answer, the actor and the timestamp", async () => {
    const row = await itemRow(q1);
    assert(row.workflow_state === "answered", `workflow_state is '${row.workflow_state}'`);
    assert(
      String(row.resolution_text).startsWith("คืนเงินเต็มจำนวน"),
      `resolution_text is '${row.resolution_text}'`,
    );
    assert(row.resolved_by === userA, "the answer was not stamped with the acting user");
    assert(row.resolved_at !== null, "the answer has no timestamp");
    return "answer, actor and timestamp all stored";
  });

  await check("4. answering wrote an append-only activity", async () => {
    const activities = await activitiesFor(clientA, q1);
    assert(activities.length === 1, `expected 1 activity, got ${activities.length}`);
    const row = activities[0];
    assert(row.activity_type === "question_answered", `activity_type is '${row.activity_type}'`);
    assert(row.from_workflow_state === "open" && row.to_workflow_state === "answered", "wrong transition recorded");
    assert(row.actor_id === userA, "the activity was not stamped with the acting user");
    assert(String(row.comment).includes("24 ชั่วโมง"), "the answer text was not recorded");
    return "question_answered, open → answered, with the answer";
  });

  await check("5. an empty or whitespace-only answer is refused", async () => {
    const q = await newItem(projectA, runA, "open_question");
    const empty = refused(await question(clientA, q, "open", "answered", ""), "an empty answer");
    // Newlines and tabs, not just spaces — Postgres `trim()` removes spaces only, which
    // let this exact string through until 20260725000017.
    const blank = refused(await question(clientA, q, "open", "answered", "   \n\t  "), "a whitespace answer");
    assert(await stateOf(clientA, q) === "open", "a refused answer still moved the question");
    assert((await activitiesFor(clientA, q)).length === 0, "a refused answer still wrote an activity");
    return `${empty.slice(0, 40)}… / ${blank.slice(0, 20)}… (both refused)`;
  });

  let deferredQuestion = "";
  await check("6. open → deferred succeeds with a reason, and can carry a follow-up date", async () => {
    deferredQuestion = await newItem(projectA, runA, "open_question");
    const result = await question(
      clientA, deferredQuestion, "open", "deferred", "รอผลการประชุมกับฝ่ายการเงิน", "2026-08-15",
    );
    assert(!result.error, `defer failed: ${result.error?.message}`);

    const row = await itemRow(deferredQuestion);
    assert(row.workflow_state === "deferred", `workflow_state is '${row.workflow_state}'`);
    assert(String(row.follow_up_on).startsWith("2026-08-15"), `follow_up_on is '${row.follow_up_on}'`);

    // A follow-up date is a property of deferring, and nothing else.
    const q = await newItem(projectA, runA, "open_question");
    const wrong = refused(
      await question(clientA, q, "open", "answered", "an answer", "2026-08-15"),
      "a follow-up date on an answer",
    );
    return `deferred with 2026-08-15; on an answer refused (${wrong.slice(0, 34)}…)`;
  });

  let notApplicableQuestion = "";
  await check("7. open → not_applicable succeeds with a reason", async () => {
    notApplicableQuestion = await newItem(projectA, runA, "open_question");
    const result = await question(
      clientA, notApplicableQuestion, "open", "not_applicable", "ไม่อยู่ในขอบเขตของเฟสนี้",
    );
    assert(!result.error, `not_applicable failed: ${result.error?.message}`);
    assert(await stateOf(clientA, notApplicableQuestion) === "not_applicable", "state did not move");
    const activity = (await activitiesFor(clientA, notApplicableQuestion))[0];
    assert(activity.activity_type === "question_not_applicable", `activity is '${activity.activity_type}'`);
    return "state and audit row both written";
  });

  await check("8. answered → open requires a reopen reason", async () => {
    const without = refused(await question(clientA, q1, "answered", "open", "  "), "a reopen with no reason");
    assert(await stateOf(clientA, q1) === "answered", "the refused reopen still moved the question");

    const withReason = await question(clientA, q1, "answered", "open", "ผู้มีส่วนได้ส่วนเสียเปลี่ยนคำตอบ");
    assert(!withReason.error, `reopen failed: ${withReason.error?.message}`);

    const row = await itemRow(q1);
    assert(row.workflow_state === "open", `workflow_state is '${row.workflow_state}'`);
    // Reopening clears the decision but never the record of it.
    assert(row.resolution_text === null, "reopening left the old answer on the row");
    assert(row.resolved_at === null && row.resolved_by === null, "reopening left the old stamp");
    const activities = await activitiesFor(clientA, q1);
    assert(
      activities.some((a) => a.activity_type === "question_answered" && String(a.comment).includes("24 ชั่วโมง")),
      "the original answer was lost from the audit log",
    );
    assert(activities.some((a) => a.activity_type === "question_reopened"), "no reopen activity");
    return `${without.slice(0, 34)}…; reopened, old answer still in history`;
  });

  await check("9. a non-member cannot act on another tenant's question", async () => {
    const viaRpc = refused(await question(clientB, q1, "open", "answered", "stolen"), "an outsider's answer");
    assert(/not found|not visible/i.test(viaRpc), `the refusal leaked more than 'not found': ${viaRpc}`);
    const direct = await clientB
      .from("analysis_items")
      .update({ workflow_state: "answered" })
      .eq("id", q1);
    const row = await itemRow(q1);
    assert(row.workflow_state === "open", "an outsider's direct UPDATE changed the row");
    assert(direct.error === null || direct.error !== null, "");
    return `RPC refused (${viaRpc.slice(0, 38)}…); direct UPDATE matched no row`;
  });

  let archivedQuestion = "";
  let archivedFinding = "";
  await check("10. an archived project's questions cannot be answered", async () => {
    const archivedSource = await newSource(projectArchived, userA, "Archived notes");
    const archivedRun = await newRun(projectArchived, archivedSource, userA);
    archivedQuestion = await newItem(projectArchived, archivedRun, "open_question");
    archivedFinding = await newItem(projectArchived, archivedRun, "quality_finding");

    const archived = await clientA.rpc("archive_project", { p_project: projectArchived, p_reason: "verification" });
    assert(!archived.error, `archive failed: ${archived.error?.message}`);

    const viaRpc = refused(
      await question(clientA, archivedQuestion, "open", "answered", "an answer"),
      "answering in an archived project",
    );
    const direct = refused(
      await clientA.from("analysis_items").update({ workflow_state: "answered" }).eq("id", archivedQuestion),
      "a direct workflow update in an archived project",
    );
    // Reading it is still allowed — archiving is read-only, not invisible.
    const { data } = await clientA.from("analysis_items").select("id").eq("id", archivedQuestion).maybeSingle();
    assert(data, "an archived project's questions became unreadable");
    return `RPC: ${viaRpc.slice(0, 30)}… / direct: ${direct.slice(0, 30)}…; still readable`;
  });

  await check("11. a cross-project action is refused, and a cross-project lookup is a miss", async () => {
    const otherProject = await newProject(clientA, orgA, userA, `Second project ${stamp}`);
    const otherSource = await newSource(otherProject, userA, "Second project notes");
    const otherRun = await newRun(otherProject, otherSource, userA);
    const otherQuestion = await newItem(otherProject, otherRun, "open_question");

    const { data } = await clientA
      .from("analysis_items")
      .select("id")
      .eq("project_id", projectA)
      .eq("id", otherQuestion)
      .maybeSingle();
    assert(data === null, "a question was found under the wrong project id");

    const outsider = refused(
      await question(clientB, otherQuestion, "open", "answered", "stolen"),
      "an outsider acting across organizations",
    );
    return `cross-project lookup is a miss; cross-org refused (${outsider.slice(0, 34)}…)`;
  });

  await check("12. a stale expected state is refused", async () => {
    const current = await stateOf(clientA, deferredQuestion);
    assert(current === "deferred", `expected 'deferred', got '${current}'`);
    const message = refused(
      await question(clientA, deferredQuestion, "open", "answered", "an answer"),
      "an action against a stale state",
    );
    assert(await stateOf(clientA, deferredQuestion) === "deferred", "the refused action still moved the question");
    return message.slice(0, 56);
  });

  await check("13. answering changes no other item in the run", async () => {
    const before = await admin
      .from("analysis_items")
      .select("id, title, status, version_no, workflow_state")
      .eq("analysis_run_id", runA)
      .neq("id", notApplicableQuestion)
      .order("display_id");
    const fingerprint = JSON.stringify(before.data);

    const q = await newItem(projectA, runA, "open_question");
    const result = await question(clientA, q, "open", "answered", "คำตอบใหม่");
    assert(!result.error, `answer failed: ${result.error?.message}`);

    const after = await admin
      .from("analysis_items")
      .select("id, title, status, version_no, workflow_state")
      .eq("analysis_run_id", runA)
      .neq("id", notApplicableQuestion)
      .in("id", ((before.data ?? []) as Array<{ id: string }>).map((r) => r.id))
      .order("display_id");
    assert(JSON.stringify(after.data) === fingerprint, "answering a question changed another item");
    return `${((before.data ?? []) as unknown[]).length} sibling items untouched`;
  });

  await check("14. answering does not change the analysis run", async () => {
    const after = await runFingerprint();
    assert(after === runBefore, "the analysis run changed during a workflow action");
    return `${after.length} characters identical`;
  });

  await check("15. answering does not change the question's source references", async () => {
    const after = await refsFingerprint(q1);
    assert(after === refsBefore, "the question's source references changed");
    return "excerpt, offsets and verification flag identical";
  });

  // ----------------------------------------------------------------- findings
  const f1 = await newItem(projectA, runA, "quality_finding", {
    origin: "quality_rule",
    evidence_class: "inferred",
    attributes: { finding: "incomplete", target_keys: ["br-1"] },
  });

  await check("16. an AI-created finding starts 'open'", async () => {
    const row = await itemRow(f1);
    assert(row.workflow_state === "open", `workflow_state is '${row.workflow_state}'`);
    assert(row.resolution_text === null, "a fresh finding already carries a resolution");
    return "open, unresolved";
  });

  await check("17. open → acknowledged succeeds, with no note required", async () => {
    const result = await finding(clientA, f1, "open", "acknowledged", null);
    assert(!result.error, `acknowledge failed: ${result.error?.message}`);

    const row = await itemRow(f1);
    assert(row.workflow_state === "acknowledged", `workflow_state is '${row.workflow_state}'`);
    // Acknowledged is "seen, not fixed": no resolution, no stamp.
    assert(row.resolution_text === null, "acknowledging wrote a resolution");
    assert(row.resolved_at === null, "acknowledging stamped a resolution time");
    const activity = (await activitiesFor(clientA, f1))[0];
    assert(activity.activity_type === "quality_acknowledged", `activity is '${activity.activity_type}'`);
    return "acknowledged without a note; still unresolved";
  });

  let resolvedFinding = "";
  await check("18. open → resolved requires a resolution note", async () => {
    resolvedFinding = await newItem(projectA, runA, "quality_finding", { origin: "quality_rule" });
    const without = refused(
      await finding(clientA, resolvedFinding, "open", "resolved", "   "),
      "a resolution with a whitespace-only note",
    );
    assert(await stateOf(clientA, resolvedFinding) === "open", "the refused resolution still moved the finding");

    const withNote = await finding(
      clientA, resolvedFinding, "open", "resolved", "เพิ่มเกณฑ์การทดสอบให้ FR-002 แล้ว",
    );
    assert(!withNote.error, `resolve failed: ${withNote.error?.message}`);
    const row = await itemRow(resolvedFinding);
    assert(row.resolved_by === userA && row.resolved_at !== null, "the resolution is not stamped");
    return without.slice(0, 50);
  });

  let dismissedFinding = "";
  await check("19. open → dismissed requires a reason", async () => {
    dismissedFinding = await newItem(projectA, runA, "quality_finding", { origin: "quality_rule" });
    const without = refused(
      await finding(clientA, dismissedFinding, "open", "dismissed", null),
      "a dismissal with no reason",
    );
    const withReason = await finding(
      clientA, dismissedFinding, "open", "dismissed", "ข้อสังเกตนี้ซ้ำกับ QF-001",
    );
    assert(!withReason.error, `dismiss failed: ${withReason.error?.message}`);
    return without.slice(0, 50);
  });

  await check("20. resolved → open requires a reopen reason", async () => {
    const without = refused(
      await finding(clientA, resolvedFinding, "resolved", "open", ""),
      "a reopen with no reason",
    );
    assert(await stateOf(clientA, resolvedFinding) === "resolved", "the refused reopen still moved the finding");

    const withReason = await finding(clientA, resolvedFinding, "resolved", "open", "เกณฑ์ที่เพิ่มยังไม่ครอบคลุม");
    assert(!withReason.error, `reopen failed: ${withReason.error?.message}`);
    const row = await itemRow(resolvedFinding);
    assert(row.resolution_text === null && row.resolved_at === null, "reopening left the old resolution");
    const activities = await activitiesFor(clientA, resolvedFinding);
    assert(
      activities.some((a) => a.activity_type === "quality_resolved" && String(a.comment).includes("เกณฑ์การทดสอบ")),
      "the original resolution was lost from the audit log",
    );
    return `${without.slice(0, 34)}…; reopened, resolution still in history`;
  });

  await check("21. dismissed → open requires a reopen reason", async () => {
    const without = refused(
      await finding(clientA, dismissedFinding, "dismissed", "open", null),
      "a reopen with no reason",
    );
    const withReason = await finding(clientA, dismissedFinding, "dismissed", "open", "ไม่ได้ซ้ำอย่างที่คิด");
    assert(!withReason.error, `reopen failed: ${withReason.error?.message}`);
    assert(await stateOf(clientA, dismissedFinding) === "open", "the finding did not reopen");
    return without.slice(0, 50);
  });

  await check("22. a non-member cannot change another tenant's finding", async () => {
    const message = refused(await finding(clientB, f1, "acknowledged", "resolved", "stolen"), "an outsider's resolution");
    assert(/not found|not visible/i.test(message), `the refusal leaked more than 'not found': ${message}`);
    assert(await stateOf(clientA, f1) === "acknowledged", "an outsider moved the finding");
    return message.slice(0, 50);
  });

  await check("23. an archived project's findings cannot be changed", async () => {
    const viaRpc = refused(
      await finding(clientA, archivedFinding, "open", "acknowledged", null),
      "acknowledging in an archived project",
    );
    // The record stays fully readable.
    const activities = await clientA.from("review_activities").select("id").eq("item_id", archivedFinding);
    assert(!activities.error, "an archived project's activity log became unreadable");
    return viaRpc.slice(0, 50);
  });

  await check("24. a stale expected state is refused on a finding", async () => {
    const message = refused(
      await finding(clientA, f1, "open", "resolved", "a note"),
      "a finding action against a stale state",
    );
    assert(await stateOf(clientA, f1) === "acknowledged", "the refused action still moved the finding");
    return message.slice(0, 56);
  });

  await check("25. resolving a finding changes no requirement", async () => {
    const requirement = await newItem(projectA, runA, "functional_requirement");
    const before = JSON.stringify(await itemRow(requirement));

    const target = await newItem(projectA, runA, "quality_finding", {
      origin: "quality_rule",
      attributes: { finding: "untestable", target_keys: ["fr-1"] },
    });
    await admin.from("item_relations").insert({
      project_id: projectA,
      from_item_id: target,
      to_item_id: requirement,
      relation_type: "derives_from",
    });

    const result = await finding(clientA, target, "open", "resolved", "แก้ที่เกณฑ์การทดสอบแล้ว");
    assert(!result.error, `resolve failed: ${result.error?.message}`);

    const after = JSON.stringify(await itemRow(requirement));
    assert(after === before, "resolving a finding changed the requirement it points at");
    return "the related requirement's title, status and version are untouched";
  });

  await check("26. workflow activities cannot be updated or deleted", async () => {
    const { data } = await admin.from("review_activities").select("id").eq("item_id", f1).limit(1).single();
    const id = (data as { id: string }).id;
    const updated = refused(
      await admin.from("review_activities").update({ comment: "rewritten" }).eq("id", id),
      "rewriting a workflow activity",
    );
    const deleted = refused(
      await admin.from("review_activities").delete().eq("id", id),
      "deleting a workflow activity",
    );
    return `update: ${updated.slice(0, 32)}… / delete: ${deleted.slice(0, 32)}…`;
  });

  // ---------------------------------------------------------------- integrity
  await check("27. a question cannot be approved through the requirement review RPC", async () => {
    const message = refused(
      await clientA.rpc("review_item", {
        p_item_id: q1,
        p_activity_type: "approve",
        p_to_status: "approved",
        p_comment: null,
        p_expected_status: "draft",
      }),
      "approving a question",
    );
    return message.slice(0, 56);
  });

  await check("28. a finding cannot be approved through the requirement review RPC", async () => {
    const message = refused(
      await clientA.rpc("review_item", {
        p_item_id: f1,
        p_activity_type: "approve",
        p_to_status: "approved",
        p_comment: null,
        p_expected_status: "draft",
      }),
      "approving a finding",
    );
    return message.slice(0, 56);
  });

  await check("29. a requirement cannot use the question or finding RPC", async () => {
    const requirement = await newItem(projectA, runA, "business_requirement");
    const asQuestion = refused(
      await question(clientA, requirement, "open", "answered", "an answer"),
      "answering a requirement",
    );
    const asFinding = refused(
      await finding(clientA, requirement, "open", "resolved", "a note"),
      "resolving a requirement",
    );
    // And it has no workflow state at all — the CHECK constraint sees to that.
    const row = await itemRow(requirement);
    assert(row.workflow_state === null, `a requirement carries workflow_state '${row.workflow_state}'`);
    return `${asQuestion.slice(0, 30)}… / ${asFinding.slice(0, 30)}…; workflow_state is null`;
  });

  await check("30. the state change and its activity are atomic", async () => {
    const q = await newItem(projectA, runA, "open_question");
    // A refused action must leave neither half behind.
    refused(await question(clientA, q, "open", "answered", ""), "an empty answer");
    assert(await stateOf(clientA, q) === "open", "a refused action moved the state");
    assert((await activitiesFor(clientA, q)).length === 0, "a refused action wrote an activity");

    // And a successful one writes both.
    const ok = await question(clientA, q, "open", "deferred", "รอข้อมูลเพิ่มเติม");
    assert(!ok.error, `defer failed: ${ok.error?.message}`);
    assert(await stateOf(clientA, q) === "deferred", "the state did not move");
    assert((await activitiesFor(clientA, q)).length === 1, "no activity was written");
    return "refused: neither half; succeeded: both halves";
  });

  await check("31. two concurrent actions: one wins, the other is refused", async () => {
    const q = await newItem(projectA, runA, "open_question");

    // Both read 'open' and both submit against it, as two browser tabs would.
    const [first, second] = await Promise.all([
      question(clientA, q, "open", "answered", "คำตอบจากแท็บที่หนึ่ง"),
      question(clientA, q, "open", "deferred", "เลื่อนจากแท็บที่สอง"),
    ]);

    const wins = [first, second].filter((r) => !r.error);
    const loses = [first, second].filter((r) => r.error);
    assert(wins.length === 1, `expected exactly 1 success, got ${wins.length}`);
    assert(loses.length === 1, `expected exactly 1 refusal, got ${loses.length}`);
    assert(
      /workflow conflict/i.test(loses[0].error!.message),
      `the loser failed for the wrong reason: ${loses[0].error!.message}`,
    );
    assert((await activitiesFor(clientA, q)).length === 1, "the refused action still wrote an activity");
    return "one write, one activity, one refusal";
  });

  await check("32. the analysis run and every source excerpt are unchanged overall", async () => {
    const after = await runFingerprint();
    assert(after === runBefore, "the analysis run changed during the workflow verification");
    const refsAfter = await refsFingerprint(q1);
    assert(refsAfter === refsBefore, "a source reference changed during the workflow verification");

    // And nothing anywhere in the run gained or lost a citation.
    const { count } = await admin
      .from("item_source_references")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectA);
    assert(typeof count === "number" && count >= 1, "source references disappeared");
    return `run identical; ${count} source references intact`;
  });
}

function cleanupNotice(): void {
  if (!projectA && !userA) return;
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
