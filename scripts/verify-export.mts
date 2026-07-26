/**
 * Slice 6C runtime verification — requirements export, against a real Postgres.
 *
 *   npm run verify:export      (needs .env.local pointing at a Supabase project)
 *
 * Every reader-facing assertion runs on an authenticated user's own client, so RLS is what
 * is being measured, not an application filter. The service role appears only to build
 * fixtures and — twice — to count rows before and after an export, which is how "an export
 * writes nothing" is proved rather than asserted.
 *
 * Fixtures are named `Export verification …` and `reqwise-export-…@example.com` so
 * `scripts/verify-db-cleanup.sql` can find them. Nothing here deletes anything.
 *
 * Companion to verify-db / projects / sources / analysis / review / workflow / traceability,
 * same shape.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { DEFAULT_SECTIONS, scopeForPreset, exportPackageSchema } from "../lib/contracts/export.ts";
import type { ExportScope } from "../lib/contracts/export.ts";
import { buildExportPackage } from "../lib/export/build.ts";
import {
  renderFindingsCsv,
  renderQuestionsCsv,
  renderRequirementsCsv,
  renderTraceabilityCsv,
} from "../lib/export/csv.ts";
import { renderJson } from "../lib/export/json.ts";
import { loadExportInput } from "../lib/export/load.ts";
import { renderMarkdown } from "../lib/export/markdown.ts";
import { assessReadiness } from "../lib/export/readiness.ts";

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

const stamp = Date.now();
const password = `Verify!${stamp}`;
const emailA = `reqwise-export-a-${stamp}@example.com`;
const emailB = `reqwise-export-b-${stamp}@example.com`;

let userA = "";
let userB = "";
let clientA: SupabaseClient;
let clientB: SupabaseClient;
let orgA = "";
let orgB = "";
let profileId = "";
let projectA = "";
let projectB = "";
let projectArchived = "";
let runA = "";
let runArchived = "";
let sourceA = "";
let sourceB2 = "";

const SOURCE_TEXT =
  "ลูกค้าต้องการจองห้องประชุมผ่านเว็บไซต์\n" +
  "พนักงานต้องเห็นรายการจองและตรวจสอบลูกค้าที่มาเช็กอิน\n" +
  "ยังไม่ได้ข้อสรุปเรื่องการยกเลิกและการคืนเงิน";

const EXCERPT_ONE = SOURCE_TEXT.slice(0, 38);
const EXCERPT_TWO = SOURCE_TEXT.slice(39, 91);

const ids: Record<string, string> = {};

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

async function newProject(org: string, creator: string, name: string): Promise<string> {
  const { data, error } = await admin
    .from("projects")
    .insert({
      organization_id: org,
      domain_profile_id: profileId,
      name,
      created_by: creator,
      output_lang: "th",
      business_objective: "ให้ลูกค้าจองเองได้",
      known_stakeholders: ["Front desk", "Finance"],
    })
    .select("id")
    .single();
  if (error) throw new Error(`could not create project ${name}: ${error.message}`);
  return data.id as string;
}

async function newSource(
  project: string,
  creator: string,
  title: string,
  rawText: string,
): Promise<string> {
  const { data, error } = await admin
    .from("source_documents")
    .insert({ project_id: project, title, kind: "meeting_notes", raw_text: rawText, created_by: creator })
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
      // Deliberately non-empty: check 23 proves none of it reaches the export.
      raw_provider_output: { secret_marker: "RAW-PROVIDER-MARKER", items: [] },
      validated_output: { secret_marker: "VALIDATED-MARKER", items: [] },
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
  displayId: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  itemSeq += 1;
  const { data, error } = await admin
    .from("analysis_items")
    .insert({
      project_id: project,
      analysis_run_id: run,
      item_type: itemType,
      display_id: displayId,
      provider_key: `export-verify-${itemSeq}`,
      title: `${displayId} statement`,
      description: `${displayId} description`,
      evidence_class: "stated",
      origin: "source_analysis",
      confidence: 0.8,
      ...overrides,
    })
    .select("id")
    .single();
  if (error) throw new Error(`could not create ${itemType} ${displayId}: ${error.message}`);
  return data.id as string;
}

/**
 * Moves an item to a status **through `review_item()`**, because there is no other way:
 * `guard_item_update()` refuses a direct status write even for the service role. Which
 * means every status in these fixtures arrived the way a reviewer's would, and the
 * `review_activities` rows exist as a side effect rather than being faked.
 *
 * `approved` is two steps — draft → reviewed → approved — since the transition table
 * allows no shortcut (DATA-MODEL §C.11).
 */
async function setStatus(itemId: string, status: string): Promise<void> {
  const path: Array<{ to: string; activity: string; from: string; comment: string | null }> = [];

  if (status === "reviewed" || status === "approved") {
    path.push({ to: "reviewed", activity: "status_change", from: "draft", comment: null });
  }
  if (status === "approved") {
    path.push({ to: "approved", activity: "approve", from: "reviewed", comment: null });
  }
  if (status === "rejected") {
    path.push({ to: "rejected", activity: "reject", from: "draft", comment: "Out of scope." });
  }
  if (status === "needs_clarification") {
    path.push({
      to: "needs_clarification",
      activity: "request_clarification",
      from: "draft",
      comment: "Needs a measurable threshold.",
    });
  }

  for (const step of path) {
    const { error } = await clientA.rpc("review_item", {
      p_item_id: itemId,
      p_activity_type: step.activity,
      p_to_status: step.to,
      p_comment: step.comment,
      p_expected_status: step.from,
    });
    if (error) throw new Error(`could not move to ${step.to}: ${error.message}`);
  }
}

async function cite(
  project: string,
  itemId: string,
  source: string,
  excerpt: string,
  start: number | null,
  end: number | null,
  verified: boolean,
): Promise<void> {
  const { error } = await admin.from("item_source_references").insert({
    project_id: project,
    item_id: itemId,
    source_document_id: source,
    excerpt,
    start_offset: start,
    end_offset: end,
    offset_verified: verified,
  });
  if (error) throw new Error(`could not cite: ${error.message}`);
}

async function relate(project: string, from: string, to: string, type: string): Promise<void> {
  const { error } = await admin
    .from("item_relations")
    .insert({ project_id: project, from_item_id: from, to_item_id: to, relation_type: type });
  if (error) throw new Error(`could not relate (${type}): ${error.message}`);
}

/**
 * A real human edit, through `edit_analysis_item()`.
 *
 * Which is the only way to produce a version-2 item with a snapshot behind it: the RPC
 * writes the content, the `item_versions` row and the `edit` activity in one transaction,
 * and `guard_item_update()` refuses any other path. So "human-edited" in the export is
 * backed by an edit that actually happened.
 */
async function editItem(itemId: string, expectedVersion: number, reason: string): Promise<void> {
  const { error } = await clientA.rpc("edit_analysis_item", {
    p_item_id: itemId,
    p_expected_version: expectedVersion,
    p_title: "BR-901 statement",
    p_description: 'ระบบต้องรองรับการจอง "ออนไลน์"\nและต้องยืนยันทันที, ไม่เกิน 3 วินาที',
    p_priority: "high",
    p_change_reason: reason,
  });
  if (error) throw new Error(`could not edit ${itemId}: ${error.message}`);
}

/** Row counts across every table an export reads — the "nothing was written" baseline. */
async function snapshotCounts(project: string): Promise<Record<string, number>> {
  const tables = [
    "analysis_items",
    "analysis_runs",
    "item_relations",
    "item_source_references",
    "item_versions",
    "review_activities",
    "source_documents",
  ];
  const counts: Record<string, number> = {};
  for (const table of tables) {
    const { count, error } = await admin
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("project_id", project);
    if (error) throw new Error(`${table} count failed: ${error.message}`);
    counts[table] = count ?? 0;
  }
  return counts;
}

function allSections(): ExportScope["sections"] {
  return { ...DEFAULT_SECTIONS, version_summary: true, review_activity: true };
}

function scope(overrides: Partial<ExportScope> = {}): ExportScope {
  return {
    status: "all_statuses",
    sections: allSections(),
    includeConfidence: true,
    ...overrides,
  };
}

async function buildFor(
  client: SupabaseClient,
  project: string,
  chosen: ExportScope = scope(),
) {
  const input = await loadExportInput(client, project, {
    includeVersionHistory: chosen.sections.version_summary,
  });
  if (!input) return null;
  const pkg = buildExportPackage(input, chosen, new Date().toISOString());
  return { input, pkg, readiness: assessReadiness(input, pkg) };
}

async function setup(): Promise<void> {
  userA = await createUser(emailA, "Export A");
  userB = await createUser(emailB, "Export B");
  clientA = await signIn(emailA);
  clientB = await signIn(emailB);
  orgA = await personalOrg(userA);
  orgB = await personalOrg(userB);

  const { data: profile } = await admin.from("domain_profiles").select("id").limit(1).single();
  profileId = (profile as { id: string }).id;

  projectA = await newProject(orgA, userA, `Export verification ${stamp}`);
  projectB = await newProject(orgB, userB, `Export verification outsider ${stamp}`);
  projectArchived = await newProject(orgA, userA, `Export verification archived ${stamp}`);

  sourceA = await newSource(projectA, userA, "ประชุมเก็บความต้องการ", SOURCE_TEXT);
  sourceB2 = await newSource(projectA, userA, "Front desk follow-up", "Staff asked for a same-day cancellation rule.");
  runA = await newRun(projectA, sourceA, userA);

  ids.obj = await newItem(projectA, runA, "business_objective", "OBJ-901", { priority: "high" });
  ids.br1 = await newItem(projectA, runA, "business_requirement", "BR-901", {
    priority: "high",
    description: 'ระบบต้องรองรับการจอง "ออนไลน์"\nและต้องยืนยันทันที, ไม่เกิน 3 วินาที',
  });
  ids.fr1 = await newItem(projectA, runA, "functional_requirement", "FR-901", {
    evidence_class: "inferred",
    rationale: "The notes describe staff checking arrivals.",
    confidence: 0.91,
  });
  ids.brDraft = await newItem(projectA, runA, "business_requirement", "BR-902");
  ids.frRejected = await newItem(projectA, runA, "functional_requirement", "FR-902", {
    title: "=SUM(A1:A9) must not be executed",
    description: "-1 discount is out of scope",
  });
  ids.nfr = await newItem(projectA, runA, "non_functional_requirement", "NFR-901", {
    origin: "domain_profile",
    evidence_class: "assumed",
  });
  ids.us = await newItem(projectA, runA, "user_story", "US-901");
  ids.ac = await newItem(projectA, runA, "acceptance_criterion", "AC-901");
  ids.br3 = await newItem(projectA, runA, "business_requirement", "BR-903");
  ids.risk = await newItem(projectA, runA, "risk", "RISK-901");
  ids.qOpen = await newItem(projectA, runA, "open_question", "Q-901", { origin: "quality_rule" });
  ids.qAnswered = await newItem(projectA, runA, "open_question", "Q-902");
  ids.qDeferred = await newItem(projectA, runA, "open_question", "Q-903");
  ids.qfOpen = await newItem(projectA, runA, "quality_finding", "QF-901", {
    attributes: { finding_kind: "ambiguous" },
  });
  ids.qfResolved = await newItem(projectA, runA, "quality_finding", "QF-902", {
    attributes: { finding_kind: "incomplete" },
  });

  // A human edit first, so BR-901 reaches version 2 *before* it is reviewed — an edit
  // after a review would reset the review to draft, which is slice 5's rule and would
  // leave this fixture with no approved requirement.
  await editItem(ids.br1, 1, "Tightened the wording");

  // Review statuses, one per scope boundary.
  await setStatus(ids.obj, "approved");
  await setStatus(ids.br1, "approved");
  await setStatus(ids.us, "approved");
  await setStatus(ids.ac, "approved");
  await setStatus(ids.br3, "approved");
  await setStatus(ids.fr1, "reviewed");
  await setStatus(ids.frRejected, "rejected");
  await setStatus(ids.nfr, "needs_clarification");

  // Workflow states, set through the RPCs so the activity rows exist as they would in the
  // application. `resolve_open_question` and `update_quality_finding` are slice 6A's.
  const { error: answerError } = await clientA.rpc("resolve_open_question", {
    p_item_id: ids.qAnswered,
    p_expected_state: "open",
    p_to_state: "answered",
    p_answer: "ยกเลิกฟรีก่อน 24 ชั่วโมง",
    p_follow_up_on: null,
  });
  if (answerError) throw new Error(`could not answer Q-902: ${answerError.message}`);

  const { error: deferError } = await clientA.rpc("resolve_open_question", {
    p_item_id: ids.qDeferred,
    p_expected_state: "open",
    p_to_state: "deferred",
    p_answer: "รอฝ่ายการเงินยืนยันนโยบายคืนเงิน",
    p_follow_up_on: "2026-08-15",
  });
  if (deferError) throw new Error(`could not defer Q-903: ${deferError.message}`);

  const { error: findingError } = await clientA.rpc("update_quality_finding", {
    p_item_id: ids.qfResolved,
    p_expected_state: "open",
    p_to_state: "resolved",
    p_note: "Rewritten with a measurable threshold.",
  });
  if (findingError) throw new Error(`could not resolve QF-902: ${findingError.message}`);

  await cite(projectA, ids.br1, sourceA, EXCERPT_ONE, 0, 38, true);
  await cite(projectA, ids.fr1, sourceA, EXCERPT_TWO, 39, 91, true);
  await cite(projectA, ids.us, sourceB2, "same-day cancellation rule", 18, 44, false);

  await relate(projectA, ids.obj, ids.br1, "supports");
  await relate(projectA, ids.br1, ids.fr1, "implemented_by");
  await relate(projectA, ids.us, ids.ac, "validated_by");
  await relate(projectA, ids.qOpen, ids.br3, "raises_question");
  await relate(projectA, ids.qfOpen, ids.fr1, "flags_quality_issue");

  // A legacy edge, written with the service role because a new run may not author one
  // (DATA-MODEL §C.13) — which is exactly the state an old project is in.
  await relate(projectA, ids.br3, ids.obj, "derives_from");

  // The archived project, with one approved requirement to export.
  const archivedSource = await newSource(projectArchived, userA, "Archived notes", SOURCE_TEXT);
  runArchived = await newRun(projectArchived, archivedSource, userA);
  const archivedItem = await newItem(projectArchived, runArchived, "business_requirement", "BR-951");
  await setStatus(archivedItem, "approved");
  await cite(projectArchived, archivedItem, archivedSource, EXCERPT_ONE, 0, 38, true);
  const { error: archiveError } = await clientA.rpc("archive_project", {
    p_project: projectArchived,
    p_reason: "Export verification",
  });
  if (archiveError) throw new Error(`could not archive: ${archiveError.message}`);

  // User B's own project, so cross-tenant checks are about visibility and not emptiness.
  const sourceOther = await newSource(projectB, userB, "Outsider notes", "Outsider requirement text.");
  const runOther = await newRun(projectB, sourceOther, userB);
  await newItem(projectB, runOther, "business_requirement", "BR-991");
}

async function main(): Promise<void> {
  console.log(`\nReqWise AI — Slice 6C export verification against ${URL_}\n`);
  await setup();

  console.log("Building an export");

  await check("1. user A builds an export package for their own project", async () => {
    const built = await buildFor(clientA, projectA);
    assert(built, "the project was not visible to its own owner");
    assert(built.pkg.project.name.startsWith("Export verification"), "wrong project");
    return `${built.pkg.requirements.length} requirements, ${built.pkg.openQuestions.length} questions, ${built.pkg.relations.length} relations`;
  });

  await check("2. user B cannot load user A's export at all", async () => {
    const built = await buildFor(clientB, projectA);
    assert(built === null, "user B was able to load another tenant's export");
    return "null — RLS, indistinguishable from a project that does not exist";
  });

  await check("3. an archived project still exports, read-only", async () => {
    const built = await buildFor(clientA, projectArchived, scope({ status: "approved_only" }));
    assert(built, "the archived project could not be exported");
    assert(built.pkg.project.archived, "the package does not record that it is archived");
    assert(
      built.pkg.notices.includes("This export was generated from an archived read-only project."),
      "the archived notice is missing",
    );
    assert(built.pkg.requirements.length === 1, "the archived requirement is missing");
    return "1 requirement, notice present";
  });

  await check("4. an export writes nothing to the database", async () => {
    const before = await snapshotCounts(projectA);
    const built = await buildFor(clientA, projectA);
    assert(built, "load failed");
    renderMarkdown(built.pkg);
    renderJson(built.pkg);
    renderRequirementsCsv(built.pkg);
    renderTraceabilityCsv(built.pkg);
    const after = await snapshotCounts(projectA);
    assert(
      JSON.stringify(before) === JSON.stringify(after),
      `row counts changed: ${JSON.stringify(before)} → ${JSON.stringify(after)}`,
    );
    return `unchanged across ${Object.keys(before).length} tables`;
  });

  console.log("\nScope");

  await check("5. approved-only excludes every draft", async () => {
    const built = await buildFor(clientA, projectA, scope({ status: "approved_only" }));
    assert(built, "load failed");
    const statuses = new Set(built.pkg.requirements.map((item) => item.status));
    assert(statuses.size === 1 && statuses.has("approved"), `saw ${[...statuses].join(", ")}`);
    const displayIds = built.pkg.requirements.map((item) => item.displayId);
    assert(!displayIds.includes("BR-902"), "a draft reached an approved-only export");
    return `${displayIds.length} approved: ${displayIds.join(", ")}`;
  });

  await check("6. reviewed-and-approved adds the reviewed item and no draft", async () => {
    const built = await buildFor(clientA, projectA, scope({ status: "reviewed_and_approved" }));
    assert(built, "load failed");
    const displayIds = built.pkg.requirements.map((item) => item.displayId);
    assert(displayIds.includes("FR-901"), "the reviewed item is missing");
    assert(!displayIds.includes("BR-902"), "a draft reached the document");
    assert(!displayIds.includes("NFR-901"), "a needs-clarification item reached the document");
    return displayIds.join(", ");
  });

  await check("7. the active working set keeps drafts and excludes rejected", async () => {
    const built = await buildFor(clientA, projectA, scope({ status: "active_working_set" }));
    assert(built, "load failed");
    const displayIds = built.pkg.requirements.map((item) => item.displayId);
    assert(displayIds.includes("BR-902"), "the draft is missing");
    assert(displayIds.includes("NFR-901"), "the clarification item is missing");
    assert(!displayIds.includes("FR-902"), "a rejected requirement reached the working set");
    return `${displayIds.length} items, no rejected`;
  });

  await check("8. all statuses includes the rejected item, labelled", async () => {
    const built = await buildFor(clientA, projectA);
    assert(built, "load failed");
    const rejected = built.pkg.requirements.find((item) => item.displayId === "FR-902");
    assert(rejected, "the rejected requirement is missing");
    assert(rejected.statusLabel === "Rejected", `labelled ${rejected.statusLabel}`);
    return "FR-902 — Rejected";
  });

  console.log("\nEvidence");

  await check("9. every citation's offsets still land on the excerpt it quotes", async () => {
    const built = await buildFor(clientA, projectA);
    assert(built, "load failed");
    const rawById = new Map(built.input.sources.map((source) => [source.id, source.rawText]));
    let checked = 0;
    for (const item of built.pkg.requirements) {
      for (const evidence of item.sourceEvidence) {
        if (evidence.startOffset === null || evidence.endOffset === null) continue;
        const raw = rawById.get(evidence.sourceRevisionId);
        assert(raw !== undefined, "a citation names a source the reader cannot see");
        assert(
          raw.slice(evidence.startOffset, evidence.endOffset) === evidence.excerpt,
          `offset mismatch on ${item.displayId}`,
        );
        checked += 1;
      }
    }
    assert(checked > 0, "no citation was checked");
    assert(built.readiness.errors.length === 0, "readiness reported a blocking error");
    return `${checked} citations verified against the stored text`;
  });

  await check("10. a domain-guidance item says so instead of citing a nearby sentence", async () => {
    const built = await buildFor(clientA, projectA);
    assert(built, "load failed");
    const nfr = built.pkg.requirements.find((item) => item.displayId === "NFR-901");
    assert(nfr, "NFR-901 is missing");
    assert(nfr.sourceEvidence.length === 0, "a citation was invented for a profile item");
    assert(
      nfr.evidenceNotice === "Generated from domain guidance; no direct source evidence.",
      `notice was ${JSON.stringify(nfr.evidenceNotice)}`,
    );
    return "no citation, explicit notice";
  });

  await check("11. an offset mismatch blocks the export rather than shipping it", async () => {
    const built = await buildFor(clientA, projectA);
    assert(built, "load failed");
    // Mutate the loaded input, not the database: the schema deliberately makes this state
    // unreachable through the application, and the point is what the *export* does if it
    // ever met it.
    const broken = {
      ...built.input,
      references: built.input.references.map((reference) =>
        reference.itemId === ids.br1 ? { ...reference, startOffset: 5, endOffset: 20 } : reference,
      ),
    };
    const pkg = buildExportPackage(broken, scope(), new Date().toISOString());
    const readiness = assessReadiness(broken, pkg);
    assert(readiness.level === "cannot_export", `level was ${readiness.level}`);
    assert(
      readiness.errors.some((issue) => issue.key === "citation_offset_mismatch"),
      "the mismatch was not reported",
    );
    const message = readiness.errors[0].message;
    assert(!message.includes("ลูกค้า"), "the error message leaked source text");
    return "cannot_export, no source text in the message";
  });

  console.log("\nQuestions, findings and traceability");

  await check("12. an answered question exports its answer and its date", async () => {
    const built = await buildFor(clientA, projectA);
    assert(built, "load failed");
    const answered = built.pkg.openQuestions.find((item) => item.displayId === "Q-902");
    assert(answered, "Q-902 is missing");
    assert(answered.workflowState === "answered", `state was ${answered.workflowState}`);
    assert(answered.resolutionText === "ยกเลิกฟรีก่อน 24 ชั่วโมง", "the answer is wrong");
    assert(answered.resolvedAt !== null, "no resolution timestamp");
    assert(answered.outstanding === false, "an answered question is still outstanding");
    // The answer must not have been turned into a requirement.
    assert(
      !built.pkg.requirements.some((item) => item.description.includes("ยกเลิกฟรี")),
      "an answer was promoted into a requirement",
    );
    return "answer, date, not promoted to a requirement";
  });

  await check("13. a deferred question exports its reason and follow-up date", async () => {
    const built = await buildFor(clientA, projectA);
    assert(built, "load failed");
    const deferred = built.pkg.openQuestions.find((item) => item.displayId === "Q-903");
    assert(deferred, "Q-903 is missing");
    assert(deferred.workflowState === "deferred", `state was ${deferred.workflowState}`);
    assert(deferred.followUpOn === "2026-08-15", `follow-up was ${deferred.followUpOn}`);
    assert(deferred.outstanding, "a deferred question is not outstanding");
    return "deferred, follow-up 2026-08-15, still outstanding";
  });

  await check("14. a resolved finding exports its resolution and its own kind", async () => {
    const built = await buildFor(clientA, projectA);
    assert(built, "load failed");
    const resolved = built.pkg.qualityFindings.find((item) => item.displayId === "QF-902");
    assert(resolved, "QF-902 is missing");
    assert(resolved.workflowState === "resolved", `state was ${resolved.workflowState}`);
    assert(resolved.resolutionText?.startsWith("Rewritten"), "the resolution is wrong");
    assert(resolved.findingKind === "incomplete", `kind was ${resolved.findingKind}`);
    assert(resolved.unresolved === false, "a resolved finding is still unresolved");
    const json = renderJson(built.pkg);
    assert(!json.toLowerCase().includes("severity"), "a severity was invented");
    return "resolution, kind incomplete, no severity anywhere";
  });

  await check("15. typed relations export as sentences, in both directions", async () => {
    const built = await buildFor(clientA, projectA);
    assert(built, "load failed");
    const edge = built.pkg.relations.find(
      (relation) => relation.fromDisplayId === "BR-901" && relation.toDisplayId === "FR-901",
    );
    assert(edge, "the implemented_by edge is missing");
    assert(edge.type === "implemented_by", `type was ${edge.type}`);
    assert(edge.phrase === "is implemented by", `phrase was ${edge.phrase}`);
    assert(edge.legacy === false, "a typed relation was marked legacy");

    const fr = built.pkg.requirements.find((item) => item.displayId === "FR-901");
    assert(fr?.relations.some((ref) => ref.phrase === "implements" && ref.displayId === "BR-901"),
      "the inbound edge does not read from FR-901's side");
    return `${built.pkg.relations.length} relations, both directions readable`;
  });

  await check("16. a legacy relation exports as legacy and keeps its own type", async () => {
    const built = await buildFor(clientA, projectA);
    assert(built, "load failed");
    const legacy = built.pkg.relations.find((relation) => relation.type === "derives_from");
    assert(legacy, "the legacy relation is missing from the export");
    assert(legacy.legacy, "a derives_from edge was not marked legacy");
    assert(legacy.fromDisplayId === "BR-903" && legacy.toDisplayId === "OBJ-901", "direction changed");
    const csv = renderTraceabilityCsv(built.pkg);
    assert(csv.includes("derives_from,derives from"), "the CSV lost the legacy type");
    return "derives_from preserved, direction unchanged, flagged legacy";
  });

  await check("17. coverage matches the project, not the scope", async () => {
    const narrow = await buildFor(clientA, projectA, scope({ status: "approved_only" }));
    const wide = await buildFor(clientA, projectA);
    assert(narrow && wide, "load failed");
    assert(
      JSON.stringify(narrow.pkg.coverage.totals) === JSON.stringify(wide.pkg.coverage.totals),
      "coverage moved when the document narrowed",
    );
    const { count } = await admin
      .from("analysis_items")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectA)
      .is("deleted_at", null);
    assert(
      wide.pkg.coverage.totals.items === (count ?? -1),
      `coverage counted ${wide.pkg.coverage.totals.items}, the project holds ${count}`,
    );
    assert(
      wide.pkg.coverage.disclaimer ===
        "Coverage indicators assist review and do not replace human judgment.",
      "the disclaimer is missing or altered",
    );
    return `${wide.pkg.coverage.totals.items} items, identical under both scopes`;
  });

  await check("18. no relation from another project reaches the export", async () => {
    const built = await buildFor(clientA, projectA);
    assert(built, "load failed");
    const known = new Set([
      ...built.pkg.requirements.map((item) => item.displayId),
      ...built.pkg.openQuestions.map((item) => item.displayId),
      ...built.pkg.qualityFindings.map((item) => item.displayId),
    ]);
    for (const relation of built.pkg.relations) {
      assert(known.has(relation.fromDisplayId), `${relation.fromDisplayId} is not in this export`);
      assert(known.has(relation.toDisplayId), `${relation.toDisplayId} is not in this export`);
    }
    const json = renderJson(built.pkg);
    assert(!json.includes("BR-991"), "user B's item appeared in user A's export");
    return "every endpoint resolves inside this document";
  });

  console.log("\nFormats");

  await check("19. the JSON export satisfies the export schema", async () => {
    const built = await buildFor(clientA, projectA);
    assert(built, "load failed");
    const json = renderJson(built.pkg);
    const parsed = exportPackageSchema.safeParse(JSON.parse(json));
    assert(parsed.success, `schema rejected the file: ${parsed.error?.issues[0]?.path.join(".")}`);
    assert(JSON.parse(json).schemaVersion === "reqwise-export/1.0", "wrong schema version");
    return `${json.length} bytes, reqwise-export/1.0`;
  });

  await check("20. the Markdown export carries every required section", async () => {
    const built = await buildFor(clientA, projectA);
    assert(built, "load failed");
    const markdown = renderMarkdown(built.pkg);
    for (const heading of [
      "## Project summary",
      "## Business requirements",
      "## Outstanding stakeholder questions",
      "## Resolved stakeholder questions",
      "## Unresolved quality findings",
      "## Traceability",
      "## Coverage summary",
      "## Source appendix",
      "## Version summary",
      "## Review activity summary",
    ]) {
      assert(markdown.includes(heading), `missing ${heading}`);
    }
    assert(markdown.includes(EXCERPT_ONE), "the cited excerpt is missing");
    assert(!markdown.includes("ยังไม่ได้ข้อสรุป"), "the uncited third line was reproduced");
    return "10 sections, excerpt present, source not reproduced";
  });

  await check("21. CSV escaping survives Thai, quotes, commas and newlines", async () => {
    const built = await buildFor(clientA, projectA);
    assert(built, "load failed");
    const csv = renderRequirementsCsv(built.pkg);
    assert(csv.includes('"ระบบต้องรองรับการจอง ""ออนไลน์""'), "the quoted Thai field is wrong");
    assert(csv.split("\r\n").length > 2, "rows are not CRLF-separated");
    const questions = renderQuestionsCsv(built.pkg);
    assert(questions.includes("ยกเลิกฟรีก่อน 24 ชั่วโมง"), "the answer is missing from the CSV");
    const findings = renderFindingsCsv(built.pkg);
    assert(findings.includes("Ambiguous"), "the finding kind is missing");
    return "quotes doubled, CRLF rows, Thai intact";
  });

  await check("22. a formula-looking value cannot be executed by a spreadsheet", async () => {
    const built = await buildFor(clientA, projectA);
    assert(built, "load failed");
    const csv = renderRequirementsCsv(built.pkg);
    assert(csv.includes("'=SUM(A1:A9) must not be executed"), "the = was not neutralised");
    assert(csv.includes("'-1 discount is out of scope"), "the - was not neutralised");
    assert(!/(^|,)=SUM/m.test(csv), "a raw formula reached a cell");
    return "leading = and - prefixed, words unchanged";
  });

  console.log("\nWhat must never leave");

  await check("23. no raw or validated provider output reaches the export", async () => {
    const built = await buildFor(clientA, projectA);
    assert(built, "load failed");
    const everything = [
      renderJson(built.pkg),
      renderMarkdown(built.pkg),
      renderRequirementsCsv(built.pkg),
      renderQuestionsCsv(built.pkg),
      renderFindingsCsv(built.pkg),
      renderTraceabilityCsv(built.pkg),
    ].join("\n");
    for (const marker of ["RAW-PROVIDER-MARKER", "VALIDATED-MARKER", "raw_provider_output", "validated_output"]) {
      assert(!everything.includes(marker), `${marker} reached the export`);
    }
    assert(!everything.includes("export-verify-"), "a provider key reached the export");
    return "no provider payload, no provider key, in any of the six formats";
  });

  await check("24. no auth user id or membership metadata reaches the export", async () => {
    const built = await buildFor(clientA, projectA);
    assert(built, "load failed");
    const everything = [
      renderJson(built.pkg),
      renderMarkdown(built.pkg),
      renderRequirementsCsv(built.pkg),
      renderQuestionsCsv(built.pkg),
      renderFindingsCsv(built.pkg),
      renderTraceabilityCsv(built.pkg),
    ].join("\n");
    for (const secret of [userA, userB, orgA, orgB, emailA, emailB]) {
      assert(!everything.includes(secret), `${secret.slice(0, 8)}… reached the export`);
    }
    // The review summary exists and still says what happened, without naming anybody.
    const br = built.pkg.requirements.find((item) => item.displayId === "BR-901");
    assert(br?.review.activityCount === 2, `activity count was ${br?.review.activityCount}`);
    assert(br?.review.lastActivity?.label === "Approved", "the last activity is not reported");
    return "no user id, org id or email; review still reported";
  });

  await check("25. repeating an export creates no rows", async () => {
    const before = await snapshotCounts(projectA);
    for (let index = 0; index < 3; index += 1) {
      const built = await buildFor(clientA, projectA);
      assert(built, "load failed");
      renderJson(built.pkg);
    }
    const after = await snapshotCounts(projectA);
    assert(JSON.stringify(before) === JSON.stringify(after), "an export wrote rows");
    return "three exports, zero rows written";
  });

  await check("26. the project's own state is untouched by exporting", async () => {
    const fields =
      "id, status, version_no, title, description, priority, workflow_state, resolution_text";
    const beforeResult = await admin
      .from("analysis_items")
      .select(fields)
      .eq("project_id", projectA)
      .order("display_id", { ascending: true });
    const runBefore = await admin
      .from("analysis_runs")
      .select("id, raw_provider_output, validated_output, validation_status")
      .eq("id", runA)
      .single();

    const built = await buildFor(clientA, projectA, scopeForPreset("audit_package"));
    assert(built, "load failed");
    renderMarkdown(built.pkg);
    renderJson(built.pkg);

    const afterResult = await admin
      .from("analysis_items")
      .select(fields)
      .eq("project_id", projectA)
      .order("display_id", { ascending: true });
    const runAfter = await admin
      .from("analysis_runs")
      .select("id, raw_provider_output, validated_output, validation_status")
      .eq("id", runA)
      .single();

    assert(
      JSON.stringify(beforeResult.data) === JSON.stringify(afterResult.data),
      "an item changed during export",
    );
    assert(
      JSON.stringify(runBefore.data) === JSON.stringify(runAfter.data),
      "the analysis run changed during export",
    );
    return "every item and the run byte-identical before and after";
  });

  const passed = results.filter((result) => result.ok).length;
  console.log(
    "\nVerification rows remain — analysis runs and activities are immutable/append-only by design.",
  );
  console.log("Clear them with:\n");
  console.log("  npx supabase db query --linked -f scripts/verify-db-cleanup.sql\n");
  console.log(`\n${passed}/${results.length} checks passed\n`);
  if (passed !== results.length) process.exit(1);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
