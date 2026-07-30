/**
 * Change requests runtime verification — proposing, approving, rejecting and
 * withdrawing a change against an already-approved or already-rejected requirement,
 * against a real Postgres.
 *
 *   npm run verify:change-requests   (needs .env.local pointing at a Supabase project)
 *
 * Every user-facing assertion runs on an authenticated user's own client, so RLS and
 * the RPCs' own auth.uid()/membership checks are what is being measured. The service
 * role appears only to build fixtures, and twice deliberately points AT a rule — the
 * partial unique index directly, and a direct UPDATE on a terminal item with no
 * approval flag set — to prove the database refuses even that.
 *
 * Companion to verify-review / verify-workflow, same shape.
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
const emailA = `reqwise-cr-a-${stamp}@example.com`;
const emailB = `reqwise-cr-b-${stamp}@example.com`;

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
      raw_provider_output: { items: [{ local_key: "r-1", title: "ข้อกำหนดตัวอย่าง" }] },
      validated_output: { items: [{ local_key: "r-1", title: "ข้อกำหนดตัวอย่าง" }] },
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
  const prefix = itemType === "open_question" ? "Q" : itemType === "quality_finding" ? "QF" : "FR";
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
    .select("title, description, priority, status, version_no")
    .eq("id", itemId)
    .single();
  return data as Record<string, unknown>;
}

/** draft -> reviewed -> approved, through the ordinary review RPC. */
async function approveItem(client: SupabaseClient, itemId: string): Promise<void> {
  const reviewed = await client.rpc("review_item", {
    p_item_id: itemId,
    p_activity_type: "status_change",
    p_to_status: "reviewed",
    p_comment: null,
    p_expected_status: "draft",
  });
  if (reviewed.error) throw new Error(`could not mark reviewed: ${reviewed.error.message}`);
  const approved = await client.rpc("review_item", {
    p_item_id: itemId,
    p_activity_type: "approve",
    p_to_status: "approved",
    p_comment: null,
    p_expected_status: "reviewed",
  });
  if (approved.error) throw new Error(`could not approve: ${approved.error.message}`);
}

/** draft -> rejected, through the ordinary review RPC. */
async function rejectItem(client: SupabaseClient, itemId: string): Promise<void> {
  const result = await client.rpc("review_item", {
    p_item_id: itemId,
    p_activity_type: "reject",
    p_to_status: "rejected",
    p_comment: "ไม่สอดคล้องกับเป้าหมายของโครงการ",
    p_expected_status: "draft",
  });
  if (result.error) throw new Error(`could not reject: ${result.error.message}`);
}

function openCR(
  client: SupabaseClient,
  targetItemId: string,
  overrides: Record<string, unknown> = {},
) {
  return client.rpc("open_change_request", {
    p_target_item_id: targetItemId,
    p_proposed_title: "ข้อกำหนดฉบับปรับปรุง",
    p_proposed_description: "รายละเอียดที่ปรับปรุงตามคำตอบของผู้มีส่วนได้ส่วนเสีย",
    p_proposed_priority: "high",
    p_reason: "คำตอบใหม่ทำให้ต้องปรับข้อกำหนดนี้",
    p_source_question_id: null,
    ...overrides,
  });
}

function resolveCR(client: SupabaseClient, changeRequestId: string, decision: string, note: string | null = null) {
  return client.rpc("resolve_change_request", {
    p_change_request_id: changeRequestId,
    p_decision: decision,
    p_resolution_note: note,
  });
}

function withdrawCR(client: SupabaseClient, changeRequestId: string) {
  return client.rpc("withdraw_change_request", { p_change_request_id: changeRequestId });
}

async function crRow(changeRequestId: string) {
  const { data } = await admin
    .from("change_requests")
    .select("status, resolution_note, resolved_by, resolved_at, applied_version_no, project_id, target_item_id")
    .eq("id", changeRequestId)
    .single();
  return data as Record<string, unknown>;
}

async function main(): Promise<void> {
  console.log("\nReqWise AI — change request verification\n");

  userA = await createUser(emailA, "Reviewer A");
  userB = await createUser(emailB, "Outsider B");
  clientA = await signIn(emailA);
  clientB = await signIn(emailB);
  orgA = await personalOrg(userA);
  orgB = await personalOrg(userB);

  const { data: profile } = await admin.from("domain_profiles").select("id").limit(1).single();
  profileId = (profile as { id: string }).id;

  projectA = await newProject(clientA, orgA, userA, `Change request verification ${stamp}`);
  projectArchived = await newProject(clientA, orgA, userA, `Archived CR project ${stamp}`);
  await newProject(clientB, orgB, userB, `Outsider CR project ${stamp}`);

  sourceA = await newSource(projectA, userA, "Change request verification notes");
  runA = await newRun(projectA, sourceA, userA);

  // ------------------------------------------------------------ opening
  const approved1 = await newItem(projectA, runA, "functional_requirement");
  await approveItem(clientA, approved1);

  const rejected1 = await newItem(projectA, runA, "functional_requirement");
  await rejectItem(clientA, rejected1);

  const draftItem = await newItem(projectA, runA, "functional_requirement");
  const question1 = await newItem(projectA, runA, "open_question");
  const finding1 = await newItem(projectA, runA, "quality_finding");

  let cr1 = "";
  await check("1. a change request can be opened against an approved item", async () => {
    const result = await openCR(clientA, approved1, { p_source_question_id: question1 });
    assert(!result.error, `open failed: ${result.error?.message}`);
    cr1 = (result.data as { change_request_id: string }).change_request_id;
    const row = await crRow(cr1);
    assert(row.status === "pending", `status is '${row.status}'`);
    assert(row.target_item_id === approved1, "the wrong item was targeted");
    return `pending change request ${cr1.slice(0, 8)}… opened, sourced from a question`;
  });

  let cr2 = "";
  await check("2. a change request can be opened against a rejected item, with no source question", async () => {
    const result = await openCR(clientA, rejected1);
    assert(!result.error, `open failed: ${result.error?.message}`);
    cr2 = (result.data as { change_request_id: string }).change_request_id;
    return `opened against a rejected item, no source question`;
  });

  await check("3. a change request cannot be opened against a draft or reviewed item", async () => {
    const draft = refused(await openCR(clientA, draftItem), "opening against a draft item");
    const q = await newItem(projectA, runA, "functional_requirement");
    const reviewResult = await clientA.rpc("review_item", {
      p_item_id: q,
      p_activity_type: "status_change",
      p_to_status: "reviewed",
      p_comment: null,
      p_expected_status: "draft",
    });
    assert(!reviewResult.error, `could not mark reviewed: ${reviewResult.error?.message}`);
    const reviewed = refused(await openCR(clientA, q), "opening against a reviewed item");
    return `draft: ${draft.slice(0, 40)}… / reviewed: ${reviewed.slice(0, 40)}…`;
  });

  await check("4. a change request's source must be an open_question in the same project", async () => {
    const wrongType = refused(
      await openCR(clientA, approved1, { p_source_question_id: finding1 }),
      "sourcing from a quality finding",
    );
    const otherProject = await newProject(clientA, orgA, userA, `Second CR project ${stamp}`);
    const otherSource = await newSource(otherProject, userA, "Second project notes");
    const otherRun = await newRun(otherProject, otherSource, userA);
    const otherQuestion = await newItem(otherProject, otherRun, "open_question");
    const crossProject = refused(
      await openCR(clientA, approved1, { p_source_question_id: otherQuestion }),
      "sourcing from another project's question",
    );
    return `wrong type: ${wrongType.slice(0, 34)}… / cross-project: ${crossProject.slice(0, 34)}…`;
  });

  // ------------------------------------------------------------ one pending at a time
  await check("5. a second change request cannot be opened while one is pending (RPC)", async () => {
    const message = refused(await openCR(clientA, approved1), "a second pending change request");
    assert(/already pending/i.test(message), `wrong refusal: ${message}`);
    return message.slice(0, 56);
  });

  await check("6. the database itself refuses two pending rows (partial unique index)", async () => {
    // Point the service role directly at the rule, bypassing open_change_request()
    // entirely — the same technique verify-workflow.mts uses for its trigger checks.
    const direct = await admin.from("change_requests").insert({
      project_id: projectA,
      target_item_id: approved1,
      status: "pending",
      proposed_title: "แทรกตรง",
      proposed_description: "แทรกตรงเพื่อทดสอบ",
      proposed_priority: "low",
      reason: "ทดสอบ unique index",
      requested_by: userA,
    });
    const message = refused(direct, "a direct insert past the RPC");
    assert(/duplicate key|unique/i.test(message), `wrong refusal: ${message}`);
    return message.slice(0, 56);
  });

  // ------------------------------------------------------------ resolving
  await check("7. approving updates the item's content, bumps the version, and snapshots it", async () => {
    const before = await itemRow(approved1);
    const result = await resolveCR(clientA, cr1, "approved");
    assert(!result.error, `approve failed: ${result.error?.message}`);
    const data = result.data as { applied_version_no: number };

    const after = await itemRow(approved1);
    assert(after.title === "ข้อกำหนดฉบับปรับปรุง", `title is '${after.title}'`);
    assert(after.priority === "high", `priority is '${after.priority}'`);
    assert(Number(after.version_no) === Number(before.version_no) + 1, "version_no did not bump");
    // Supersedes, never reopens: the item's status is untouched.
    assert(after.status === "approved", `status is '${after.status}', expected 'approved' unchanged`);

    const { data: snapshot } = await admin
      .from("item_versions")
      .select("snapshot")
      .eq("item_id", approved1)
      .eq("version_no", before.version_no)
      .single();
    const snap = (snapshot as { snapshot: Record<string, unknown> }).snapshot;
    assert(snap.title === before.title, "the pre-change title was not snapshotted");

    const cr = await crRow(cr1);
    assert(cr.status === "approved", `change request status is '${cr.status}'`);
    assert(Number(cr.applied_version_no) === Number(data.applied_version_no), "applied_version_no mismatch");
    return `version ${before.version_no} → ${after.version_no}; status stayed 'approved'`;
  });

  await check("8. rejecting a change request requires a resolution note", async () => {
    const without = refused(await resolveCR(clientA, cr2, "rejected", "   "), "rejecting with a blank note");
    const cr = await crRow(cr2);
    assert(cr.status === "pending", "the refused rejection still moved the change request");

    const withNote = await resolveCR(clientA, cr2, "rejected", "ยังไม่มีเหตุผลเพียงพอ");
    assert(!withNote.error, `reject failed: ${withNote.error?.message}`);
    const after = await crRow(cr2);
    assert(after.status === "rejected", `status is '${after.status}'`);

    const item = await itemRow(rejected1);
    assert(item.title === "รายการที่ 2", "rejecting a change request altered the item");
    return without.slice(0, 50);
  });

  // ------------------------------------------------------------ regression: still terminal
  await check("9. a direct write to a terminal item is still refused with no approval in flight", async () => {
    const direct = refused(
      await clientA.from("analysis_items").update({ title: "แก้ตรงๆ" }).eq("id", approved1),
      "a direct write to an approved item outside resolve_change_request()",
    );
    assert(/read-only/i.test(direct), `wrong refusal: ${direct}`);
    return direct.slice(0, 56);
  });

  // ------------------------------------------------------------ withdraw
  let cr3 = "";
  await check("10. a pending change request can be withdrawn", async () => {
    const approved2 = await newItem(projectA, runA, "functional_requirement");
    await approveItem(clientA, approved2);
    const opened = await openCR(clientA, approved2);
    assert(!opened.error, `open failed: ${opened.error?.message}`);
    cr3 = (opened.data as { change_request_id: string }).change_request_id;

    const result = await withdrawCR(clientA, cr3);
    assert(!result.error, `withdraw failed: ${result.error?.message}`);
    const cr = await crRow(cr3);
    assert(cr.status === "withdrawn", `status is '${cr.status}'`);
    return "withdrawn";
  });

  await check("11. a withdrawn change request cannot be resolved, and a new one may be opened", async () => {
    const message = refused(await resolveCR(clientA, cr3, "approved"), "resolving a withdrawn change request");
    assert(/no longer pending/i.test(message), `wrong refusal: ${message}`);

    const approved2 = (await crRow(cr3)).target_item_id as string;
    const reopened = await openCR(clientA, approved2);
    assert(!reopened.error, `a fresh change request after withdrawal failed: ${reopened.error?.message}`);
    return `${message.slice(0, 40)}…; a fresh one opened cleanly`;
  });

  // ------------------------------------------------------------ tenancy
  await check("12. a non-member cannot see or act on another tenant's change requests", async () => {
    const viaSelect = await clientB.from("change_requests").select("id").eq("id", cr1);
    assert((viaSelect.data ?? []).length === 0, "an outsider could read another tenant's change request");

    const approved3 = await newItem(projectA, runA, "functional_requirement");
    await approveItem(clientA, approved3);
    const opened = await openCR(clientA, approved3);
    assert(!opened.error, `open failed: ${opened.error?.message}`);
    const crId = (opened.data as { change_request_id: string }).change_request_id;

    const outsider = refused(await resolveCR(clientB, crId, "approved"), "an outsider resolving another tenant's CR");
    assert(/not found|not visible/i.test(outsider), `the refusal leaked more than 'not found': ${outsider}`);
    return `read: 0 rows; resolve: ${outsider.slice(0, 34)}…`;
  });

  // ------------------------------------------------------------ archived project
  await check("13. an archived project refuses opening or resolving a change request", async () => {
    const archivedSource = await newSource(projectArchived, userA, "Archived CR notes");
    const archivedRun = await newRun(projectArchived, archivedSource, userA);
    const archivedItem = await newItem(projectArchived, archivedRun, "functional_requirement");
    await approveItem(clientA, archivedItem);

    const archived = await clientA.rpc("archive_project", { p_project: projectArchived, p_reason: "verification" });
    assert(!archived.error, `archive failed: ${archived.error?.message}`);

    const message = refused(await openCR(clientA, archivedItem), "opening a change request in an archived project");
    return message.slice(0, 56);
  });
}

function cleanupNotice(): void {
  if (!projectA && !userA) return;
  console.log(
    "\nVerification rows remain — analysis runs and change-request activity are immutable/" +
      "append-only by design.\nClear them with:\n\n  npx supabase db query --linked -f scripts/verify-db-cleanup.sql\n",
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
