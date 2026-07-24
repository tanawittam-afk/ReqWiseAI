/**
 * Persistence — proves the shape of the `persist_analysis_result` call this layer
 * issues for each of the three run outcomes, and that the request key travels through
 * for idempotency. The RPC's own atomicity and authorization are the database's job,
 * proven against real Postgres in `scripts/verify-analysis.mts`.
 */

import { describe, expect, it } from "vitest";
import { persistAnalysisResult } from "../../lib/analysis/persist";
import type { RunAnalysisResult } from "../../lib/analysis/run-analysis";
import { bookingInput, testPorts } from "../helpers";
import { fakeSupabase } from "../fake-supabase";
import { runAnalysis } from "../../lib/analysis/run-analysis";
import { createMockProvider } from "../../lib/providers/mock/mock-provider";

const PROJECT = "project-1";
const SOURCE = "source-1";

function clientWith(rpcResult: { data?: unknown; error?: { message: string } | null }) {
  return fakeSupabase({}, { rpc: { persist_analysis_result: rpcResult } });
}

describe("persistAnalysisResult", () => {
  it("sends every item keyed by its normalized id, never by display id or a client-chosen id", async () => {
    const provider = createMockProvider();
    const result = await runAnalysis(provider, bookingInput(), testPorts());
    expect(result.status).toBe("valid");

    const client = clientWith({ data: { run_id: "run-1", validation_status: "valid", duplicate: false } });
    await persistAnalysisResult(client, PROJECT, SOURCE, "request-key-123", bookingInput(), result);

    const call = client.rpcCalls[0];
    expect(call.name).toBe("persist_analysis_result");
    expect(call.args.p_validation_status).toBe("valid");
    expect(call.args.p_request_key).toBe("request-key-123");

    const items = call.args.p_items as Array<Record<string, unknown>>;
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item).not.toHaveProperty("display_id");
      expect(item).not.toHaveProperty("id");
      expect(item.local_key).toEqual(expect.any(String));
    }
  });

  it("carries related_local_keys as normalized ids, not provider keys", async () => {
    const provider = createMockProvider();
    const result = await runAnalysis(provider, bookingInput(), testPorts());
    expect(result.status).toBe("valid");

    const client = clientWith({ data: { run_id: "run-1", validation_status: "valid", duplicate: false } });
    await persistAnalysisResult(client, PROJECT, SOURCE, "request-key-123", bookingInput(), result);

    const items = client.rpcCalls[0].args.p_items as Array<{ local_key: string; related_local_keys: string[] }>;
    const localKeys = new Set(items.map((i) => i.local_key));
    const withRelations = items.filter((i) => i.related_local_keys.length > 0);
    expect(withRelations.length).toBeGreaterThan(0);
    for (const item of withRelations) {
      for (const key of item.related_local_keys) expect(localKeys.has(key)).toBe(true);
    }
  });

  it("persists an invalid run with zero items and the validation issues, not the raw output alone", async () => {
    const result: RunAnalysisResult = {
      status: "invalid",
      raw: { schema_version: "1.0.0", items: [] },
      issues: [{ kind: "schema_error", code: "test", path: "items", message: "boom" }],
    };
    const client = clientWith({ data: { run_id: "run-2", validation_status: "invalid", duplicate: false } });
    await persistAnalysisResult(client, PROJECT, SOURCE, "request-key-456", bookingInput(), result);

    const args = client.rpcCalls[0].args;
    expect(args.p_validation_status).toBe("invalid");
    expect(args.p_items).toEqual([]);
    expect((args.p_error as { issues: unknown[] }).issues).toHaveLength(1);
  });

  it("persists a provider_error run with zero items and a safe error category", async () => {
    const result: RunAnalysisResult = { status: "provider_error", error: "network timeout" };
    const client = clientWith({ data: { run_id: "run-3", validation_status: "provider_error", duplicate: false } });
    await persistAnalysisResult(client, PROJECT, SOURCE, "request-key-789", bookingInput(), result);

    const args = client.rpcCalls[0].args;
    expect(args.p_validation_status).toBe("provider_error");
    expect(args.p_items).toEqual([]);
    expect(args.p_error).toEqual({ category: "provider_error", message: "network timeout" });
  });

  it("returns a duplicate outcome without treating it as a failure", async () => {
    const result: RunAnalysisResult = { status: "provider_error", error: "x" };
    const client = clientWith({
      data: { run_id: "existing-run", validation_status: "provider_error", duplicate: true },
    });
    const outcome = await persistAnalysisResult(client, PROJECT, SOURCE, "request-key-999", bookingInput(), result);

    expect(outcome).toEqual({
      ok: true,
      runId: "existing-run",
      validationStatus: "provider_error",
      duplicate: true,
    });
  });

  it("translates a database refusal into a sentence that names no table or policy", async () => {
    const result: RunAnalysisResult = { status: "provider_error", error: "x" };
    const client = clientWith({ error: { message: "project is archived and read-only" } });
    const outcome = await persistAnalysisResult(client, PROJECT, SOURCE, "request-key-000", bookingInput(), result);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toMatch(/archived/i);
    expect(outcome.error).not.toMatch(/policy|table|analysis_runs/i);
  });
});
