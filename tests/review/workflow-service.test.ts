/**
 * The question and quality workflow service.
 *
 * What is proven here is the shape of the request this layer sends and the sentence it
 * produces when the database refuses. What is proven against the real database — in
 * `scripts/verify-workflow.mts` — is that the database refuses at all.
 */

import { describe, expect, it } from "vitest";
import { fakeSupabase } from "../fake-supabase";
import {
  WORKFLOW_MESSAGES,
  resolveQuestion,
  translateWorkflowError,
  updateCoverageGap,
  updateFinding,
} from "../../lib/review/workflow-service";

const answer = {
  expectedState: "open",
  toState: "answered",
  answer: "คืนเงินเต็มจำนวนถ้ายกเลิกก่อน 24 ชั่วโมง",
  followUpOn: "",
};

const okQuestion = {
  rpc: {
    resolve_open_question: {
      data: { item_id: "q-1", from_state: "open", to_state: "answered" },
      error: null,
    },
  },
};

const okFinding = {
  rpc: {
    update_quality_finding: {
      data: { item_id: "qf-1", from_state: "open", to_state: "acknowledged" },
      error: null,
    },
  },
};

function questionFails(message: string) {
  return { rpc: { resolve_open_question: { data: null, error: { message } } } };
}

describe("resolveQuestion", () => {
  it("sends exactly the five parameters the RPC accepts", async () => {
    const client = fakeSupabase({}, okQuestion);
    const result = await resolveQuestion(client, "q-1", answer);

    expect(result.ok).toBe(true);
    expect(client.rpcCalls).toHaveLength(1);
    expect(client.rpcCalls[0].name).toBe("resolve_open_question");
    expect(Object.keys(client.rpcCalls[0].args).sort()).toEqual([
      "p_answer",
      "p_expected_state",
      "p_follow_up_on",
      "p_item_id",
      "p_to_state",
    ]);
  });

  it("passes the state the reader saw, not one it invents", async () => {
    const client = fakeSupabase({}, okQuestion);
    await resolveQuestion(client, "q-1", { ...answer, expectedState: "deferred" });
    expect(client.rpcCalls[0].args.p_expected_state).toBe("deferred");
  });

  it("never sends an actor, a project or a review status", async () => {
    const client = fakeSupabase({}, okQuestion);
    await resolveQuestion(client, "q-1", answer);
    const args = client.rpcCalls[0].args;
    expect(args.p_actor).toBeUndefined();
    expect(args.p_project).toBeUndefined();
    expect(args.p_status).toBeUndefined();
  });

  it("sends a null follow-up date rather than an empty string", async () => {
    const client = fakeSupabase({}, okQuestion);
    await resolveQuestion(client, "q-1", answer);
    expect(client.rpcCalls[0].args.p_follow_up_on).toBeNull();
  });

  it("carries a real follow-up date through on a deferral", async () => {
    const client = fakeSupabase({}, okQuestion);
    await resolveQuestion(client, "q-1", {
      ...answer,
      toState: "deferred",
      answer: "รอฝ่ายการเงิน",
      followUpOn: "2026-08-15",
    });
    expect(client.rpcCalls[0].args.p_follow_up_on).toBe("2026-08-15");
  });

  it("refuses an empty answer without calling the database at all", async () => {
    const client = fakeSupabase({}, okQuestion);
    const result = await resolveQuestion(client, "q-1", { ...answer, answer: "  " });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(WORKFLOW_MESSAGES.invalid);
    expect(result.fieldErrors?.answer).toBeTruthy();
    expect(client.rpcCalls).toHaveLength(0);
  });

  it("refuses a payload carrying a forged actor, and does not call the database", async () => {
    const client = fakeSupabase({}, okQuestion);
    const result = await resolveQuestion(client, "q-1", { ...answer, actorId: "someone-else" });
    expect(result.ok).toBe(false);
    expect(client.rpcCalls).toHaveLength(0);
  });

  it("turns a workflow conflict into the reload sentence", async () => {
    const client = fakeSupabase({}, questionFails("workflow conflict: expected open, current is answered"));
    const result = await resolveQuestion(client, "q-1", answer);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(WORKFLOW_MESSAGES.conflict);
  });

  it("turns an archived project into the read-only sentence", async () => {
    const client = fakeSupabase({}, questionFails("project is archived and read-only"));
    const result = await resolveQuestion(client, "q-1", answer);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(WORKFLOW_MESSAGES.readOnlyProject);
  });

  it("turns a wrong item type into the other-workflow sentence", async () => {
    const client = fakeSupabase({}, questionFails("this item is not a stakeholder question"));
    const result = await resolveQuestion(client, "q-1", answer);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(WORKFLOW_MESSAGES.wrongType);
  });

  it("reports a missing question as unavailable rather than confirming it exists elsewhere", async () => {
    const client = fakeSupabase({}, questionFails("question not found or not visible"));
    const result = await resolveQuestion(client, "q-1", answer);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(WORKFLOW_MESSAGES.questionUnavailable);
  });
});

describe("updateFinding", () => {
  const acknowledge = { expectedState: "open", toState: "acknowledged", note: "" };

  it("sends exactly the four parameters the RPC accepts", async () => {
    const client = fakeSupabase({}, okFinding);
    const result = await updateFinding(client, "qf-1", acknowledge);

    expect(result.ok).toBe(true);
    expect(client.rpcCalls[0].name).toBe("update_quality_finding");
    expect(Object.keys(client.rpcCalls[0].args).sort()).toEqual([
      "p_expected_state",
      "p_item_id",
      "p_note",
      "p_to_state",
    ]);
  });

  it("sends a null note for an acknowledgement rather than an empty string", async () => {
    const client = fakeSupabase({}, okFinding);
    await updateFinding(client, "qf-1", acknowledge);
    expect(client.rpcCalls[0].args.p_note).toBeNull();
  });

  it("refuses a resolution with no note before the database is asked", async () => {
    const client = fakeSupabase({}, okFinding);
    const result = await updateFinding(client, "qf-1", { ...acknowledge, toState: "resolved" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.note).toBe("A resolution note is required");
    expect(client.rpcCalls).toHaveLength(0);
  });

  it("turns an invalid transition into its own sentence", async () => {
    const client = fakeSupabase(
      {},
      {
        rpc: {
          update_quality_finding: {
            data: null,
            error: { message: "invalid workflow transition: resolved -> acknowledged" },
          },
        },
      },
    );
    const result = await updateFinding(client, "qf-1", {
      expectedState: "resolved",
      toState: "acknowledged",
      note: "x",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(WORKFLOW_MESSAGES.transition);
  });
});

describe("updateCoverageGap", () => {
  const acknowledge = { expectedState: "open", toState: "acknowledged", note: "" };
  const okGap = {
    rpc: {
      update_coverage_gap: {
        data: { item_id: "gap-1", from_state: "open", to_state: "acknowledged" },
        error: null,
      },
    },
  };

  it("calls update_coverage_gap, not update_quality_finding", async () => {
    const client = fakeSupabase({}, okGap);
    const result = await updateCoverageGap(client, "gap-1", acknowledge);

    expect(result.ok).toBe(true);
    expect(client.rpcCalls[0].name).toBe("update_coverage_gap");
    expect(Object.keys(client.rpcCalls[0].args).sort()).toEqual([
      "p_expected_state",
      "p_item_id",
      "p_note",
      "p_to_state",
    ]);
  });

  it("sends a null note for an acknowledgement rather than an empty string", async () => {
    const client = fakeSupabase({}, okGap);
    await updateCoverageGap(client, "gap-1", acknowledge);
    expect(client.rpcCalls[0].args.p_note).toBeNull();
  });

  it("refuses a resolution with no note before the database is asked", async () => {
    const client = fakeSupabase({}, okGap);
    const result = await updateCoverageGap(client, "gap-1", { ...acknowledge, toState: "resolved" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.note).toBe("A resolution note is required");
    expect(client.rpcCalls).toHaveLength(0);
  });

  it("turns a wrong-type refusal into the other-workflow sentence", async () => {
    const client = fakeSupabase(
      {},
      { rpc: { update_coverage_gap: { data: null, error: { message: "this item is not a coverage gap" } } } },
    );
    const result = await updateCoverageGap(client, "gap-1", acknowledge);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(WORKFLOW_MESSAGES.wrongType);
  });

  it("reports a missing gap as unavailable rather than confirming it exists elsewhere", async () => {
    const client = fakeSupabase(
      {},
      { rpc: { update_coverage_gap: { data: null, error: { message: "gap not found or not visible" } } } },
    );
    const result = await updateCoverageGap(client, "gap-1", acknowledge);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(WORKFLOW_MESSAGES.gapUnavailable);
  });
});

describe("translateWorkflowError", () => {
  it("never leaks a table, a function, a trigger, a policy or a SQLSTATE", () => {
    const raw = [
      'new row violates row-level security policy "analysis_items_update" for table "analysis_items"',
      'function resolve_open_question(uuid,item_workflow_state,item_workflow_state,text,date) does not exist',
      'trigger "analysis_items_guard_update" on relation analysis_items: 23514',
      'null value in column "workflow_state" violates not-null constraint',
    ];
    for (const detail of raw) {
      const message = translateWorkflowError(detail, WORKFLOW_MESSAGES.failed);
      expect(message).toBe(WORKFLOW_MESSAGES.failed);
      expect(message).not.toMatch(
        /analysis_items|resolve_open_question|workflow_state|policy|trigger|relation|\d{5}/,
      );
    }
  });

  it("falls back rather than guessing when it does not recognise the refusal", () => {
    expect(translateWorkflowError("connection reset by peer", WORKFLOW_MESSAGES.failed)).toBe(
      WORKFLOW_MESSAGES.failed,
    );
  });
});
