/**
 * Slice 4 / 4.1 runtime verification — deterministic analysis, atomic persistence,
 * and concurrent-safe display id allocation against a real Postgres.
 *
 *   npm run verify:analysis        (needs .env.local pointing at a Supabase project)
 *
 * Runs the real pipeline (mock provider -> validateAnalysis -> normalizeAnalysis)
 * exactly as the app does, and exercises persist_analysis_result() directly for the
 * paths the app pipeline cannot reach on its own (provider_error, a forged item
 * payload, an idempotency collision). No service role and no application backdoor:
 * every write goes through an authenticated user's own client and the RPC's own
 * auth.uid()/membership checks.
 *
 * Since slice 4.1 the mock provider is **input-aware**: it analyses whatever source
 * text it is given and cites exact offsets into that text. The source used below is
 * therefore ordinary meeting notes — the same notes the browser demo types in — not
 * a fixture the provider was built around.
 *
 * Companion to verify-db.mts / verify-projects.mts / verify-sources.mts, same shape.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { runAnalysis } from "../lib/analysis/run-analysis.ts";
import { createMockProvider } from "../lib/providers/mock/mock-provider.ts";
import { assumedWithSource } from "../lib/providers/mock/fixtures/booking-smart-space.invalid.ts";
import {
  createDisplayIdAllocator,
  createFixedClock,
  createSequentialIdFactory,
  type NormalizationPorts,
} from "../lib/normalization/ports.ts";
import { PROVIDER_SCHEMA_VERSION } from "../lib/contracts/provider-output.ts";
import { loadDomainProfileByKey } from "../lib/domain/load-profile.ts";
import type { AnalysisInput } from "../lib/contracts/analysis-input.ts";
import type { DomainProfile } from "../lib/domain/types.ts";
import type { AiProvider } from "../lib/providers/types.ts";
import type { RunAnalysisResult } from "../lib/analysis/run-analysis.ts";

/** The provider-facing key for the single source in these runs. */
const SOURCE_KEY = "meeting-notes-1";

/**
 * Ordinary meeting notes — nothing the provider was written around. This is the text
 * the browser demo enters by hand, kept identical here so the two verifications are
 * describing the same behaviour.
 */
const MEETING_NOTES = [
  "ลูกค้าต้องการจองห้องประชุมผ่านเว็บไซต์ โดยเลือกสาขา ห้อง วันที่ และเวลาได้",
  "พนักงานต้องเห็นรายการจองและตรวจสอบลูกค้าที่มาเช็กอิน",
  "ยังไม่ได้ข้อสรุปเรื่องการยกเลิก การคืนเงิน และช่องทางแจ้งเตือน",
].join("\n");

/** A second, different document — used where a run must be about another source. */
const OTHER_NOTES = [
  "ทีมการตลาดอยากส่งโปรโมชันให้ลูกค้าเก่าผ่านอีเมล",
  "ยังไม่ได้คุยเรื่องการขอความยินยอมและการเก็บข้อมูล",
].join("\n");

/** Returns deliberately-broken output, to reach the `invalid` branch honestly. */
function brokenProvider(): AiProvider {
  return {
    name: "mock",
    deterministic: true,
    async generate(): Promise<unknown> {
      // An `assumed` item carrying a citation — the exact combination the evidence
      // rules exist to reject (AI-OUTPUT-CONTRACT.md §D.6).
      return assumedWithSource;
    },
  };
}

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
const emailA = `reqwise-analysis-a-${stamp}@example.com`;
const emailB = `reqwise-analysis-b-${stamp}@example.com`;

let userA = "";
let userB = "";
let clientA: SupabaseClient;
let clientB: SupabaseClient;
let orgA = "";
let orgB = "";
let profileId = "";
let projectA = "";
let projectArchived = "";
let projectOther = "";
let sourceValidText = "";
let sourceOther = "";
let firstRunId = "";
let firstRequestKey = "";

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

async function newSource(client: SupabaseClient, project: string, creator: string, title: string, text: string) {
  const { data, error } = await client
    .from("source_documents")
    .insert({ project_id: project, title, kind: "meeting_notes", raw_text: text, created_by: creator })
    .select("id")
    .single();
  if (error) throw new Error(`could not create source ${title}: ${error.message}`);
  return data.id as string;
}

function testPorts(): NormalizationPorts {
  return {
    ids: createSequentialIdFactory(),
    clock: createFixedClock("2026-07-25T00:00:00.000Z"),
    displayIds: createDisplayIdAllocator(),
  };
}

/**
 * The domain profile every run below is analysed against, read from the
 * `domain_profiles` table through an authenticated client — never imported from
 * `lib/domain/profiles/*.ts`. Those files are the *authoring* source; the database is
 * the runtime source, and this script has to exercise the runtime one.
 */
let runtimeProfile: DomainProfile;

function inputFor(text: string): AnalysisInput {
  return {
    domainProfile: runtimeProfile,
    sourceDocuments: [{ key: SOURCE_KEY, id: "runtime-source", title: "runtime source", text }],
    outputLang: "th",
  };
}

/** Same shape lib/analysis/persist.ts builds, duplicated here so the RPC is exercised directly. */
function toItemPayload(item: {
  id: string;
  providerKey: string;
  type: string;
  title: string;
  description: string;
  priority: string;
  evidenceClass: string;
  origin: string;
  confidence: number;
  rationale?: string;
  attributes?: Record<string, unknown>;
  sourceReferences: Array<{
    excerpt: string;
    startOffset?: number;
    endOffset?: number;
    evidenceStrength?: number;
    offsetVerified: boolean;
  }>;
}) {
  return {
    local_key: item.id,
    provider_key: item.providerKey,
    item_type: item.type,
    title: item.title,
    description: item.description,
    priority: item.priority,
    evidence_class: item.evidenceClass,
    origin: item.origin,
    confidence: item.confidence,
    rationale: item.rationale ?? null,
    attributes: item.attributes ?? null,
    source_references: item.sourceReferences.map((ref) => ({
      excerpt: ref.excerpt,
      start_offset: ref.startOffset ?? null,
      end_offset: ref.endOffset ?? null,
      evidence_strength: ref.evidenceStrength ?? null,
      offset_verified: ref.offsetVerified,
    })),
  };
}

async function persist(
  client: SupabaseClient,
  project: string,
  source: string,
  requestKey: string | null,
  result: RunAnalysisResult,
) {
  const common = {
    p_project: project,
    p_source: source,
    p_request_key: requestKey,
    p_provider: "mock",
    p_model: null,
    p_prompt_version: null,
    p_schema_version: PROVIDER_SCHEMA_VERSION,
    p_output_lang: "th",
  };
  if (result.status === "valid") {
    return client.rpc("persist_analysis_result", {
      ...common,
      p_validation_status: "valid",
      p_raw_output: result.raw,
      p_validated_output: result.analysis,
      p_error: null,
      p_items: result.analysis.items.map(toItemPayload),
      // Typed since slice 6B. Shaped here rather than imported, like the item payload
      // above, so the RPC's own contract is exercised and not lib/analysis/persist.ts's
      // view of it.
      p_relations: result.analysis.relations.map((relation) => ({
        from_local_key: relation.fromItemId,
        to_local_key: relation.toItemId,
        relation_type: relation.type,
      })),
    });
  }
  if (result.status === "invalid") {
    return client.rpc("persist_analysis_result", {
      ...common,
      p_validation_status: "invalid",
      p_raw_output: result.raw,
      p_validated_output: null,
      p_error: { category: "validation_failed", issues: result.issues },
      p_items: [],
    });
  }
  return client.rpc("persist_analysis_result", {
    ...common,
    p_validation_status: "provider_error",
    p_raw_output: null,
    p_validated_output: null,
    p_error: { category: "provider_error", message: result.error },
    p_items: [],
  });
}

async function main(): Promise<void> {
  console.log(`\nReqWise AI — Slice 4.1 analysis persistence verification against ${URL_}\n`);

  userA = await createUser(emailA, "Analysis A");
  userB = await createUser(emailB, "Analysis B");
  clientA = await signIn(emailA);
  clientB = await signIn(emailB);
  orgA = await personalOrg(userA);
  orgB = await personalOrg(userB);

  const { data: profile } = await clientA.from("domain_profiles").select("id").eq("key", "booking_smart_space").single();
  assert(profile, "the booking_smart_space profile is missing — apply supabase/seed.sql");
  profileId = profile.id;
  // The runtime profile comes from the database, parsed through the same loader the
  // server action uses — not from the TypeScript authoring source.
  runtimeProfile = await loadDomainProfileByKey(clientA, "booking_smart_space");

  projectA = await newProject(clientA, orgA, userA, "Slice 4 analysis verification");
  projectArchived = await newProject(clientA, orgA, userA, "Slice 4 archived project");
  projectOther = await newProject(clientB, orgB, userB, "Slice 4 user B project");

  sourceValidText = await newSource(clientA, projectA, userA, "Kick-off meeting notes", MEETING_NOTES);
  sourceOther = await newSource(clientA, projectA, userA, "Marketing follow-up notes", OTHER_NOTES);

  const provider = createMockProvider();

  // --- 1, 2, 3 -------------------------------------------------------------
  await check("1-3. user A analyses their own source and a valid run persists items", async () => {
    const input = inputFor(MEETING_NOTES);
    const result = await runAnalysis(provider, input, testPorts());
    assert(result.status === "valid", `expected valid, got ${result.status}`);

    firstRequestKey = `verify-${stamp}-a`;
    const { data, error } = await persist(clientA, projectA, sourceValidText, firstRequestKey, result);
    assert(!error, `persist failed: ${error?.message}`);
    assert(data.validation_status === "valid", `run status is ${data.validation_status}`);
    firstRunId = data.run_id;

    const { count, error: countError } = await clientA
      .from("analysis_items")
      .select("id", { count: "exact", head: true })
      .eq("analysis_run_id", firstRunId);
    assert(!countError, `item count failed: ${countError?.message}`);
    assert(count === result.analysis.items.length, `expected ${result.analysis.items.length} items, found ${count}`);
    return `run ${firstRunId.slice(0, 8)}…, ${count} items`;
  });

  // --- 4 ---------------------------------------------------------------
  await check("4. source references match their item and the analysed source", async () => {
    const { data, error } = await clientA
      .from("item_source_references")
      .select("item_id, source_document_id, analysis_items!inner(analysis_run_id)")
      .eq("source_document_id", sourceValidText);
    assert(!error, `reference query failed: ${error?.message}`);
    assert((data ?? []).length > 0, "no source references were written");
    for (const row of data as unknown as Array<{ analysis_items: { analysis_run_id: string } }>) {
      assert(row.analysis_items.analysis_run_id === firstRunId, "a reference belongs to the wrong run");
    }
    return `${data!.length} references, all pointing at the analysed source`;
  });

  // --- 5 -----------------------------------------------------------------
  await check("5. relations resolve from local key to real item id, and carry a real type", async () => {
    const { data, error } = await clientA
      .from("item_relations")
      .select("from_item_id, to_item_id, relation_type")
      .eq("project_id", projectA);
    assert(!error, `relation query failed: ${error?.message}`);
    assert((data ?? []).length > 0, "no relations were written");

    const { data: items, error: itemsError } = await clientA
      .from("analysis_items")
      .select("id")
      .eq("analysis_run_id", firstRunId);
    assert(!itemsError, `item id query failed: ${itemsError?.message}`);
    const knownIds = new Set((items ?? []).map((r) => (r as { id: string }).id));
    const rows = data as unknown as Array<{
      from_item_id: string;
      to_item_id: string;
      relation_type: string;
    }>;
    for (const row of rows) {
      assert(knownIds.has(row.from_item_id), "a relation's from_item_id is outside this run's items");
      assert(knownIds.has(row.to_item_id), "a relation points at an id outside this run's items");
      assert(!/^item-\d+$/.test(row.to_item_id), "a relation still holds a local key instead of a real id");
      // Slice 6B: the type is the provider's own statement, no longer a stand-in.
      assert(
        row.relation_type !== "derives_from",
        "a new run wrote the legacy relation type instead of a typed one",
      );
    }
    const types = [...new Set(rows.map((row) => row.relation_type))].sort();
    return `${rows.length} relations, real item ids, types: ${types.join(", ")}`;
  });

  // --- 6 -----------------------------------------------------------------
  await check("6. every item starts draft", async () => {
    const { data, error } = await clientA.from("analysis_items").select("status").eq("analysis_run_id", firstRunId);
    assert(!error, `status query failed: ${error?.message}`);
    assert((data ?? []).every((r) => (r as { status: string }).status === "draft"), "an item was not born draft");
    return `${data!.length}/${data!.length} draft`;
  });

  // --- 7 -----------------------------------------------------------------
  await check("7. display ids are prefixed by type and unique per project", async () => {
    const { data, error } = await clientA.from("analysis_items").select("display_id, item_type").eq("analysis_run_id", firstRunId);
    assert(!error, `display id query failed: ${error?.message}`);
    const ids = (data ?? []).map((r) => (r as { display_id: string }).display_id);
    assert(new Set(ids).size === ids.length, "a display id collided");
    for (const row of data as unknown as Array<{ display_id: string; item_type: string }>) {
      assert(row.display_id.includes("-"), `malformed display id ${row.display_id}`);
    }
    return `${ids.length} unique display ids, e.g. ${ids[0]}`;
  });

  // --- 8 -----------------------------------------------------------------
  await check("8. the analysed source is locked", async () => {
    const { data, error } = await clientA.rpc("source_document_is_locked", { p_source: sourceValidText });
    assert(!error, `lock check failed: ${error?.message}`);
    assert(data === true, "the source is not reported as locked");
    return "locked";
  });

  // --- 9 -----------------------------------------------------------------
  await check("9. the run still cites the source revision it analysed", async () => {
    const { data, error } = await clientA.from("analysis_runs").select("source_document_id").eq("id", firstRunId).single();
    assert(!error, `run query failed: ${error?.message}`);
    assert(data.source_document_id === sourceValidText, "the run drifted to a different source");
    return "unchanged";
  });

  // --- 10 ----------------------------------------------------------------
  await check("10. re-running the same source creates a new run with new display ids", async () => {
    const input = inputFor(MEETING_NOTES);
    const result = await runAnalysis(provider, input, testPorts());
    assert(result.status === "valid", "second run was not valid");

    const { data, error } = await persist(clientA, projectA, sourceValidText, `verify-${stamp}-b`, result);
    assert(!error, `second persist failed: ${error?.message}`);
    assert(data.run_id !== firstRunId, "the second run reused the first run's id");

    const { data: secondItems, error: itemsError } = await clientA
      .from("analysis_items")
      .select("display_id")
      .eq("analysis_run_id", data.run_id)
      .eq("item_type", "business_requirement");
    assert(!itemsError, `second-run item query failed: ${itemsError?.message}`);

    const { data: firstItems } = await clientA
      .from("analysis_items")
      .select("display_id")
      .eq("analysis_run_id", firstRunId)
      .eq("item_type", "business_requirement");

    assert(
      secondItems![0].display_id !== firstItems![0].display_id,
      "the second run reused the first run's display id",
    );
    return `second run ${String(data.run_id).slice(0, 8)}…, BR display id advanced to ${secondItems![0].display_id}`;
  });

  // --- 11 ----------------------------------------------------------------
  await check("11. the same idempotency key does not create a second run", async () => {
    const before = await clientA.from("analysis_runs").select("id", { count: "exact", head: true }).eq("project_id", projectA);
    const input = inputFor(MEETING_NOTES);
    const result = await runAnalysis(provider, input, testPorts());
    const { data, error } = await persist(clientA, projectA, sourceValidText, firstRequestKey, result);
    assert(!error, `duplicate persist failed: ${error?.message}`);
    assert(data.run_id === firstRunId, "a duplicate request key produced a different run");
    assert(data.duplicate === true, "the RPC did not report the request as a duplicate");
    const after = await clientA.from("analysis_runs").select("id", { count: "exact", head: true }).eq("project_id", projectA);
    assert(before.count === after.count, `run count changed: ${before.count} -> ${after.count}`);
    return `returned the existing run ${firstRunId.slice(0, 8)}…, run count unchanged at ${after.count}`;
  });

  // --- 12 ----------------------------------------------------------------
  await check("12. user B cannot analyse user A's source", async () => {
    const input = inputFor(MEETING_NOTES);
    const result = await runAnalysis(provider, input, testPorts());
    return refused(await persist(clientB, projectA, sourceValidText, `verify-${stamp}-hostile`, result), "user B persisting into user A's project");
  });

  // --- 13 ----------------------------------------------------------------
  await check("13. an archived project cannot be analysed", async () => {
    const archivedSource = await newSource(clientA, projectArchived, userA, "About to archive", MEETING_NOTES);
    const { error: archiveError } = await clientA.rpc("archive_project", { p_project: projectArchived });
    assert(!archiveError, `archive failed: ${archiveError?.message}`);

    const input = inputFor(MEETING_NOTES);
    const result = await runAnalysis(provider, input, testPorts());
    const denied = refused(
      await persist(clientA, projectArchived, archivedSource, `verify-${stamp}-archived`, result),
      "persisting into an archived project",
    );

    const { error: restoreError } = await clientA.rpc("restore_project", { p_project: projectArchived });
    assert(!restoreError, `restore failed: ${restoreError?.message}`);
    return denied;
  });

  // --- 14 ----------------------------------------------------------------
  // Since 4.1 the mock analyses whatever it is given, so an invalid run is no longer
  // reachable by feeding it "the wrong text" — which is the point of the change. The
  // rejection path is exercised where it actually lives: output that breaks the
  // evidence rules, from a provider that returns it.
  await check("14. output that breaks the evidence rules produces an invalid run with zero items", async () => {
    const input = inputFor(OTHER_NOTES);
    const result = await runAnalysis(brokenProvider(), input, testPorts());
    assert(result.status === "invalid", `expected invalid, got ${result.status}`);

    const { data, error } = await persist(clientA, projectA, sourceOther, `verify-${stamp}-invalid`, result);
    assert(!error, `persist of the invalid run failed: ${error?.message}`);
    assert(data.validation_status === "invalid", `run status is ${data.validation_status}`);

    const { count } = await clientA.from("analysis_items").select("id", { count: "exact", head: true }).eq("analysis_run_id", data.run_id);
    assert(count === 0, `an invalid run wrote ${count} items`);
    return `run ${String(data.run_id).slice(0, 8)}…, 0 items, ${result.issues.length} validation issues recorded`;
  });

  // --- 15 ----------------------------------------------------------------
  await check("15. a provider error produces a provider_error run with zero items", async () => {
    const result: RunAnalysisResult = { status: "provider_error", error: "simulated provider timeout" };
    const { data, error } = await persist(clientA, projectA, sourceOther, `verify-${stamp}-provider-error`, result);
    assert(!error, `persist of the provider_error run failed: ${error?.message}`);
    assert(data.validation_status === "provider_error", `run status is ${data.validation_status}`);

    const { count } = await clientA.from("analysis_items").select("id", { count: "exact", head: true }).eq("analysis_run_id", data.run_id);
    assert(count === 0, `a provider_error run wrote ${count} items`);
    return `run ${String(data.run_id).slice(0, 8)}…, 0 items`;
  });

  // --- 16 ----------------------------------------------------------------
  await check("16. a broken item payload rolls back the run, items, references and relations", async () => {
    const before = await clientA.from("analysis_runs").select("id", { count: "exact", head: true }).eq("project_id", projectA);

    const badPayload = {
      p_project: projectA,
      p_source: sourceValidText,
      p_request_key: `verify-${stamp}-broken`,
      p_provider: "mock",
      p_model: null,
      p_prompt_version: null,
      p_schema_version: PROVIDER_SCHEMA_VERSION,
      p_output_lang: "th",
      p_validation_status: "valid",
      p_raw_output: {},
      p_validated_output: {},
      p_error: null,
      p_items: [
        {
          local_key: "x",
          provider_key: "x",
          item_type: "not_a_real_type", // forces an enum-cast failure mid-transaction
          title: "broken",
          description: "broken",
          priority: "unassigned",
          evidence_class: "stated",
          origin: "source_analysis",
          confidence: 0.5,
          related_local_keys: [],
          source_references: [],
        },
      ],
    };

    const denied = refused(await clientA.rpc("persist_analysis_result", badPayload), "persisting a malformed item");

    const after = await clientA.from("analysis_runs").select("id", { count: "exact", head: true }).eq("project_id", projectA);
    assert(before.count === after.count, `a failed persist still left a run behind: ${before.count} -> ${after.count}`);
    return `whole transaction rolled back (${denied})`;
  });

  // --- 17 ----------------------------------------------------------------
  await check("17. a source from another project is rejected", async () => {
    const input = inputFor(MEETING_NOTES);
    const result = await runAnalysis(provider, input, testPorts());
    return refused(
      await persist(clientA, projectA, await newSource(clientB, projectOther, userB, "not A's", "x"), `verify-${stamp}-cross-source`, result),
      "persisting a run over a source from another project",
    );
  });

  // --- 18 ----------------------------------------------------------------
  await check("18. a project from another organization is rejected", async () => {
    const input = inputFor(MEETING_NOTES);
    const result = await runAnalysis(provider, input, testPorts());
    return refused(
      await persist(clientA, projectOther, sourceValidText, `verify-${stamp}-cross-org`, result),
      "user A persisting into user B's organization's project",
    );
  });

  // --- 19 ----------------------------------------------------------------
  await check("19. an assumed item may not carry a source reference, even sent directly", async () => {
    const forged = {
      p_project: projectA,
      p_source: sourceValidText,
      p_request_key: `verify-${stamp}-assumed`,
      p_provider: "mock",
      p_model: null,
      p_prompt_version: null,
      p_schema_version: PROVIDER_SCHEMA_VERSION,
      p_output_lang: "th",
      p_validation_status: "valid",
      p_raw_output: {},
      p_validated_output: {},
      p_error: null,
      p_items: [
        {
          local_key: "x",
          provider_key: "x",
          item_type: "assumption",
          title: "forged",
          description: "forged",
          priority: "unassigned",
          evidence_class: "assumed",
          origin: "source_analysis",
          confidence: 0.5,
          rationale: "forged",
          related_local_keys: [],
          source_references: [{ excerpt: "should not be allowed", start_offset: 0, end_offset: 5, offset_verified: false }],
        },
      ],
    };
    return refused(await clientA.rpc("persist_analysis_result", forged), "persisting an assumed item with a source reference");
  });

  // --- 20 ----------------------------------------------------------------
  await check("20. analysis_items cannot be inserted directly from a browser role", async () => {
    return refused(
      await clientA.from("analysis_items").insert({
        project_id: projectA,
        analysis_run_id: firstRunId,
        item_type: "business_requirement",
        display_id: "BR-999",
        provider_key: "forged",
        title: "forged",
        description: "forged",
        evidence_class: "assumed",
        origin: "source_analysis",
        confidence: 0.5,
      }),
      "a direct client insert into analysis_items",
    );
  });

  // --- 21 ----------------------------------------------------------------
  await check("21. an approved item cannot be inserted directly either", async () => {
    return refused(
      await clientA.from("analysis_items").insert({
        project_id: projectA,
        analysis_run_id: firstRunId,
        item_type: "business_requirement",
        display_id: "BR-998",
        provider_key: "forged-approved",
        title: "forged",
        description: "forged",
        evidence_class: "assumed",
        origin: "source_analysis",
        confidence: 0.5,
        status: "approved",
      }),
      "a direct client insert of a pre-approved item",
    );
  });

  // --- 22 ----------------------------------------------------------------
  await check("22. the cited source revision still refuses update and delete", async () => {
    const text = refused(
      await clientA.from("source_documents").update({ raw_text: "rewritten after analysis" }).eq("id", sourceValidText),
      "rewriting a revision an analysis run cites",
    );
    // RLS has no DELETE policy at all, so a delete attempt matches zero rows and
    // returns success rather than an error — same contract proven in
    // verify-sources.mts check 11. Either an error, or zero rows, counts as refused.
    const { data: deletedRows, error: deleteError } = await clientA
      .from("source_documents")
      .delete()
      .eq("id", sourceValidText)
      .select("id");
    assert(deleteError || (deletedRows ?? []).length === 0, "a cited source revision was hard-deleted");
    const del = deleteError ? deleteError.message.split("\n")[0] : "no rows matched (no DELETE policy)";
    return `update refused (${text}); delete refused/no-op (${del})`;
  });

  // === slice 4.1 ==========================================================

  type Range = { start_number: number; end_number: number };

  async function allocate(client: SupabaseClient, project: string, prefix: string, count: number) {
    return client.rpc("allocate_display_number_range", {
      p_project: project,
      p_prefix: prefix,
      p_count: count,
    });
  }

  // --- 23 ----------------------------------------------------------------
  await check("23. a range of one and a range of many are both reserved whole", async () => {
    const rangeProject = await newProject(clientA, orgA, userA, "Slice 4 range allocation");

    const one = await allocate(clientA, rangeProject, "BR", 1);
    assert(!one.error, `allocating 1 failed: ${one.error?.message}`);
    const first = (one.data as Range[])[0];
    assert(first.start_number === 1 && first.end_number === 1, `expected [1,1], got [${first.start_number},${first.end_number}]`);

    const many = await allocate(clientA, rangeProject, "FR", 12);
    assert(!many.error, `allocating 12 failed: ${many.error?.message}`);
    const second = (many.data as Range[])[0];
    assert(
      second.end_number - second.start_number + 1 === 12,
      `expected a span of 12, got ${second.start_number}..${second.end_number}`,
    );
    return `BR [${first.start_number},${first.end_number}], FR [${second.start_number},${second.end_number}]`;
  });

  // --- 24 ----------------------------------------------------------------
  await check("24. an invalid count or prefix is refused, and a non-member cannot allocate", async () => {
    const zero = refused(await allocate(clientA, projectA, "BR", 0), "allocating a range of 0");
    refused(await allocate(clientA, projectA, "BR", -3), "allocating a negative range");
    const badPrefix = refused(await allocate(clientA, projectA, "br-1", 1), "allocating with a malformed prefix");
    const outsider = refused(await allocate(clientB, projectA, "BR", 1), "user B allocating in user A's project");
    return `count 0 (${zero}); bad prefix (${badPrefix}); non-member (${outsider})`;
  });

  // --- 25 ----------------------------------------------------------------
  await check("25. concurrent runs on one project get non-overlapping display ids", async () => {
    const raceProject = await newProject(clientA, orgA, userA, "Slice 4 concurrent runs");
    const raceSource = await newSource(clientA, raceProject, userA, "Concurrent notes", MEETING_NOTES);

    const input = inputFor(MEETING_NOTES);
    const result = await runAnalysis(provider, input, testPorts());
    assert(result.status === "valid", "the concurrent fixture run was not valid");

    // Fired together, not awaited in turn: the two persists genuinely overlap, so the
    // per-(project, prefix) lock is what has to separate them.
    const [runOne, runTwo] = await Promise.all([
      persist(clientA, raceProject, raceSource, `verify-${stamp}-race-1`, result),
      persist(clientA, raceProject, raceSource, `verify-${stamp}-race-2`, result),
    ]);
    assert(!runOne.error, `concurrent run 1 failed: ${runOne.error?.message}`);
    assert(!runTwo.error, `concurrent run 2 failed: ${runTwo.error?.message}`);
    assert(runOne.data.run_id !== runTwo.data.run_id, "both concurrent calls returned the same run");

    const { data: rows, error } = await clientA
      .from("analysis_items")
      .select("analysis_run_id, item_type, display_id")
      .eq("project_id", raceProject);
    assert(!error, `item query failed: ${error?.message}`);

    const items = (rows ?? []) as Array<{ analysis_run_id: string; item_type: string; display_id: string }>;
    const ids = items.map((i) => i.display_id);
    assert(new Set(ids).size === ids.length, "two items in the same project share a display id");

    // Per prefix, each run's numbers must form one block that does not interleave
    // with the other run's — that is what "reserved range" means, and a per-item
    // allocation under contention would not produce it.
    const byPrefix = new Map<string, Map<string, number[]>>();
    for (const item of items) {
      const prefix = item.display_id.replace(/-\d+$/, "");
      const number = Number(item.display_id.replace(/^[A-Z]+-/, ""));
      const runs = byPrefix.get(prefix) ?? new Map<string, number[]>();
      runs.set(item.analysis_run_id, [...(runs.get(item.analysis_run_id) ?? []), number]);
      byPrefix.set(prefix, runs);
    }

    let checkedPrefixes = 0;
    for (const [prefix, runs] of byPrefix) {
      if (runs.size < 2) continue;
      checkedPrefixes += 1;
      const spans = [...runs.values()].map((numbers) => ({
        min: Math.min(...numbers),
        max: Math.max(...numbers),
      }));
      spans.sort((a, b) => a.min - b.min);
      for (let i = 1; i < spans.length; i += 1) {
        assert(
          spans[i].min > spans[i - 1].max,
          `${prefix}: ranges overlap — [${spans[i - 1].min},${spans[i - 1].max}] and [${spans[i].min},${spans[i].max}]`,
        );
      }
    }
    assert(checkedPrefixes > 0, "no prefix was written by both runs — the test proved nothing");

    // The high-water mark ends where the committed rows end.
    const after = await allocate(clientA, raceProject, "BR", 1);
    assert(!after.error, `post-race allocation failed: ${after.error?.message}`);
    const brNumbers = items
      .filter((i) => i.display_id.startsWith("BR-"))
      .map((i) => Number(i.display_id.replace(/^[A-Z]+-/, "")));
    const expected = Math.max(...brNumbers) + 1;
    const actual = (after.data as Range[])[0].start_number;
    assert(actual === expected, `high-water mark is ${actual}, expected ${expected}`);

    return `${items.length} items across 2 concurrent runs, ${checkedPrefixes} shared prefixes, no overlap; next BR is ${actual}`;
  });

  // --- 26 ----------------------------------------------------------------
  await check("26. a rolled-back run leaves the high-water mark where it was", async () => {
    const before = await allocate(clientA, projectA, "BR", 1);
    assert(!before.error, `allocation failed: ${before.error?.message}`);
    const mark = (before.data as Range[])[0].start_number;

    // A payload that fails partway: the first item is fine, the second is not.
    const doomed = await clientA.rpc("persist_analysis_result", {
      p_project: projectA,
      p_source: sourceValidText,
      p_request_key: `verify-${stamp}-rollback`,
      p_provider: "mock",
      p_model: null,
      p_prompt_version: null,
      p_schema_version: PROVIDER_SCHEMA_VERSION,
      p_output_lang: "th",
      p_validation_status: "valid",
      p_raw_output: {},
      p_validated_output: {},
      p_error: null,
      p_items: [
        {
          local_key: "ok",
          provider_key: "ok",
          item_type: "business_requirement",
          title: "fine",
          description: "fine",
          priority: "unassigned",
          evidence_class: "assumed",
          origin: "source_analysis",
          confidence: 0.5,
          rationale: "fine",
          related_local_keys: [],
          source_references: [],
        },
        {
          local_key: "bad",
          provider_key: "bad",
          item_type: "business_requirement",
          title: "broken",
          description: "broken",
          priority: "unassigned",
          // An assumed item carrying a citation — refused at the write boundary.
          evidence_class: "assumed",
          origin: "source_analysis",
          confidence: 0.5,
          rationale: "broken",
          related_local_keys: [],
          source_references: [{ excerpt: "x", start_offset: 0, end_offset: 1, offset_verified: false }],
        },
      ],
    });
    const denied = refused(doomed, "persisting a payload that fails partway");

    const after = await allocate(clientA, projectA, "BR", 1);
    assert(!after.error, `allocation after rollback failed: ${after.error?.message}`);
    const markAfter = (after.data as Range[])[0].start_number;
    assert(markAfter === mark, `the mark moved from ${mark} to ${markAfter} despite a rollback`);

    // And no half-written item survived under a number that was never committed.
    const { count } = await clientA
      .from("analysis_items")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectA)
      .eq("provider_key", "ok");
    assert(count === 0, "an item from the failed transaction survived");
    return `rolled back (${denied}); mark unchanged at ${mark}, no orphan item`;
  });

  // --- 27 ----------------------------------------------------------------
  await check("27. an idempotency key is bound to the context it was first used with", async () => {
    const input = inputFor(MEETING_NOTES);
    const result = await runAnalysis(provider, input, testPorts());
    assert(result.status === "valid", "the idempotency fixture run was not valid");

    // Same key, same context → the original run, and nothing new written.
    const before = await clientA
      .from("analysis_items")
      .select("id", { count: "exact", head: true })
      .eq("analysis_run_id", firstRunId);
    const retry = await persist(clientA, projectA, sourceValidText, firstRequestKey, result);
    assert(!retry.error, `same-context retry failed: ${retry.error?.message}`);
    assert(retry.data.run_id === firstRunId, "a same-context retry produced a different run");
    const after = await clientA
      .from("analysis_items")
      .select("id", { count: "exact", head: true })
      .eq("analysis_run_id", firstRunId);
    assert(before.count === after.count, `retry changed the item count: ${before.count} -> ${after.count}`);

    // Same key, different source → refused, rather than answering with the other run.
    const wrongSource = refused(
      await persist(clientA, projectA, sourceOther, firstRequestKey, result),
      "reusing a request key for a different source",
    );

    // Same key, different output language → also refused.
    const wrongLang = refused(
      await clientA.rpc("persist_analysis_result", {
        p_project: projectA,
        p_source: sourceValidText,
        p_request_key: firstRequestKey,
        p_provider: "mock",
        p_model: null,
        p_prompt_version: null,
        p_schema_version: PROVIDER_SCHEMA_VERSION,
        p_output_lang: "en",
        p_validation_status: "provider_error",
        p_raw_output: null,
        p_validated_output: null,
        p_error: { category: "provider_error", message: "x" },
        p_items: [],
      }),
      "reusing a request key with a different output language",
    );

    return `same context returned ${firstRunId.slice(0, 8)}… with no new rows; different source (${wrongSource}); different language (${wrongLang})`;
  });
}

function cleanupNotice(): void {
  if (!projectA && !userA) return;
  console.log(
    "\nVerification rows remain — analysis runs and items are immutable/append-only by design.\n" +
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
