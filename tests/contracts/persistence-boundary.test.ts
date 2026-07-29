import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migrationPath =
  "supabase/migrations/20260727000020_analysis_persistence_acl_and_coherence.sql";

describe("analysis persistence database boundary", () => {
  it("replaces the exact signature and grants execution only to authenticated", () => {
    const sql = readFileSync(migrationPath, "utf8").toLowerCase();
    expect(sql).toContain(
      "create or replace function public.persist_analysis_result",
    );
    expect(sql).toContain(
      "revoke execute on function public.persist_analysis_result",
    );
    expect(sql).toContain(
      "grant execute on function public.persist_analysis_result",
    );
    expect(sql).toMatch(/grant execute[\s\S]+to authenticated/);
    expect(sql).not.toMatch(/grant execute[\s\S]+to (public|anon)/);
  });

  it("rejects incoherent status and payloads without provider allowlisting", () => {
    const sql = readFileSync(migrationPath, "utf8").toLowerCase();
    expect(sql).toContain("provider/status/payload contract");
    expect(sql).toContain("nullif(btrim(p_provider), '') is null");
    expect(sql).toContain("nullif(btrim(p_schema_version), '') is null");
    expect(sql).toContain("p_items is null");
    expect(sql).toContain("p_relations is null");
    expect(sql).toContain("jsonb_typeof(p_items) <> 'array'");
    expect(sql).toContain("jsonb_typeof(p_relations) <> 'array'");
    expect(sql).toContain("when 'valid'::run_validation_status");
    expect(sql).toContain("when 'invalid'::run_validation_status");
    expect(sql).toContain("when 'provider_error'::run_validation_status");
    expect(sql).not.toContain("p_provider not in");
  });

  it("runs inventory through a fail-fast preflight before creating fixtures", () => {
    const script = readFileSync("scripts/verify-analysis.mts", "utf8");
    const helperStart = script.indexOf("async function preflight(");
    const payloadTypesStart = script.indexOf("type PersistencePayload");
    const preflightCall = script.indexOf("await preflight(");
    const firstFixtureMutation = script.indexOf(
      'userA = await createUser(emailA, "Analysis A")',
    );

    expect(helperStart).toBeGreaterThan(-1);
    expect(payloadTypesStart).toBeGreaterThan(helperStart);
    expect(script.slice(helperStart, payloadTypesStart)).toContain("throw error");
    expect(preflightCall).toBeGreaterThan(-1);
    expect(firstFixtureMutation).toBeGreaterThan(preflightCall);
    expect(script.slice(preflightCall, firstFixtureMutation)).toContain(
      "verifyExistingRunInventory",
    );
  });

  it("keeps the repository analysis verifier read-only in linked legacy mode", () => {
    const pkg = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    const script = readFileSync("scripts/verify-analysis.mts", "utf8");

    expect(pkg.scripts["verify:analysis"]).toContain("--mode linked-legacy");
    expect(script).toContain("runReadOnlyLegacyVerification");
    expect(script).toContain("assertIsolatedFixtureTarget");
    expect(script).toContain('"isolated-fixtures"');
    expect(script.indexOf("runReadOnlyLegacyVerification")).toBeLessThan(
      script.indexOf('userA = await createUser(emailA, "Analysis A")'),
    );
  });

  it("keeps both linked verification SQL files SELECT/CTE-only", () => {
    for (const path of [
      "scripts/forensics/legacy-analysis-runs-readonly.sql",
      "scripts/verify-analysis-acl.sql",
    ]) {
      const sql = readFileSync(path, "utf8")
        .replace(/--.*$/gm, "")
        .trim()
        .toLowerCase();
      expect(sql).toMatch(/^with\b/);
      expect(sql).not.toMatch(
        /\b(insert|update|delete|upsert|truncate|alter|drop|create|grant|revoke|do|call|copy)\b/,
      );
    }
  });
});
