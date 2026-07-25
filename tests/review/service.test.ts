/**
 * The edit and review service.
 *
 * What is proven here is the *shape of the request* this layer sends and the sentence
 * it produces when the database refuses. What is proven against the real database — in
 * `scripts/verify-review.mts` — is that the database refuses at all. Neither test
 * substitutes for the other: this file would happily pass against a database with no
 * triggers, and that script would not tell you which sentence a user reads.
 */

import { describe, expect, it } from "vitest";
import { fakeSupabase } from "../fake-supabase";
import {
  REVIEW_MESSAGES,
  editItem,
  reviewItem,
  translateReviewError,
} from "../../lib/review/service";

const validEdit = {
  expectedVersion: 2,
  title: "A requirement",
  description: "What it means",
  priority: "high",
  changeReason: "Clarified with the client",
};

const okEdit = {
  rpc: {
    edit_analysis_item: {
      data: { item_id: "item-1", version_no: 3, status: "draft", status_reset: false },
      error: null,
    },
  },
};

function failing(message: string) {
  return { rpc: { edit_analysis_item: { data: null, error: { message } } } };
}

describe("editItem", () => {
  it("sends exactly the six parameters the RPC accepts", async () => {
    const client = fakeSupabase({}, okEdit);
    const result = await editItem(client, "item-1", validEdit);

    expect(result.ok).toBe(true);
    expect(client.rpcCalls).toHaveLength(1);
    expect(client.rpcCalls[0].name).toBe("edit_analysis_item");
    expect(Object.keys(client.rpcCalls[0].args).sort()).toEqual([
      "p_change_reason",
      "p_description",
      "p_expected_version",
      "p_item_id",
      "p_priority",
      "p_title",
    ]);
  });

  it("passes the version the form read, not one it invents", async () => {
    const client = fakeSupabase({}, okEdit);
    await editItem(client, "item-1", { ...validEdit, expectedVersion: 7 });
    expect(client.rpcCalls[0].args.p_expected_version).toBe(7);
  });

  it("never sends a status, an actor or a version to write", async () => {
    const client = fakeSupabase({}, okEdit);
    await editItem(client, "item-1", validEdit);
    const args = client.rpcCalls[0].args;
    expect(args.p_status).toBeUndefined();
    expect(args.p_actor).toBeUndefined();
    expect(args.p_version_no).toBeUndefined();
  });

  it("refuses an invalid payload without calling the database at all", async () => {
    const client = fakeSupabase({}, okEdit);
    const result = await editItem(client, "item-1", { ...validEdit, title: "  " });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(REVIEW_MESSAGES.invalid);
    expect(result.fieldErrors?.title).toBeTruthy();
    expect(client.rpcCalls).toHaveLength(0);
  });

  it("refuses a payload carrying a forged status, and does not call the database", async () => {
    const client = fakeSupabase({}, okEdit);
    const result = await editItem(client, "item-1", { ...validEdit, status: "approved" });
    expect(result.ok).toBe(false);
    expect(client.rpcCalls).toHaveLength(0);
  });

  it("reports the status reset the database performed", async () => {
    const client = fakeSupabase(
      {},
      {
        rpc: {
          edit_analysis_item: {
            data: { item_id: "item-1", version_no: 4, status: "draft", status_reset: true },
            error: null,
          },
        },
      },
    );
    const result = await editItem(client, "item-1", validEdit);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.statusReset).toBe(true);
    expect(result.data.versionNo).toBe(4);
    expect(result.data.status).toBe("draft");
  });

  it("turns a version conflict into the sentence the reader can act on", async () => {
    const client = fakeSupabase({}, failing("version conflict: expected 2, current is 3"));
    const result = await editItem(client, "item-1", validEdit);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(REVIEW_MESSAGES.versionConflict);
  });

  it("turns an archived project into the read-only sentence", async () => {
    const client = fakeSupabase({}, failing("project is archived and read-only"));
    const result = await editItem(client, "item-1", validEdit);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(REVIEW_MESSAGES.readOnlyProject);
  });

  it("turns an approved item into the terminal sentence", async () => {
    const client = fakeSupabase({}, failing("an approved or rejected requirement is read-only"));
    const result = await editItem(client, "item-1", validEdit);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(REVIEW_MESSAGES.terminal);
  });

  it("turns a deferred item type into the other-workflow sentence", async () => {
    const client = fakeSupabase({}, failing("this item type uses a different workflow"));
    const result = await editItem(client, "item-1", validEdit);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(REVIEW_MESSAGES.wrongWorkflow);
  });
});

describe("reviewItem", () => {
  const okReview = {
    rpc: {
      review_item: {
        data: { item_id: "item-1", from_status: "draft", to_status: "reviewed" },
        error: null,
      },
    },
  };
  const action = { toStatus: "reviewed", expectedStatus: "draft", note: "" };

  it("derives the activity type from the outcome and sends the expected status", async () => {
    const client = fakeSupabase({}, okReview);
    const result = await reviewItem(client, "item-1", action);

    expect(result.ok).toBe(true);
    expect(client.rpcCalls[0].name).toBe("review_item");
    expect(client.rpcCalls[0].args.p_activity_type).toBe("status_change");
    expect(client.rpcCalls[0].args.p_expected_status).toBe("draft");
  });

  it("sends approve and reject as their own activity types", async () => {
    const approve = fakeSupabase({}, okReview);
    await reviewItem(approve, "item-1", { toStatus: "approved", expectedStatus: "reviewed", note: "" });
    expect(approve.rpcCalls[0].args.p_activity_type).toBe("approve");

    const reject = fakeSupabase({}, okReview);
    await reviewItem(reject, "item-1", {
      toStatus: "rejected",
      expectedStatus: "draft",
      note: "Out of scope for this release",
    });
    expect(reject.rpcCalls[0].args.p_activity_type).toBe("reject");
  });

  it("refuses a rejection with no note before the database is asked", async () => {
    const client = fakeSupabase({}, okReview);
    const result = await reviewItem(client, "item-1", { ...action, toStatus: "rejected" });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors?.note).toBe("A note is required");
    expect(client.rpcCalls).toHaveLength(0);
  });

  it("turns a status conflict into a reload instruction", async () => {
    const client = fakeSupabase(
      {},
      { rpc: { review_item: { data: null, error: { message: "status conflict: expected draft, current is reviewed" } } } },
    );
    const result = await reviewItem(client, "item-1", action);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(REVIEW_MESSAGES.statusConflict);
  });

  it("turns an invalid transition into its own sentence", async () => {
    const client = fakeSupabase(
      {},
      { rpc: { review_item: { data: null, error: { message: "invalid status transition: approved -> draft" } } } },
    );
    const result = await reviewItem(client, "item-1", { ...action, expectedStatus: "approved" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toBe(REVIEW_MESSAGES.transition);
  });
});

describe("translateReviewError", () => {
  it("never leaks a table, a function, a trigger, a policy or a SQLSTATE", () => {
    const raw = [
      'new row violates row-level security policy "analysis_items_update" for table "analysis_items"',
      'function edit_analysis_item(uuid,integer,text,text,item_priority,text) does not exist',
      'trigger "analysis_items_guard_update" on relation analysis_items: 23514',
    ];
    for (const detail of raw) {
      const message = translateReviewError(detail, REVIEW_MESSAGES.editFailed);
      expect(message).toBe(REVIEW_MESSAGES.editFailed);
      expect(message).not.toMatch(/analysis_items|edit_analysis_item|policy|trigger|relation|\d{5}/);
    }
  });

  it("falls back rather than guessing when it does not recognise the refusal", () => {
    expect(translateReviewError("connection reset by peer", REVIEW_MESSAGES.reviewFailed)).toBe(
      REVIEW_MESSAGES.reviewFailed,
    );
  });

  it("maps a missing item to 'unavailable' rather than confirming it exists elsewhere", () => {
    expect(translateReviewError("requirement not found or not visible", "x")).toBe(
      REVIEW_MESSAGES.unavailable,
    );
  });
});
