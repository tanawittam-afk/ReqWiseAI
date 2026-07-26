/**
 * Slice 6B runtime verification — typed traceability, against a real Postgres.
 *
 *   npm run verify:traceability      (needs .env.local pointing at a Supabase project)
 *
 * Every user-facing assertion runs on an authenticated user's own client, so RLS and
 * the RPC's own auth.uid()/membership checks are what is being measured. The service
 * role appears only to build fixtures, and several times deliberately pointed AT a rule
 * to prove that even it is refused — a rule the application enforces is a convention,
 * a rule the database enforces is a rule.
 *
 * One thing worth knowing before reading the failures: the cycle check is a
 * **deferrable** constraint trigger, so it fires at COMMIT, not at the offending
 * INSERT. A statement that creates a cycle therefore succeeds and the *transaction*
 * fails. Through PostgREST each call is its own transaction, so the effect a caller
 * sees is identical to an immediate refusal — nothing is committed. `deferredRefused`
 * exists to make that explicit rather than surprising.
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
const emailA = `reqwise-tr-a-${stamp}@example.com`;
const emailB = `reqwise-tr-b-${stamp}@example.com`;

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
let runLegacy = "";
let runArchived = "";
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

async function newProject(org: string, creator: string, name: string): Promise<string> {
  const { data, error } = await admin
    .from("projects")
    .insert({ organization_id: org, domain_profile_id: profileId, name, created_by: creator, output_lang: "th" })
    .select("id")
    .single();
  if (error) throw new Error(`could not create project ${name}: ${error.message}`);
  return data.id as string;
}

async function newSource(project: string, creator: string, title: string): Promise<string> {
  const { data, error } = await admin
    .from("source_documents")
    .insert({
      project_id: project,
      title,
      kind: "meeting_notes",
      raw_text: "ลูกค้าอยากจองเองจากมือถือ และเห็นห้องว่างแบบเรียลไทม์ ยังไม่สรุปเรื่องการคืนเงิน",
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

const PREFIX: Record<string, string> = {
  business_objective: "OBJ",
  business_requirement: "BR",
  functional_requirement: "FR",
  non_functional_requirement: "NFR",
  user_story: "US",
  acceptance_criterion: "AC",
  business_rule: "RULE",
  constraint: "CON",
  risk: "RISK",
  open_question: "Q",
  quality_finding: "QF",
  assumption: "ASM",
  problem_statement: "PS",
  stakeholder: "STK",
};

async function newItem(
  project: string,
  run: string,
  itemType: string,
  overrides: Record<string, unknown> = {},
): Promise<string> {
  itemSeq += 1;
  const prefix = PREFIX[itemType] ?? "TST";
  const { data, error } = await admin
    .from("analysis_items")
    .insert({
      project_id: project,
      analysis_run_id: run,
      item_type: itemType,
      display_id: `${prefix}-${String(900 + itemSeq)}`,
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

/** Insert a relation on a user's own client — the path RLS actually governs. */
async function relate(
  client: SupabaseClient,
  project: string,
  from: string,
  to: string,
  type: string,
) {
  return client
    .from("item_relations")
    .insert({ project_id: project, from_item_id: from, to_item_id: to, relation_type: type })
    .select("id");
}

/**
 * A refusal that arrives at COMMIT rather than at the statement.
 *
 * PostgREST wraps each request in its own transaction, so a deferred constraint
 * trigger still means "nothing was committed" for the caller — this asserts both the
 * error and the absence of the row, because the error alone would not prove the second.
 */
async function deferredRefused(
  result: { error: { message: string } | null },
  project: string,
  from: string,
  to: string,
  what: string,
): Promise<string> {
  assert(result.error, `${what} was ALLOWED but must be refused`);
  const { count } = await admin
    .from("item_relations")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project)
    .eq("from_item_id", from)
    .eq("to_item_id", to);
  assert(count === 0, `${what} was refused but the row is still committed`);
  return result.error.message.split("\n")[0];
}

async function relationCount(project: string): Promise<number> {
  const { count } = await admin
    .from("item_relations")
    .select("id", { count: "exact", head: true })
    .eq("project_id", project);
  return count ?? 0;
}

async function main(): Promise<void> {
  console.log(`\nReqWise AI — Slice 6B typed traceability verification against ${URL_}\n`);

  userA = await createUser(emailA, "Trace A");
  userB = await createUser(emailB, "Trace B");
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
  profileId = (profile as { id: string }).id;

  projectA = await newProject(orgA, userA, `Traceability A ${stamp}`);
  projectB = await newProject(orgB, userB, `Traceability B ${stamp}`);
  projectArchived = await newProject(orgA, userA, `Traceability archived ${stamp}`);
  sourceA = await newSource(projectA, userA, "Booking notes");
  runA = await newRun(projectA, sourceA, userA);
  runLegacy = await newRun(projectA, sourceA, userA);

  const sourceArchived = await newSource(projectArchived, userA, "Archived notes");
  runArchived = await newRun(projectArchived, sourceArchived, userA);

  // --- the spine, for the happy-path checks --------------------------------
  const obj = await newItem(projectA, runA, "business_objective");
  const br = await newItem(projectA, runA, "business_requirement");
  const fr = await newItem(projectA, runA, "functional_requirement");
  const us = await newItem(projectA, runA, "user_story");
  const ac = await newItem(projectA, runA, "acceptance_criterion");
  const risk = await newItem(projectA, runA, "risk");
  const rule = await newItem(projectA, runA, "business_rule");
  const question = await newItem(projectA, runA, "open_question", {
    evidence_class: "assumed",
    origin: "domain_profile",
    rationale: "จากโปรไฟล์โดเมน",
  });
  const finding = await newItem(projectA, runA, "quality_finding", {
    evidence_class: "inferred",
    origin: "quality_rule",
    rationale: "กฎคุณภาพ",
  });
  const otherProjectItem = await newItem(projectB, await newRun(projectB, await newSource(projectB, userB, "B notes"), userB), "business_requirement");

  // --- legacy data, written the way every pre-6B run wrote it ---------------
  const legacyBr = await newItem(projectA, runLegacy, "business_requirement");
  const legacyFr = await newItem(projectA, runLegacy, "functional_requirement");
  await admin.from("item_relations").insert({
    project_id: projectA,
    from_item_id: legacyFr,
    to_item_id: legacyBr,
    relation_type: "derives_from",
  });

  console.log("Typed relation contract\n");

  await check("1. a new run persists typed relations through the RPC", async () => {
    // The full RPC path, on the user's own client — this is what the application does.
    const { data, error } = await clientA.rpc("persist_analysis_result", {
      p_project: projectA,
      p_source: sourceA,
      p_request_key: `verify-typed-${stamp}`,
      p_provider: "mock",
      p_model: null,
      p_prompt_version: null,
      p_schema_version: "1.0.0",
      p_output_lang: "th",
      p_validation_status: "valid",
      p_raw_output: { items: [] },
      p_validated_output: { items: [] },
      p_error: null,
      p_items: [
        rpcItem("k-br", "business_requirement"),
        rpcItem("k-fr", "functional_requirement"),
        rpcItem("k-us", "user_story"),
      ],
      p_relations: [
        { from_local_key: "k-br", to_local_key: "k-fr", relation_type: "implemented_by" },
        { from_local_key: "k-fr", to_local_key: "k-us", relation_type: "expressed_as" },
      ],
    });
    assert(!error, `persist failed: ${error?.message}`);
    const runId = (data as { run_id: string }).run_id;

    const { data: rows } = await admin
      .from("item_relations")
      .select("relation_type, analysis_items!item_relations_from_item_id_project_id_fkey (analysis_run_id)")
      .eq("project_id", projectA);
    const types = new Set(
      ((rows ?? []) as Array<{ relation_type: string }>).map((row) => row.relation_type),
    );
    assert(types.has("implemented_by"), "implemented_by was not persisted");
    assert(types.has("expressed_as"), "expressed_as was not persisted");
    return `run ${runId.slice(0, 8)} stored implemented_by + expressed_as`;
  });

  await check("2. a legacy derives_from row still loads and keeps its own label", async () => {
    const { data, error } = await clientA
      .from("item_relations")
      .select("relation_type, from_item_id, to_item_id")
      .eq("project_id", projectA)
      .eq("relation_type", "derives_from");
    assert(!error, `legacy read failed: ${error?.message}`);
    const rows = (data ?? []) as Array<{ from_item_id: string; to_item_id: string }>;
    assert(rows.length === 1, `expected exactly one legacy row, found ${rows.length}`);
    assert(rows[0].from_item_id === legacyFr, "the legacy row changed direction");
    return "unchanged, still derives_from, still child → parent";
  });

  await check("3. an unknown relation type is refused by the enum", async () => {
    const result = await relate(clientA, projectA, br, fr, "totally_made_up");
    return refused(result, "an unknown relation type");
  });

  await check("4. the RPC refuses a local key that is not in the run", async () => {
    const { error } = await clientA.rpc("persist_analysis_result", {
      p_project: projectA,
      p_source: sourceA,
      p_request_key: `verify-missing-key-${stamp}`,
      p_provider: "mock",
      p_model: null,
      p_prompt_version: null,
      p_schema_version: "1.0.0",
      p_output_lang: "th",
      p_validation_status: "valid",
      p_raw_output: { items: [] },
      p_validated_output: { items: [] },
      p_error: null,
      p_items: [rpcItem("k-br", "business_requirement")],
      p_relations: [
        { from_local_key: "k-br", to_local_key: "k-nowhere", relation_type: "implemented_by" },
      ],
    });
    assert(error, "a dangling local key was ALLOWED but must be refused");
    const { count } = await admin
      .from("analysis_runs")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectA)
      .eq("request_key", `verify-missing-key-${stamp}`);
    assert(count === 0, "the run was committed despite the bad relation");
    return `${error.message.split("\n")[0]} — run rolled back whole`;
  });

  await check("5. a self relation is refused", async () => {
    const result = await relate(clientA, projectA, br, br, "related_to");
    return refused(result, "a self relation");
  });

  await check("6. a duplicate relation is refused", async () => {
    const first = await relate(clientA, projectA, obj, br, "supports");
    assert(!first.error, `the first supports insert failed: ${first.error?.message}`);
    const second = await relate(clientA, projectA, obj, br, "supports");
    return refused(second, "a duplicate relation");
  });

  await check("7. a cross-project relation is refused", async () => {
    const result = await relate(clientA, projectA, br, otherProjectItem, "related_to");
    return refused(result, "a cross-project relation");
  });

  await check("8. the boundary holds against the service role too, not just against RLS", async () => {
    /*
     * Pointed AT the rule deliberately: the service role bypasses RLS entirely, so if
     * the project/organization boundary were only a policy this would succeed. It is a
     * trigger, so it does not.
     *
     * Note which message comes back. A project belongs to exactly one organization, so
     * *every* cross-organization relation is also cross-project and the project check
     * fires first — the organization check in `guard_item_relation()` is unreachable
     * defence-in-depth, kept because "implied by the project rule" is how a tenancy
     * leak gets introduced by a later, locally-reasonable schema change. This check
     * proves the boundary, not that particular branch.
     */
    const result = await admin
      .from("item_relations")
      .insert({
        project_id: projectA,
        from_item_id: br,
        to_item_id: otherProjectItem,
        relation_type: "related_to",
      })
      .select("id");
    return refused(result, "a cross-tenant relation via the service role");
  });

  await check("9. an invalid item-type pair is refused", async () => {
    // `implemented_by` runs business_requirement → functional/non-functional; an
    // acceptance criterion is validated_by territory.
    const result = await relate(clientA, projectA, br, ac, "implemented_by");
    return refused(result, "implemented_by pointing at an acceptance criterion");
  });

  await check("10. the valid hierarchy persists end to end", async () => {
    const edges: Array<[string, string, string]> = [
      [br, fr, "implemented_by"],
      [fr, us, "expressed_as"],
      [us, ac, "validated_by"],
      [fr, rule, "constrained_by"],
      [rule, risk, "mitigates"],
      [question, br, "raises_question"],
      [finding, fr, "flags_quality_issue"],
    ];
    for (const [from, to, type] of edges) {
      const result = await relate(clientA, projectA, from, to, type);
      assert(!result.error, `${type} was refused: ${result.error?.message}`);
    }
    return `${edges.length} edges + supports = the whole spine and its observations`;
  });

  await check("11. a hierarchical cycle is refused", async () => {
    // ac → obj closes OBJ → BR → FR → US → AC. `related_to` would not; this is
    // deliberately a spine type, and only the legacy label makes the pair legal.
    const result = await admin
      .from("item_relations")
      .insert({
        project_id: projectA,
        from_item_id: obj,
        to_item_id: ac,
        relation_type: "derives_from",
      })
      .select("id");
    return await deferredRefused(result, projectA, obj, ac, "a hierarchical cycle");
  });

  await check("12. related_to is not treated as hierarchical, so it cannot cycle", async () => {
    const forward = await relate(clientA, projectA, ac, obj, "related_to");
    assert(!forward.error, `related_to forward was refused: ${forward.error?.message}`);
    const backward = await relate(clientA, projectA, obj, ac, "related_to");
    assert(!backward.error, `related_to backward was refused: ${backward.error?.message}`);
    return "both directions stored; no cycle raised";
  });

  await check("13. an invalid relation rolls the whole run back", async () => {
    const before = await relationCount(projectA);
    const { error } = await clientA.rpc("persist_analysis_result", {
      p_project: projectA,
      p_source: sourceA,
      p_request_key: `verify-rollback-${stamp}`,
      p_provider: "mock",
      p_model: null,
      p_prompt_version: null,
      p_schema_version: "1.0.0",
      p_output_lang: "th",
      p_validation_status: "valid",
      p_raw_output: { items: [] },
      p_validated_output: { items: [] },
      p_error: null,
      p_items: [
        rpcItem("r-br", "business_requirement"),
        rpcItem("r-ac", "acceptance_criterion"),
      ],
      p_relations: [
        // Legal.
        { from_local_key: "r-br", to_local_key: "r-ac", relation_type: "validated_by" },
        // Not legal — and the whole run must go, not just this edge.
        { from_local_key: "r-br", to_local_key: "r-ac", relation_type: "implemented_by" },
      ],
    });
    assert(error, "an invalid relation was ALLOWED but must refuse the run");

    const { count: runCount } = await admin
      .from("analysis_runs")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectA)
      .eq("request_key", `verify-rollback-${stamp}`);
    assert(runCount === 0, "the run survived an invalid relation");
    const after = await relationCount(projectA);
    assert(after === before, `relations changed: ${before} → ${after}`);
    return "no run, no items, no relations — nothing partially written";
  });

  await check("14. a new run may not author the legacy relation type", async () => {
    const { error } = await clientA.rpc("persist_analysis_result", {
      p_project: projectA,
      p_source: sourceA,
      p_request_key: `verify-legacy-authored-${stamp}`,
      p_provider: "mock",
      p_model: null,
      p_prompt_version: null,
      p_schema_version: "1.0.0",
      p_output_lang: "th",
      p_validation_status: "valid",
      p_raw_output: { items: [] },
      p_validated_output: { items: [] },
      p_error: null,
      p_items: [rpcItem("l-br", "business_requirement"), rpcItem("l-fr", "functional_requirement")],
      p_relations: [
        { from_local_key: "l-fr", to_local_key: "l-br", relation_type: "derives_from" },
      ],
    });
    assert(error, "derives_from from a new run was ALLOWED but must be refused");
    return error.message.split("\n")[0];
  });

  console.log("\nAuthorization\n");

  await check("15. user B cannot read user A's relations", async () => {
    const { data, error } = await clientB
      .from("item_relations")
      .select("id, relation_type, from_item_id")
      .eq("project_id", projectA);
    assert(!error, `the query errored instead of returning nothing: ${error?.message}`);
    assert((data ?? []).length === 0, `user B read ${(data ?? []).length} of user A's relations`);
    return "zero rows — RLS, not a filter in the application";
  });

  await check("16. user B cannot read user A's items through the traceability path", async () => {
    const { data } = await clientB
      .from("analysis_items")
      .select("id, display_id, title")
      .eq("project_id", projectA);
    assert((data ?? []).length === 0, `user B read ${(data ?? []).length} of user A's items`);
    const { data: project } = await clientB.from("projects").select("id").eq("id", projectA);
    assert((project ?? []).length === 0, "user B can see that user A's project exists");
    return "no items, and no confirmation the project exists";
  });

  await check("17. user B cannot write a relation into user A's project", async () => {
    const result = await relate(clientB, projectA, br, fr, "related_to");
    return refused(result, "a cross-tenant relation write");
  });

  console.log("\nArchived projects\n");

  await check("18. an archived project's traceability is readable", async () => {
    const archBr = await newItem(projectArchived, runArchived, "business_requirement");
    const archFr = await newItem(projectArchived, runArchived, "functional_requirement");
    const before = await relate(clientA, projectArchived, archBr, archFr, "implemented_by");
    assert(!before.error, `could not seed the archived project: ${before.error?.message}`);

    // Archiving goes through its own RPC — a direct status UPDATE is refused by the
    // project-lifecycle trigger, which is itself worth knowing still holds.
    const { error: archiveError } = await clientA.rpc("archive_project", {
      p_project: projectArchived,
      p_reason: "traceability verification",
    });
    assert(!archiveError, `could not archive: ${archiveError?.message}`);

    const { data, error } = await clientA
      .from("item_relations")
      .select("id, relation_type")
      .eq("project_id", projectArchived);
    assert(!error, `archived read failed: ${error?.message}`);
    assert((data ?? []).length === 1, "the archived project's relation is not readable");
    return "matrix, map and coverage all read from this — nothing is hidden by archiving";
  });

  await check("19. an archived project refuses a new relation", async () => {
    const archBr2 = await newItem(projectArchived, runArchived, "business_requirement");
    const archFr2 = await newItem(projectArchived, runArchived, "functional_requirement");
    const result = await relate(clientA, projectArchived, archBr2, archFr2, "implemented_by");
    return refused(result, "a relation written into an archived project");
  });

  console.log("\nCoverage inputs and immutability\n");

  await check("20. the data coverage reads is what a real user actually gets back", async () => {
    // Coverage itself is a pure function, unit-tested. What is verified here is that
    // the *data it reads* is what the database actually returns to a real user.
    const orphan = await newItem(projectA, runA, "risk");
    const approved = await newItem(projectA, runA, "business_requirement", { status: "draft" });
    const rejected = await newItem(projectA, runA, "constraint", { status: "draft" });
    const link = await relate(clientA, projectA, approved, rejected, "related_to");
    assert(!link.error, `could not link: ${link.error?.message}`);

    // Status moves through the review RPC, because a direct UPDATE is refused by the
    // trigger that requires an activity beside every transition.
    const transitions: Array<[string, string, string, string]> = [
      [approved, "draft", "reviewed", "status_change"],
      [approved, "reviewed", "approved", "approve"],
      [rejected, "draft", "rejected", "reject"],
    ];
    for (const [item, from, to, activity] of transitions) {
      const { error } = await clientA.rpc("review_item", {
        p_item_id: item,
        p_activity_type: activity,
        p_to_status: to,
        p_comment: "verification",
        p_expected_status: from,
      });
      assert(!error, `review ${from} → ${to} failed: ${error?.message}`);
    }

    const { data: items } = await clientA
      .from("analysis_items")
      .select("id, item_type, status")
      .eq("project_id", projectA);
    const { data: rels } = await clientA
      .from("item_relations")
      .select("from_item_id, to_item_id")
      .eq("project_id", projectA);

    const linked = new Set<string>();
    for (const row of (rels ?? []) as Array<{ from_item_id: string; to_item_id: string }>) {
      linked.add(row.from_item_id);
      linked.add(row.to_item_id);
    }
    assert(!linked.has(orphan), "the orphan is not detectable — it has a relation");

    const byId = new Map(
      ((items ?? []) as Array<{ id: string; status: string }>).map((row) => [row.id, row.status]),
    );
    assert(byId.get(approved) === "approved", `approved item is ${byId.get(approved)}`);
    assert(byId.get(rejected) === "rejected", `rejected item is ${byId.get(rejected)}`);
    return "orphan unlinked; approved item linked to a rejected one, both visible to the reader";
  });

  await check("21. the raw analysis run is still byte-identical", async () => {
    const { data } = await admin
      .from("analysis_runs")
      .select("raw_provider_output, validated_output, validation_status")
      .eq("id", runA)
      .single();
    const row = data as Record<string, unknown>;
    assert(
      JSON.stringify(row.raw_provider_output) === JSON.stringify({ items: [] }),
      "raw_provider_output changed",
    );
    assert(row.validation_status === "valid", "validation_status changed");
    return "immutable, as it was before this slice touched anything";
  });

  await check("22. review and workflow data are unchanged by traceability reads", async () => {
    const { count: activities } = await admin
      .from("review_activities")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectA);
    const { data: q } = await admin
      .from("analysis_items")
      .select("workflow_state, resolution_text")
      .eq("id", question)
      .single();
    const row = q as { workflow_state: string | null; resolution_text: string | null };
    assert(row.workflow_state === "open", `the question's workflow state is ${row.workflow_state}`);
    assert(row.resolution_text === null, "the question gained a resolution");
    return `${activities ?? 0} activities intact; the question is still open`;
  });
}

/** One element of the RPC's `p_items` array. */
function rpcItem(localKey: string, itemType: string) {
  return {
    local_key: localKey,
    provider_key: localKey,
    item_type: itemType,
    title: `รายการ ${localKey}`,
    description: "Written by the verification script.",
    priority: "unassigned",
    evidence_class: "assumed",
    origin: "source_analysis",
    confidence: 0.5,
    rationale: "ข้อสันนิษฐาน",
    attributes:
      itemType === "user_story"
        ? { as_a: "ลูกค้า", i_want: "จองห้อง", so_that: "ไม่ต้องรอ" }
        : itemType === "acceptance_criterion"
          ? { then: "ระบบยืนยันทันที" }
          : null,
    source_references: [],
  };
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
