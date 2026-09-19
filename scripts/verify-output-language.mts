/**
 * Phase 2, Slice 6 runtime verification — `set_project_output_language()` against a
 * real Postgres, plus the Thai-ratio detector on the exact note texts this slice's
 * live browser check (see HANDOFF.md) then runs through a real analysis.
 *
 *   npm run verify:output-language   (needs .env.local pointing at a Supabase project,
 *                                      with 20260921000030 already applied)
 *
 * Deliberately does NOT import `lib/analysis/input.ts`/`run-analysis.ts`/`persist.ts`
 * to drive a real mock-provider run from here: those modules' own internal relative
 * imports lack the `.ts` extension Node's native TypeScript stripping requires for a
 * plain `node script.mts` invocation (unlike Vitest, which resolves them fine, or
 * Next.js's bundler) — chasing that down would mean adding extensions across files this
 * slice has no other reason to touch. The full "a real run's `analysis_runs.output_lang`
 * lands on 'th'/'en'" proof — the master plan's own done-when line — is instead done
 * live in the browser, through the app's real Analyze flow, and recorded in HANDOFF.md.
 * `detectDominantLanguage` itself has zero imports of its own, so it's safe to call
 * directly here, on the identical texts, as a second, independent confirmation.
 *
 * The RPC checks run on an authenticated user's own client, so RLS and the RPC's own
 * auth.uid()/existence checks are what is being measured.
 *
 * Companion to verify-admin / verify-manual-add, same shape.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { detectDominantLanguage } from "../lib/analysis/language-detect.ts";

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
const emailA = `reqwise-output-lang-a-${stamp}@example.com`;
const emailB = `reqwise-output-lang-b-${stamp}@example.com`;

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

async function newSource(project: string, creator: string, title: string, rawText: string): Promise<string> {
  const { data, error } = await admin
    .from("source_documents")
    .insert({ project_id: project, title, kind: "meeting_notes", raw_text: rawText, created_by: creator })
    .select("id")
    .single();
  if (error) throw new Error(`could not create source: ${error.message}`);
  return data.id as string;
}

async function main(): Promise<void> {
  console.log("\nReqWise AI — Phase 2, Slice 6 output-language verification\n");

  const userA = await createUser(emailA);
  await createUser(emailB);
  const clientA = await signIn(emailA);
  const clientB = await signIn(emailB);
  const orgA = await personalOrg(userA);

  const { data: profile } = await admin.from("domain_profiles").select("id").limit(1).single();
  const profileId = (profile as { id: string }).id;

  const projectA = await newProject(orgA, userA, `Output language A ${stamp}`, profileId);

  await check("1. the owner can set a fixed language", async () => {
    const result = await clientA.rpc("set_project_output_language", { p_project: projectA, p_mode: "en" });
    assert(!result.error, `set failed: ${result.error?.message}`);
    const { data } = await admin.from("projects").select("output_lang, output_lang_mode").eq("id", projectA).single();
    const row = data as { output_lang: string; output_lang_mode: string };
    assert(row.output_lang === "en", `output_lang is '${row.output_lang}'`);
    assert(row.output_lang_mode === "fixed", `output_lang_mode is '${row.output_lang_mode}'`);
    return "output_lang=en, mode=fixed";
  });

  await check("2. the owner can switch to match_source without changing the last-resolved value", async () => {
    const result = await clientA.rpc("set_project_output_language", {
      p_project: projectA,
      p_mode: "match_source",
    });
    assert(!result.error, `set failed: ${result.error?.message}`);
    const { data } = await admin.from("projects").select("output_lang, output_lang_mode").eq("id", projectA).single();
    const row = data as { output_lang: string; output_lang_mode: string };
    assert(row.output_lang_mode === "match_source", `output_lang_mode is '${row.output_lang_mode}'`);
    assert(row.output_lang === "en", `output_lang unexpectedly changed to '${row.output_lang}'`);
    return "mode=match_source, output_lang left at en";
  });

  await check("3. a non-member is refused with the same 'not found' message", async () => {
    const message = refused(
      await clientB.rpc("set_project_output_language", { p_project: projectA, p_mode: "en" }),
      "an outsider setting another tenant's output language",
    );
    assert(/not found|not visible/i.test(message), `the refusal leaked more than 'not found': ${message}`);
    return message.slice(0, 60);
  });

  await check("4. an invalid mode value is refused", async () => {
    const message = refused(
      await clientA.rpc("set_project_output_language", { p_project: projectA, p_mode: "fr" }),
      "an unsupported mode value",
    );
    return message.slice(0, 60);
  });

  await check("5. an archived project refuses the change", async () => {
    const archived = await clientA.rpc("archive_project", { p_project: projectA, p_reason: "verification" });
    assert(!archived.error, `archive failed: ${archived.error?.message}`);
    const message = refused(
      await clientA.rpc("set_project_output_language", { p_project: projectA, p_mode: "en" }),
      "changing the language of an archived project",
    );
    const restored = await clientA.rpc("restore_project", { p_project: projectA });
    assert(!restored.error, `restore failed: ${restored.error?.message}`);
    return message.slice(0, 60);
  });

  // ---------------------------------------------------------------- the detector
  const thaiNote =
    "ลูกค้าต้องการยกเลิกการจองได้ก่อนยี่สิบสี่ชั่วโมงและได้รับเงินคืนเต็มจำนวน ทีมงานฝ่ายบริการลูกค้ายังไม่ได้ข้อสรุปเรื่องช่องทางการแจ้งเตือน";
  const englishNote =
    "Customers want to cancel a booking up to 24 hours in advance and receive a full refund. The support team has not yet agreed on the notification channel.";

  await check("6. the detector resolves a Thai-heavy note to 'th'", async () => {
    const result = detectDominantLanguage(thaiNote);
    assert(result === "th", `detected '${result}', expected 'th'`);
    return "th";
  });

  await check("7. the detector resolves an English-heavy note to 'en'", async () => {
    const result = detectDominantLanguage(englishNote);
    assert(result === "en", `detected '${result}', expected 'en'`);
    return "en";
  });

  await check("8. sets the project to match_source and seeds both notes for the live browser check", async () => {
    const set = await clientA.rpc("set_project_output_language", {
      p_project: projectA,
      p_mode: "match_source",
    });
    assert(!set.error, `set failed: ${set.error?.message}`);

    const thaiSourceId = await newSource(projectA, userA, "Thai notes", thaiNote);
    const englishSourceId = await newSource(projectA, userA, "English notes", englishNote);

    console.log(
      `\n  → project ${projectA} is now match_source, with two sources ready for the` +
        ` live Analyze check:\n    Thai notes:    ${thaiSourceId}\n    English notes: ${englishSourceId}\n`,
    );
    return "seeded — see HANDOFF.md for the live browser proof through the app's real Analyze flow";
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
