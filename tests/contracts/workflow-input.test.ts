/**
 * The question and quality contracts.
 *
 * The assertions that matter are the refusals, for the same reason as `review.ts`: a
 * schema that accepts what it should reject fails silently. `strictObject` is what
 * turns a forged `actorId` into an error instead of an ignored key, and these tests
 * are what keep it strict when somebody later "simplifies" it to `z.object`.
 */

import { describe, expect, it } from "vitest";
import {
  FINDING_STATES,
  FINDING_TRANSITIONS,
  QUESTION_STATES,
  QUESTION_TRANSITIONS,
  WORKFLOW_ACTIVITY_LABEL,
  WORKFLOW_NOTE_MAX,
  findingActionSchema,
  isAllowedWorkflowTransition,
  isClosedWorkflowState,
  isWorkflowItemType,
  questionActionSchema,
  readFindingActionForm,
  readQuestionActionForm,
  transitionsFor,
  workflowNoteRequired,
} from "../../lib/contracts/workflow";
import { reviewFieldErrors } from "../../lib/contracts/review";

const answer = {
  expectedState: "open",
  toState: "answered",
  answer: "ลูกค้ายืนยันว่าคืนเงินเต็มจำนวนถ้ายกเลิกก่อน 24 ชั่วโมง",
  followUpOn: "",
};

describe("questionActionSchema", () => {
  it("accepts an answer with no follow-up date", () => {
    expect(questionActionSchema.safeParse(answer).success).toBe(true);
  });

  it("rejects an empty answer", () => {
    const parsed = questionActionSchema.safeParse({ ...answer, answer: "" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(reviewFieldErrors(parsed.error).answer).toBe("An answer is required");
  });

  it("rejects a whitespace-only answer", () => {
    expect(questionActionSchema.safeParse({ ...answer, answer: "   \n\t " }).success).toBe(false);
  });

  it("rejects an empty deferral reason", () => {
    expect(
      questionActionSchema.safeParse({ ...answer, toState: "deferred", answer: "  " }).success,
    ).toBe(false);
  });

  it("rejects an answer over the length limit", () => {
    expect(
      questionActionSchema.safeParse({ ...answer, answer: "x".repeat(WORKFLOW_NOTE_MAX + 1) }).success,
    ).toBe(false);
  });

  it("accepts a valid follow-up date on a deferral", () => {
    const parsed = questionActionSchema.safeParse({
      ...answer,
      toState: "deferred",
      answer: "รอผลการประชุมกับฝ่ายการเงิน",
      followUpOn: "2026-08-15",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects a date that does not exist", () => {
    const parsed = questionActionSchema.safeParse({
      ...answer,
      toState: "deferred",
      followUpOn: "2026-02-31",
    });
    expect(parsed.success).toBe(false);
  });

  it("rejects a malformed date", () => {
    expect(
      questionActionSchema.safeParse({ ...answer, toState: "deferred", followUpOn: "15/08/2026" })
        .success,
    ).toBe(false);
  });

  it("rejects a follow-up date on anything but a deferral", () => {
    const parsed = questionActionSchema.safeParse({ ...answer, followUpOn: "2026-08-15" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(reviewFieldErrors(parsed.error).followUpOn).toMatch(/deferred/i);
  });

  it("rejects a state a question can never hold", () => {
    expect(questionActionSchema.safeParse({ ...answer, toState: "resolved" }).success).toBe(false);
    expect(questionActionSchema.safeParse({ ...answer, expectedState: "dismissed" }).success).toBe(false);
  });

  it("refuses a client-supplied actor, organization, project or review status", () => {
    for (const forged of [
      { actorId: "someone-else" },
      { organizationId: "org-1" },
      { projectId: "proj-1" },
      { status: "approved" },
      { versionNo: 9 },
      { evidenceClass: "stated" },
      { sourceReferences: [] },
    ]) {
      expect(questionActionSchema.safeParse({ ...answer, ...forged }).success).toBe(false);
    }
  });
});

describe("findingActionSchema", () => {
  const base = { expectedState: "open", toState: "acknowledged", note: "" };

  it("accepts an acknowledgement with no note", () => {
    const parsed = findingActionSchema.parse(base);
    expect(parsed.note).toBeNull();
  });

  it("requires a note to resolve", () => {
    const parsed = findingActionSchema.safeParse({ ...base, toState: "resolved" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(reviewFieldErrors(parsed.error).note).toBe("A resolution note is required");
  });

  it("requires a note to dismiss and to reopen", () => {
    expect(findingActionSchema.safeParse({ ...base, toState: "dismissed" }).success).toBe(false);
    expect(
      findingActionSchema.safeParse({ ...base, expectedState: "resolved", toState: "open" }).success,
    ).toBe(false);
    expect(
      findingActionSchema.safeParse({
        ...base,
        expectedState: "resolved",
        toState: "open",
        note: "The metric was never agreed after all",
      }).success,
    ).toBe(true);
  });

  it("rejects a state a finding can never hold", () => {
    expect(findingActionSchema.safeParse({ ...base, toState: "answered" }).success).toBe(false);
    expect(findingActionSchema.safeParse({ ...base, expectedState: "deferred" }).success).toBe(false);
  });

  it("refuses a client-supplied actor", () => {
    expect(findingActionSchema.safeParse({ ...base, actorId: "someone-else" }).success).toBe(false);
  });
});

describe("question transitions", () => {
  it("matches the product's table exactly", () => {
    expect(QUESTION_TRANSITIONS.open).toEqual(["answered", "deferred", "not_applicable"]);
    expect(QUESTION_TRANSITIONS.deferred).toEqual(["answered", "not_applicable", "open"]);
    expect(QUESTION_TRANSITIONS.answered).toEqual(["open"]);
    expect(QUESTION_TRANSITIONS.not_applicable).toEqual(["open"]);
  });

  it("allows a closed question to be reopened and nothing else", () => {
    expect(isAllowedWorkflowTransition("open_question", "answered", "open")).toBe(true);
    expect(isAllowedWorkflowTransition("open_question", "answered", "deferred")).toBe(false);
    expect(isAllowedWorkflowTransition("open_question", "not_applicable", "answered")).toBe(false);
  });

  it("never offers a finding state to a question", () => {
    for (const state of ["acknowledged", "resolved", "dismissed"]) {
      expect(isAllowedWorkflowTransition("open_question", "open", state)).toBe(false);
      expect(transitionsFor("open_question", state)).toEqual([]);
    }
  });
});

describe("finding transitions", () => {
  it("matches the product's table exactly", () => {
    expect(FINDING_TRANSITIONS.open).toEqual(["acknowledged", "resolved", "dismissed"]);
    expect(FINDING_TRANSITIONS.acknowledged).toEqual(["resolved", "dismissed", "open"]);
    expect(FINDING_TRANSITIONS.resolved).toEqual(["open"]);
    expect(FINDING_TRANSITIONS.dismissed).toEqual(["open"]);
  });

  it("never offers a question state to a finding", () => {
    for (const state of ["answered", "deferred", "not_applicable"]) {
      expect(isAllowedWorkflowTransition("quality_finding", "open", state)).toBe(false);
    }
  });

  it("refuses the workflow entirely for a requirement type", () => {
    expect(isAllowedWorkflowTransition("functional_requirement", "open", "resolved")).toBe(false);
    expect(isWorkflowItemType("functional_requirement")).toBe(false);
    expect(isWorkflowItemType("open_question")).toBe(true);
    expect(isWorkflowItemType("quality_finding")).toBe(true);
  });
});

describe("note rules", () => {
  it("requires words for every question outcome", () => {
    for (const state of QUESTION_STATES) {
      expect(workflowNoteRequired("open_question", state)).toBe(true);
    }
  });

  it("makes acknowledging the one finding outcome that needs no words", () => {
    expect(workflowNoteRequired("quality_finding", "acknowledged")).toBe(false);
    for (const state of FINDING_STATES.filter((s) => s !== "acknowledged")) {
      expect(workflowNoteRequired("quality_finding", state)).toBe(true);
    }
  });

  it("treats acknowledged as still open, not as a decision", () => {
    expect(isClosedWorkflowState("acknowledged")).toBe(false);
    expect(isClosedWorkflowState("open")).toBe(false);
    expect(isClosedWorkflowState("resolved")).toBe(true);
    expect(isClosedWorkflowState("dismissed")).toBe(true);
    expect(isClosedWorkflowState("answered")).toBe(true);
    expect(isClosedWorkflowState("not_applicable")).toBe(true);
  });
});

describe("activity labels", () => {
  it("gives all eight workflow actions a human sentence", () => {
    expect(Object.keys(WORKFLOW_ACTIVITY_LABEL)).toHaveLength(8);
    expect(WORKFLOW_ACTIVITY_LABEL.question_answered).toBe("Answered stakeholder question");
    expect(WORKFLOW_ACTIVITY_LABEL.question_deferred).toBe("Deferred stakeholder question");
    expect(WORKFLOW_ACTIVITY_LABEL.question_not_applicable).toBe("Marked question as not applicable");
    expect(WORKFLOW_ACTIVITY_LABEL.question_reopened).toBe("Reopened stakeholder question");
    expect(WORKFLOW_ACTIVITY_LABEL.quality_acknowledged).toBe("Acknowledged quality finding");
    expect(WORKFLOW_ACTIVITY_LABEL.quality_resolved).toBe("Resolved quality finding");
    expect(WORKFLOW_ACTIVITY_LABEL.quality_dismissed).toBe("Dismissed quality finding");
    expect(WORKFLOW_ACTIVITY_LABEL.quality_reopened).toBe("Reopened quality finding");
  });

  it("never leaves a raw enum as the label", () => {
    for (const [key, label] of Object.entries(WORKFLOW_ACTIVITY_LABEL)) {
      expect(label).not.toBe(key);
      expect(label).not.toMatch(/_/);
    }
  });
});

describe("form readers", () => {
  it("reads only the fields the question form owns", () => {
    const form = new FormData();
    form.set("expectedState", "open");
    form.set("toState", "answered");
    form.set("answer", "Yes, refunds are full within 24 hours");
    form.set("followUpOn", "");
    form.set("actorId", "someone-else");
    form.set("itemId", "not-this-one");

    const read = readQuestionActionForm(form) as Record<string, unknown>;
    expect(Object.keys(read).sort()).toEqual(["answer", "expectedState", "followUpOn", "toState"]);
    expect(questionActionSchema.safeParse(read).success).toBe(true);
  });

  it("reads only the fields the finding form owns", () => {
    const form = new FormData();
    form.set("expectedState", "open");
    form.set("toState", "acknowledged");
    form.set("note", "");
    form.set("organizationId", "org-1");

    const read = readFindingActionForm(form) as Record<string, unknown>;
    expect(Object.keys(read).sort()).toEqual(["expectedState", "note", "toState"]);
    expect(findingActionSchema.safeParse(read).success).toBe(true);
  });
});
