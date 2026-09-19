/**
 * Phase 2, Slice 4 runtime verification — `add_manual_requirement()`, against a real
 * Postgres. Scaffolded now, ahead of the app layer (Slice 5), so the RPC itself is
 * proven before any UI is built against it.
 *
 *   npm run verify:manual-add        (needs .env.local pointing at a Supabase project,
 *                                      with 20260920000028/…029 already applied)
 *
 * Every user-facing assertion runs on an authenticated user's own client, so RLS and
 * the RPC's own auth.uid()/membership/active checks are what is being measured. The
 * service role appears only to build fixtures.
 *
 * Companion to verify-workflow / verify-review, same shape.
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
const emailA = `reqwise-manual-add-a-${stamp}@example.com`;
const emailB = `reqwise-manual-add-b-${stamp}@example.com`;

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

async function newSource(project: string, creator: string, title: string): Promise<string> {
  const { data, error } = await admin
    .from("source_documents")
    .insert({ project_id: project, title, kind: "meeting_notes", raw_text: "Some notes.", created_by: creator })
    .select("id")
    .single();
  if (error) throw new Error(`could not create source: ${error.message}`);
  return data.id as string;
}

function addRequirement(
  client: SupabaseClient,
  args: {
    p_project: string;
    p_item_type: string;
    p_title: string;
    p_description: string;
    p_priority: string;
    p_source?: string | null;
    p_excerpt?: string | null;
    p_evidence_class?: string;
  },
) {
  return client.rpc("add_manual_requirement", args);
}

async function main(): Promise<void> {
  console.log("\nReqWise AI — Phase 2, Slice 4 manual-add-requirement verification\n");

  const userA = await createUser(emailA);
  const userB = await createUser(emailB);
  const clientA = await signIn(emailA);
  const clientB = await signIn(emailB);
  const orgA = await personalOrg(userA);
  const orgB = await personalOrg(userB);

  const { data: profile } = await admin.from("domain_profiles").select("id").limit(1).single();
  const profileId = (profile as { id: string }).id;

  const projectA = await newProject(orgA, userA, `Manual add A ${stamp}`, profileId);
  const projectB = await newProject(orgB, userB, `Manual add B ${stamp}`, profileId);
  const sourceA = await newSource(projectA, userA, "Source A");

  let itemId = "";
  await check("1. a member adds a manual requirement — draft, origin manual, no run", async () => {
    const result = await addRequirement(clientA, {
      p_project: projectA,
      p_item_type: "business_requirement",
      p_title: "Manually added requirement",
      p_description: "Written directly by an analyst, not by an analysis run.",
      p_priority: "medium",
    });
    assert(!result.error, `add failed: ${result.error?.message}`);
    itemId = (result.data as { item_id: string }).item_id;

    const { data } = await admin
      .from("analysis_items")
      .select("status, origin, analysis_run_id, display_id, confidence")
      .eq("id", itemId)
      .single();
    const row = data as { status: string; origin: string; analysis_run_id: string | null; display_id: string };
    assert(row.status === "draft", `status is '${row.status}'`);
    assert(row.origin === "manual", `origin is '${row.origin}'`);
    assert(row.analysis_run_id === null, "analysis_run_id is not null");
    assert(/^BR-\d{3}$/.test(row.display_id), `display_id is '${row.display_id}'`);
    return `${row.display_id}, draft, manual, no run`;
  });

  await check("2. a linked source excerpt is stored in the same transaction", async () => {
    const result = await addRequirement(clientA, {
      p_project: projectA,
      p_item_type: "functional_requirement",
      p_title: "Requirement with a citation",
      p_description: "Cites a real excerpt from the source.",
      p_priority: "high",
      p_source: sourceA,
      p_excerpt: "Some notes.",
    });
    assert(!result.error, `add failed: ${result.error?.message}`);
    const newItemId = (result.data as { item_id: string }).item_id;

    const { data } = await admin
      .from("item_source_references")
      .select("excerpt, source_document_id, offset_verified")
      .eq("item_id", newItemId);
    const refs = (data ?? []) as Array<{ excerpt: string; offset_verified: boolean }>;
    assert(refs.length === 1, `expected 1 reference, got ${refs.length}`);
    assert(refs[0].excerpt === "Some notes.", "excerpt does not match");
    assert(refs[0].offset_verified === false, "a pasted excerpt must not claim verified offsets");
    return "excerpt stored, offsets null, unverified";
  });

  await check("3. an assumed item may not carry a source excerpt", async () => {
    const message = refused(
      await addRequirement(clientA, {
        p_project: projectA,
        p_item_type: "risk",
        p_title: "Contradiction",
        p_description: "Assumed but cited — should be refused.",
        p_priority: "low",
        p_source: sourceA,
        p_excerpt: "Some notes.",
        p_evidence_class: "assumed",
      }),
      "an assumed item with a citation",
    );
    return message.slice(0, 60);
  });

  await check("4. open_question and quality_finding are refused — they have their own doors", async () => {
    const asQuestion = refused(
      await addRequirement(clientA, {
        p_project: projectA,
        p_item_type: "open_question",
        p_title: "Not this way",
        p_description: "Questions come from the workflow RPCs, not this one.",
        p_priority: "medium",
      }),
      "a manual open_question",
    );
    const asFinding = refused(
      await addRequirement(clientA, {
        p_project: projectA,
        p_item_type: "quality_finding",
        p_title: "Not this way either",
        p_description: "Findings come from the analysis engine.",
        p_priority: "medium",
      }),
      "a manual quality_finding",
    );
    return `${asQuestion.slice(0, 30)}… / ${asFinding.slice(0, 30)}…`;
  });

  await check("5. a source from a different project cannot be cited", async () => {
    const sourceB = await newSource(projectB, userB, "Source B");
    const message = refused(
      await addRequirement(clientA, {
        p_project: projectA,
        p_item_type: "business_rule",
        p_title: "Cross-project citation",
        p_description: "Cites a source that belongs to a different project.",
        p_priority: "medium",
        p_source: sourceB,
        p_excerpt: "text",
      }),
      "citing another project's source",
    );
    return message.slice(0, 60);
  });

  await check("6. a non-member is refused with the same message as 'not found'", async () => {
    const message = refused(
      await addRequirement(clientB, {
        p_project: projectA,
        p_item_type: "business_requirement",
        p_title: "Outsider's requirement",
        p_description: "An outsider trying to write into someone else's project.",
        p_priority: "medium",
      }),
      "an outsider adding to another tenant's project",
    );
    assert(/not found|not visible/i.test(message), `the refusal leaked more than 'not found': ${message}`);
    return message.slice(0, 60);
  });

  await check("7. an empty title and an empty description are both refused", async () => {
    const emptyTitle = refused(
      await addRequirement(clientA, {
        p_project: projectA,
        p_item_type: "assumption",
        p_title: "   ",
        p_description: "A real description.",
        p_priority: "medium",
      }),
      "a whitespace-only title",
    );
    const emptyDesc = refused(
      await addRequirement(clientA, {
        p_project: projectA,
        p_item_type: "assumption",
        p_title: "A real title",
        p_description: "",
        p_priority: "medium",
      }),
      "an empty description",
    );
    return `${emptyTitle.slice(0, 30)}… / ${emptyDesc.slice(0, 30)}…`;
  });

  await check("8. an archived project refuses a manual add", async () => {
    const archived = await clientA.rpc("archive_project", { p_project: projectA, p_reason: "verification" });
    assert(!archived.error, `archive failed: ${archived.error?.message}`);
    const message = refused(
      await addRequirement(clientA, {
        p_project: projectA,
        p_item_type: "constraint",
        p_title: "Too late",
        p_description: "The project is archived by now.",
        p_priority: "low",
      }),
      "adding to an archived project",
    );
    const restored = await clientA.rpc("restore_project", { p_project: projectA });
    assert(!restored.error, `restore failed: ${restored.error?.message}`);
    return message.slice(0, 60);
  });
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
