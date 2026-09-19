/**
 * The manual "add requirement" service (Phase 2, Slice 5).
 *
 * What is proven here is the shape of the request this layer sends and the sentence it
 * produces when the database refuses. What is proven against the real database — in
 * `scripts/verify-manual-add.mts` — is that the database actually refuses. Neither test
 * substitutes for the other.
 */

import { describe, expect, it } from "vitest";
import { fakeSupabase } from "../fake-supabase";
import { addManualRequirement, MANUAL_ADD_MESSAGES } from "../../lib/review/manual-item-service";

const validInput = {
  itemType: "functional_requirement",
  title: "The system must show live availability",
  description: "Availability must reflect confirmed reservations in real time.",
  priority: "high",
  evidenceClass: "stated",
  sourceId: "",
  excerpt: "",
};

const ok = {
  rpc: { add_manual_requirement: { data: { item_id: "item-1", display_id: "FR-004" }, error: null } },
};

function failing(message: string) {
  return { rpc: { add_manual_requirement: { data: null, error: { message } } } };
}

describe("addManualRequirement", () => {
  it("sends exactly the seven parameters the RPC accepts", async () => {
    const client = fakeSupabase({}, ok);
    const result = await addManualRequirement(client, "project-1", validInput);

    expect(result.ok).toBe(true);
    expect(client.rpcCalls).toHaveLength(1);
    expect(client.rpcCalls[0].name).toBe("add_manual_requirement");
    expect(Object.keys(client.rpcCalls[0].args).sort()).toEqual([
      "p_description",
      "p_evidence_class",
      "p_excerpt",
      "p_item_type",
      "p_priority",
      "p_project",
      "p_source",
      "p_title",
    ]);
  });

  it("passes null, not an empty string, when no source is cited", async () => {
    const client = fakeSupabase({}, ok);
    await addManualRequirement(client, "project-1", validInput);
    expect(client.rpcCalls[0].args.p_source).toBeNull();
    expect(client.rpcCalls[0].args.p_excerpt).toBeNull();
  });

  it("passes the citation through when both a source and an excerpt are given", async () => {
    const client = fakeSupabase({}, ok);
    await addManualRequirement(client, "project-1", {
      ...validInput,
      sourceId: "source-1",
      excerpt: "the exact quoted text",
    });
    expect(client.rpcCalls[0].args.p_source).toBe("source-1");
    expect(client.rpcCalls[0].args.p_excerpt).toBe("the exact quoted text");
  });

  it("returns the display id the database allocated", async () => {
    const client = fakeSupabase({}, ok);
    const result = await addManualRequirement(client, "project-1", validInput);
    expect(result).toEqual({ ok: true, data: { itemId: "item-1", displayId: "FR-004" } });
  });

  it("rejects invalid input before ever calling the RPC", async () => {
    const client = fakeSupabase({}, ok);
    const result = await addManualRequirement(client, "project-1", { ...validInput, title: "" });

    expect(result).toEqual({
      ok: false,
      error: MANUAL_ADD_MESSAGES.invalid,
      fieldErrors: expect.objectContaining({ title: expect.any(String) }),
    });
    expect(client.rpcCalls).toHaveLength(0);
  });

  it("translates an archived project into the read-only sentence", async () => {
    const client = fakeSupabase({}, failing("project is archived and read-only"));
    const result = await addManualRequirement(client, "project-1", validInput);
    expect(result).toEqual({ ok: false, error: MANUAL_ADD_MESSAGES.readOnlyProject });
  });

  it("translates a wrong-workflow refusal (open_question/quality_finding)", async () => {
    const client = fakeSupabase({}, failing("this item type uses a different workflow"));
    const result = await addManualRequirement(client, "project-1", validInput);
    expect(result).toEqual({ ok: false, error: MANUAL_ADD_MESSAGES.wrongWorkflow });
  });

  it("translates a missing source into its own sentence", async () => {
    const client = fakeSupabase({}, failing("source not found or not visible"));
    const result = await addManualRequirement(client, "project-1", validInput);
    expect(result).toEqual({ ok: false, error: MANUAL_ADD_MESSAGES.sourceUnavailable });
  });

  it("translates the assumed-with-citation refusal", async () => {
    const client = fakeSupabase({}, failing("an assumed item may not carry a source excerpt"));
    const result = await addManualRequirement(client, "project-1", validInput);
    expect(result).toEqual({ ok: false, error: MANUAL_ADD_MESSAGES.assumedWithCitation });
  });

  it("translates a non-member refusal into the generic 'unavailable' sentence, leaking nothing", async () => {
    const client = fakeSupabase({}, failing("project not found or not visible"));
    const result = await addManualRequirement(client, "project-1", validInput);
    expect(result).toEqual({ ok: false, error: MANUAL_ADD_MESSAGES.unavailable });
  });

  it("translates an expired session", async () => {
    const client = fakeSupabase({}, failing("authentication required"));
    const result = await addManualRequirement(client, "project-1", validInput);
    expect(result).toEqual({ ok: false, error: MANUAL_ADD_MESSAGES.expired });
  });

  it("falls back to a generic sentence for an unrecognized refusal", async () => {
    const client = fakeSupabase({}, failing("boom"));
    const result = await addManualRequirement(client, "project-1", validInput);
    expect(result).toEqual({ ok: false, error: MANUAL_ADD_MESSAGES.addFailed });
  });
});
