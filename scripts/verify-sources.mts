/**
 * Slice 3 runtime verification — source documents, locking and revisions against a
 * real Postgres.
 *
 *   npm run verify:sources        (needs .env.local pointing at a Supabase project)
 *
 * Eighteen assertions about things the application layer cannot be trusted to enforce
 * on its own: who may write a source where, what freezes it, what a frozen revision
 * refuses, and whether a chain of revisions can be forged.
 *
 * Analysis runs are created directly here, with an authenticated user's own client, to
 * put a source into the locked state. That is the runtime test setup doing what a
 * later slice's UI will do — no application backdoor is added to make this possible,
 * and the insert goes through exactly the RLS policy the real feature will use.
 *
 * Companion to verify-db.mts and verify-projects.mts, same shape. Not part of
 * `npm test`: this one needs a network and writes real rows.
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

function row<T>(
  result: { data: unknown; error: { message: string } | null },
  what: string,
): T {
  assert(!result.error, `${what} failed: ${result.error?.message}`);
  assert(result.data, `${what} returned no row`);
  return result.data as T;
}

type SourceRow = {
  id: string;
  title: string;
  raw_text: string;
  revision_number: number;
  document_key: string;
  supersedes_source_document_id: string | null;
  metadata: Record<string, string> | null;
};

/**
 * The text every verbatim assertion is made against. Leading spaces, a blank-line run,
 * a tab, Thai and English, a trailing newline — every one of them is something a
 * careless `.trim()` or newline normalisation would destroy.
 */
const VERBATIM =
  "  Front desk meeting\n\n\n\t- ผู้ใช้ต้องการจองห้องได้ทันที\r\n- Walk-in guests need same-day booking.\n";

const stamp = Date.now();
const password = `Verify!${stamp}`;
const emailA = `reqwise-src-a-${stamp}@example.com`;
const emailB = `reqwise-src-b-${stamp}@example.com`;

let userA = "";
let userB = "";
let clientA: SupabaseClient;
let clientB: SupabaseClient;
let orgA = "";
let profileId = "";
let projectA = "";
let projectArchived = "";
let projectOther = "";
let sourceRev1 = "";
let sourceRev2 = "";
let documentKey = "";
let archivedSource = "";

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

async function newProject(
  client: SupabaseClient,
  org: string,
  creator: string,
  name: string,
): Promise<string> {
  const { data, error } = await client
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
  return data.id;
}

/** What a later slice's "run analysis" will do, issued here as the test's setup. */
async function analyse(client: SupabaseClient, project: string, source: string, actor: string) {
  return client.from("analysis_runs").insert({
    project_id: project,
    source_document_id: source,
    provider: "mock",
    schema_version: "1.0.0",
    output_lang: "th",
    validation_status: "valid",
    validated_output: { items: [] },
    created_by: actor,
  });
}

async function main(): Promise<void> {
  console.log(`\nReqWise AI — Slice 3 source document verification against ${URL_}\n`);

  userA = await createUser(emailA, "Source A");
  userB = await createUser(emailB, "Source B");
  clientA = await signIn(emailA);
  clientB = await signIn(emailB);
  orgA = await personalOrg(userA);
  const orgB = await personalOrg(userB);

  const { data: profile } = await clientA
    .from("domain_profiles")
    .select("id")
    .eq("key", "booking_smart_space")
    .single();
  assert(profile, "the booking_smart_space profile is missing — apply supabase/seed.sql");
  profileId = profile.id;

  projectA = await newProject(clientA, orgA, userA, "Slice 3 source verification");
  projectArchived = await newProject(clientA, orgA, userA, "Slice 3 archived project");
  projectOther = await newProject(clientB, orgB, userB, "User B's project");

  // --- 1 -----------------------------------------------------------------
  await check("1. a user can add a source to their own active project", async () => {
    const { data, error } = await clientA
      .from("source_documents")
      .insert({
        project_id: projectA,
        title: "Kick-off meeting",
        kind: "meeting_notes",
        raw_text: VERBATIM,
        metadata: { sourceDate: "2026-07-24", stakeholder: "Front Desk Manager" },
        created_by: userA,
      })
      .select("id, revision_number, document_key")
      .single();

    assert(!error, `insert failed: ${error?.message}`);
    sourceRev1 = data.id;
    documentKey = data.document_key;
    return `source ${data.id.slice(0, 8)}…`;
  });

  // --- 2 -----------------------------------------------------------------
  await check("2. a first source is revision 1 with no predecessor", async () => {
    const data = row<SourceRow>(
      await clientA
        .from("source_documents")
        .select("id, title, raw_text, revision_number, document_key, supersedes_source_document_id, metadata")
        .eq("id", sourceRev1)
        .single(),
      "reading the source",
    );

    assert(data.revision_number === 1, `revision is ${data.revision_number}`);
    assert(data.supersedes_source_document_id === null, "a first revision has a predecessor");

    // Revision identity cannot be dictated at insert time either.
    const denied = refused(
      await clientA.from("source_documents").insert({
        project_id: projectA,
        title: "forged",
        raw_text: "x",
        revision_number: 7,
        created_by: userA,
      }),
      "inserting a source claiming revision 7",
    );
    return `revision 1; forged revision refused (${denied})`;
  });

  // --- 3 -----------------------------------------------------------------
  await check("3. raw text survives the round trip character for character", async () => {
    const data = row<SourceRow>(
      await clientA.from("source_documents").select("raw_text").eq("id", sourceRev1).single(),
      "reading the raw text",
    );

    assert(data.raw_text === VERBATIM, "the stored text differs from what was written");
    assert(data.raw_text.startsWith("  "), "leading whitespace was trimmed");
    assert(data.raw_text.endsWith("\n"), "the trailing newline was trimmed");
    assert(data.raw_text.includes("\n\n\n"), "blank lines were collapsed");
    assert(data.raw_text.includes("\r\n"), "CRLF was normalised");
    assert(data.raw_text.includes("\t"), "a tab was lost");

    // The offset contract Phase 4 depends on.
    const needle = "same-day booking";
    const start = data.raw_text.indexOf(needle);
    assert(
      data.raw_text.substring(start, start + needle.length) === needle,
      "substring addressing does not survive persistence",
    );
    return `${data.raw_text.length} characters, offsets intact`;
  });

  // --- 4 -----------------------------------------------------------------
  await check("4. user B cannot see user A's source, by list or by id", async () => {
    const { data: list } = await clientB.from("source_documents").select("id");
    assert((list ?? []).length === 0, `user B sees ${list?.length} sources`);

    const { data: direct } = await clientB
      .from("source_documents")
      .select("id, title")
      .eq("id", sourceRev1)
      .maybeSingle();
    assert(direct === null, "user B can read user A's source by id");
    return "0 rows by list, null by direct id";
  });

  // --- 5 -----------------------------------------------------------------
  await check("5. user B cannot add a source to user A's project", async () => {
    return refused(
      await clientB.from("source_documents").insert({
        project_id: projectA,
        title: "trespass",
        raw_text: "should not exist",
        created_by: userB,
      }),
      "user B inserting into user A's project",
    );
  });

  // --- 6 -----------------------------------------------------------------
  await check("6. an unanalysed source can be edited in place", async () => {
    const { error } = await clientA
      .from("source_documents")
      .update({ title: "Kick-off meeting (corrected)", raw_text: `${VERBATIM}- one more line\n` })
      .eq("id", sourceRev1);
    assert(!error, `edit failed: ${error?.message}`);

    const data = row<SourceRow>(
      await clientA
        .from("source_documents")
        .select("title, raw_text, revision_number")
        .eq("id", sourceRev1)
        .single(),
      "re-reading the source",
    );
    assert(data.title === "Kick-off meeting (corrected)", "the title did not change");
    assert(data.revision_number === 1, "editing in place created a revision");
    return "edited in place, still revision 1";
  });

  // --- 7 -----------------------------------------------------------------
  await check("7. an archived project refuses a new source", async () => {
    const { error: archiveError } = await clientA.rpc("archive_project", {
      p_project: projectArchived,
      p_reason: "slice 3 verification",
    });
    assert(!archiveError, `archive failed: ${archiveError?.message}`);

    return refused(
      await clientA.from("source_documents").insert({
        project_id: projectArchived,
        title: "after archiving",
        raw_text: "should not exist",
        created_by: userA,
      }),
      "adding a source to an archived project",
    );
  });

  // --- 8 -----------------------------------------------------------------
  await check("8. an archived project refuses an edit to an existing source", async () => {
    // A source added while the project was still active, then archived around it.
    const created = row<SourceRow>(
      await clientA
        .from("source_documents")
        .insert({
          project_id: projectA,
          title: "Second document",
          raw_text: "will be frozen by archiving\n",
          created_by: userA,
        })
        .select("id")
        .single(),
      "creating the second source",
    );
    archivedSource = created.id;

    const { error: archiveError } = await clientA.rpc("archive_project", { p_project: projectA });
    assert(!archiveError, `archive failed: ${archiveError?.message}`);

    const denied = refused(
      await clientA
        .from("source_documents")
        .update({ title: "edited while archived" })
        .eq("id", archivedSource),
      "editing a source under an archived project",
    );

    const { error: restoreError } = await clientA.rpc("restore_project", { p_project: projectA });
    assert(!restoreError, `restore failed: ${restoreError?.message}`);
    return denied;
  });

  // --- 9 -----------------------------------------------------------------
  await check("9. an analysis run locks the revision it references", async () => {
    const { error } = await analyse(clientA, projectA, sourceRev1, userA);
    assert(!error, `creating the analysis run failed: ${error?.message}`);

    const { data: locked, error: lockError } = await clientA.rpc("source_document_is_locked", {
      p_source: sourceRev1,
    });
    assert(!lockError, `lock check failed: ${lockError?.message}`);
    assert(locked === true, "the source is not reported as locked");
    return "locked by an analysis run";
  });

  // --- 10 ----------------------------------------------------------------
  await check("10. a locked revision refuses every edit", async () => {
    const text = refused(
      await clientA.from("source_documents").update({ raw_text: "rewritten" }).eq("id", sourceRev1),
      "rewriting locked evidence",
    );
    refused(
      await clientA.from("source_documents").update({ title: "retitled" }).eq("id", sourceRev1),
      "retitling a locked revision",
    );
    refused(
      await clientA
        .from("source_documents")
        .update({ metadata: { stakeholder: "someone else" } })
        .eq("id", sourceRev1),
      "changing locked metadata",
    );
    return `whole record frozen (${text})`;
  });

  // --- 11 ----------------------------------------------------------------
  await check("11. a source cannot be hard-deleted, locked or not", async () => {
    // Two mechanisms, in this order: RLS has no DELETE policy, so PostgREST matches
    // nothing and returns success with zero rows rather than raising. The
    // source_documents_no_delete trigger is the second line, and the one that answers
    // even the service role — proven by the fact that verification rows can only be
    // cleared by a script that disables triggers.
    const { data: rows, error } = await clientA
      .from("source_documents")
      .delete()
      .eq("id", sourceRev1)
      .select("id");
    assert(error || (rows ?? []).length === 0, "a locked source was hard-deleted");

    const { data: still } = await clientA
      .from("source_documents")
      .select("id")
      .eq("id", sourceRev1)
      .maybeSingle();
    assert(still, "the source disappeared after a delete attempt");

    // And the trigger itself, exercised where RLS is not in the way.
    const viaService = await admin.from("source_documents").delete().eq("id", sourceRev1);
    const triggerSaid = refused(viaService, "a service-role delete of a source");

    return error
      ? error.message.split("\n")[0]
      : `no rows matched (no DELETE policy); trigger: ${triggerSaid}`;
  });

  // --- 12 ----------------------------------------------------------------
  await check("12. revision 2 can be created from a locked revision 1", async () => {
    const previous = row<SourceRow>(
      await clientA
        .from("source_documents")
        .select("id, document_key, revision_number, raw_text")
        .eq("id", sourceRev1)
        .single(),
      "reading revision 1",
    );

    const { data, error } = await clientA
      .from("source_documents")
      .insert({
        project_id: projectA,
        title: "Kick-off meeting (rev 2)",
        raw_text: `${previous.raw_text}- added after the first analysis\n`,
        created_by: userA,
        document_key: previous.document_key,
        revision_number: previous.revision_number + 1,
        supersedes_source_document_id: previous.id,
      })
      .select("id, revision_number")
      .single();

    assert(!error, `creating revision 2 failed: ${error?.message}`);
    sourceRev2 = data.id;
    assert(data.revision_number === 2, `revision is ${data.revision_number}`);
    return `revision 2 created, and it is editable`;
  });

  // --- 13 ----------------------------------------------------------------
  await check("13. revision 2 points at revision 1 and keeps the document identity", async () => {
    const data = row<SourceRow>(
      await clientA
        .from("source_documents")
        .select("document_key, revision_number, supersedes_source_document_id")
        .eq("id", sourceRev2)
        .single(),
      "reading revision 2",
    );

    assert(data.supersedes_source_document_id === sourceRev1, "revision 2 does not cite revision 1");
    assert(data.document_key === documentKey, "revision 2 started a new document");

    const skipped = refused(
      await clientA.from("source_documents").insert({
        project_id: projectA,
        title: "skips a number",
        raw_text: "x",
        created_by: userA,
        document_key: documentKey,
        revision_number: 9,
        supersedes_source_document_id: sourceRev2,
      }),
      "inserting a revision that skips numbers",
    );
    return `chained; number-skipping refused (${skipped})`;
  });

  // --- 14 ----------------------------------------------------------------
  await check("14. a revision cannot cross projects", async () => {
    const otherProject = await newProject(clientA, orgA, userA, "Slice 3 second project");
    return refused(
      await clientA.from("source_documents").insert({
        project_id: otherProject,
        title: "cross-project revision",
        raw_text: "x",
        created_by: userA,
        document_key: documentKey,
        revision_number: 3,
        supersedes_source_document_id: sourceRev2,
      }),
      "superseding a revision that lives in another project",
    );
  });

  // --- 15 ----------------------------------------------------------------
  await check("15. a duplicate revision number is refused", async () => {
    return refused(
      await clientA.from("source_documents").insert({
        project_id: projectA,
        title: "duplicate revision 2",
        raw_text: "x",
        created_by: userA,
        document_key: documentKey,
        revision_number: 2,
        supersedes_source_document_id: sourceRev1,
      }),
      "creating a second revision 2 of the same document",
    );
  });

  // --- 16 ----------------------------------------------------------------
  await check("16. the original run still cites revision 1, not the new revision", async () => {
    const { data, error } = await clientA
      .from("analysis_runs")
      .select("id, source_document_id")
      .eq("project_id", projectA);

    assert(!error, `reading runs failed: ${error?.message}`);
    assert((data ?? []).length === 1, `expected 1 run, found ${data?.length}`);
    assert(
      data![0].source_document_id === sourceRev1,
      "the run moved to the new revision — history was rewritten",
    );

    const rev1 = row<SourceRow>(
      await clientA.from("source_documents").select("raw_text").eq("id", sourceRev1).single(),
      "re-reading revision 1",
    );
    assert(
      !rev1.raw_text.includes("added after the first analysis"),
      "revision 1 acquired revision 2's text",
    );
    return "revision 1 unchanged and still cited";
  });

  // --- 17 ----------------------------------------------------------------
  await check("17. user B cannot create a revision of user A's source", async () => {
    return refused(
      await clientB.from("source_documents").insert({
        project_id: projectA,
        title: "hostile revision",
        raw_text: "x",
        created_by: userB,
        document_key: documentKey,
        revision_number: 3,
        supersedes_source_document_id: sourceRev2,
      }),
      "user B superseding user A's revision",
    );
  });

  // --- 18 ----------------------------------------------------------------
  await check("18. a source cannot be planted in another organization's project", async () => {
    const denied = refused(
      await clientA.from("source_documents").insert({
        project_id: projectOther,
        title: "cross-organization source",
        raw_text: "should not exist",
        created_by: userA,
      }),
      "inserting into user B's project",
    );

    // And the reverse direction, with a forged creator for good measure.
    refused(
      await clientA.from("source_documents").insert({
        project_id: projectA,
        title: "forged creator",
        raw_text: "x",
        created_by: userB,
      }),
      "inserting a source attributed to another user",
    );
    return `${denied}; forged creator also refused`;
  });
}

function cleanupNotice(): void {
  if (!projectA && !userA) return;
  console.log(
    "\nVerification rows remain — sources and runs are immutable by design.\n" +
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
