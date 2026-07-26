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

  it("sends typed relations addressed by local key, not by provider key", async () => {
    const provider = createMockProvider();
    const result = await runAnalysis(provider, bookingInput(), testPorts());
    expect(result.status).toBe("valid");

    const client = clientWith({ data: { run_id: "run-1", validation_status: "valid", duplicate: false } });
    await persistAnalysisResult(client, PROJECT, SOURCE, "request-key-123", bookingInput(), result);

    const items = client.rpcCalls[0].args.p_items as Array<{ local_key: string }>;
    const relations = client.rpcCalls[0].args.p_relations as Array<{
      from_local_key: string;
      to_local_key: string;
      relation_type: string;
    }>;
    const localKeys = new Set(items.map((i) => i.local_key));

    expect(relations.length).toBeGreaterThan(0);
    for (const relation of relations) {
      expect(localKeys.has(relation.from_local_key)).toBe(true);
      expect(localKeys.has(relation.to_local_key)).toBe(true);
      // The legacy label is what pre-6B rows carry *because* nothing was stated. A new
      // run may not author one, so it must never reach the RPC.
      expect(relation.relation_type).not.toBe("derives_from");
    }
  });

  it("no longer sends the deprecated untyped edge list on any item", async () => {
    const provider = createMockProvider();
    const result = await runAnalysis(provider, bookingInput(), testPorts());
    const client = clientWith({ data: { run_id: "run-1", validation_status: "valid", duplicate: false } });
    await persistAnalysisResult(client, PROJECT, SOURCE, "request-key-124", bookingInput(), result);

    const items = client.rpcCalls[0].args.p_items as Array<Record<string, unknown>>;
    for (const item of items) expect(item).not.toHaveProperty("related_local_keys");
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

  it("explains an idempotency collision without leaking the other analysis", async () => {
    const result: RunAnalysisResult = { status: "provider_error", error: "x" };
    const client = clientWith({
      error: { message: "this request identifier has already been used for a different analysis" },
    });
    const outcome = await persistAnalysisResult(client, PROJECT, SOURCE, "reused-key-1", bookingInput(), result);

    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toMatch(/already used/i);
    expect(outcome.error).toMatch(/reload/i);
    // Nothing about the run it collided with.
    expect(outcome.error).not.toMatch(/run|source|identifier|analysis_runs/i);
  });

  it("sends the output language, so a collision on a different language is detectable", async () => {
    const result: RunAnalysisResult = { status: "provider_error", error: "x" };
    const client = clientWith({ data: { run_id: "r", validation_status: "provider_error", duplicate: false } });
    const input = { ...bookingInput(), outputLang: "en" as const };
    await persistAnalysisResult(client, PROJECT, SOURCE, "request-key-lang", input, result);

    expect(client.rpcCalls[0].args.p_output_lang).toBe("en");
    expect(client.rpcCalls[0].args.p_source).toBe(SOURCE);
    expect(client.rpcCalls[0].args.p_provider).toBe("mock");
  });
});
