/**
 * What a human may say about a stakeholder question or a quality finding.
 *
 * The third contract in the same family as `review.ts`: strict objects, transitions
 * that mirror the database, and a note rule per outcome. The difference is the subject.
 * A requirement is *approved* — a judgement about whether it should be built. A
 * question is *answered* and a finding is *acknowledged, resolved or dismissed* — and
 * neither of those is a judgement about a requirement at all, which is why the two
 * workflows share no state, no RPC and no transition table.
 *
 * Mirrors `is_valid_question_transition()` / `is_valid_finding_transition()` and the
 * `analysis_items_workflow_state_by_type` CHECK (migration 20260725000016).
 */

import { z } from "zod";
import type { ItemType } from "./item-types";

export const WORKFLOW_STATES = [
  "open",
  "answered",
  "deferred",
  "not_applicable",
  "acknowledged",
  "resolved",
  "dismissed",
] as const;
export type WorkflowState = (typeof WORKFLOW_STATES)[number];

/** The states each type may hold. Anything else is refused by a CHECK constraint. */
export const QUESTION_STATES: readonly WorkflowState[] = [
  "open",
  "answered",
  "deferred",
  "not_applicable",
];
export const FINDING_STATES: readonly WorkflowState[] = [
  "open",
  "acknowledged",
  "resolved",
  "dismissed",
];

/** The two item types this workflow applies to — the exact complement of `review.ts`. */
export const WORKFLOW_ITEM_TYPES: readonly ItemType[] = ["open_question", "quality_finding"];

export function isWorkflowItemType(type: string): type is "open_question" | "quality_finding" {
  return type === "open_question" || type === "quality_finding";
}

export const QUESTION_TRANSITIONS: Record<WorkflowState, readonly WorkflowState[]> = {
  open: ["answered", "deferred", "not_applicable"],
  deferred: ["answered", "not_applicable", "open"],
  answered: ["open"],
  not_applicable: ["open"],
  // states a question can never hold
  acknowledged: [],
  resolved: [],
  dismissed: [],
};

export const FINDING_TRANSITIONS: Record<WorkflowState, readonly WorkflowState[]> = {
  open: ["acknowledged", "resolved", "dismissed"],
  acknowledged: ["resolved", "dismissed", "open"],
  resolved: ["open"],
  dismissed: ["open"],
  // states a finding can never hold
  answered: [],
  deferred: [],
  not_applicable: [],
};

export function transitionsFor(type: string, from: string): readonly WorkflowState[] {
  const table = type === "open_question" ? QUESTION_TRANSITIONS : FINDING_TRANSITIONS;
  return table[from as WorkflowState] ?? [];
}

export function isAllowedWorkflowTransition(type: string, from: string, to: string): boolean {
  if (!isWorkflowItemType(type)) return false;
  return (transitionsFor(type, from) as readonly string[]).includes(to);
}

/**
 * Which outcomes must carry words.
 *
 * Every question transition does: answering with nothing is not an answer, and
 * deferring, ruling out and reopening are all instructions to whoever picks it up next.
 * For a finding, `acknowledged` is the single exception — it means "seen, not fixed",
 * and demanding a sentence for it would just produce "ok" a hundred times.
 */
export function workflowNoteRequired(type: string, to: string): boolean {
  if (type === "open_question") return true;
  return to !== "acknowledged";
}

/** A state nobody may act on further without reopening first. */
export function isClosedWorkflowState(state: string): boolean {
  return state === "answered" || state === "not_applicable" || state === "resolved" || state === "dismissed";
}

export function isReopen(to: string): boolean {
  return to === "open";
}

export const WORKFLOW_NOTE_MAX = 4000;

/**
 * A calendar date, not a timestamp — "when should somebody chase this" has no time
 * zone. Checked for real existence as well as shape, so 2026-02-31 is rejected rather
 * than silently rounded, exactly as `contracts/source.ts` does for a source date.
 */
function isRealDate(value: string): boolean {
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

const followUpOn = z
  .string()
  .trim()
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .default(null)
  .refine(
    (value) => value === null || (/^\d{4}-\d{2}-\d{2}$/.test(value) && isRealDate(value)),
    "Enter a valid date",
  );

/**
 * A question decision.
 *
 * `expectedState` is a *read* the client reports back, never a value it chooses — the
 * database refuses the write if the question has moved on. Everything a form might also
 * be tempted to send (`actorId`, `organizationId`, `projectId`, `status`, `versionNo`,
 * `evidenceClass`, `sourceReferences`) is absent from the object, and `strictObject`
 * turns "also sent" into a parse error rather than a silently ignored key.
 */
export const questionActionSchema = z
  .strictObject({
    expectedState: z.enum(QUESTION_STATES as [WorkflowState, ...WorkflowState[]], {
      message: "Reload this question and try again",
    }),
    toState: z.enum(QUESTION_STATES as [WorkflowState, ...WorkflowState[]], {
      message: "Choose an outcome",
    }),
    answer: z
      .string()
      .trim()
      .max(WORKFLOW_NOTE_MAX, `Keep this under ${WORKFLOW_NOTE_MAX} characters`),
    followUpOn,
  })
  .refine((value) => value.answer.length > 0, {
    message: "An answer is required",
    path: ["answer"],
  })
  .refine((value) => value.followUpOn === null || value.toState === "deferred", {
    message: "A follow-up date only applies to a deferred question",
    path: ["followUpOn"],
  });

export type QuestionActionInput = z.infer<typeof questionActionSchema>;

export const findingActionSchema = z
  .strictObject({
    expectedState: z.enum(FINDING_STATES as [WorkflowState, ...WorkflowState[]], {
      message: "Reload this finding and try again",
    }),
    toState: z.enum(FINDING_STATES as [WorkflowState, ...WorkflowState[]], {
      message: "Choose an outcome",
    }),
    note: z
      .string()
      .trim()
      .max(WORKFLOW_NOTE_MAX, `Keep this under ${WORKFLOW_NOTE_MAX} characters`)
      .transform((value) => (value === "" ? null : value))
      .nullable()
      .default(null),
  })
  .refine((value) => !workflowNoteRequired("quality_finding", value.toState) || value.note !== null, {
    message: "A resolution note is required",
    path: ["note"],
  });

export type FindingActionInput = z.infer<typeof findingActionSchema>;

/** Reads only the fields the question form owns. An injected `itemId` never reaches a schema. */
export function readQuestionActionForm(formData: FormData): unknown {
  const text = (field: string) => String(formData.get(field) ?? "");
  return {
    expectedState: text("expectedState"),
    toState: text("toState"),
    answer: text("answer"),
    followUpOn: text("followUpOn"),
  };
}

export function readFindingActionForm(formData: FormData): unknown {
  const text = (field: string) => String(formData.get(field) ?? "");
  return {
    expectedState: text("expectedState"),
    toState: text("toState"),
    note: text("note"),
  };
}

/* ------------------------------------------------------------------- labels */

export const WORKFLOW_STATE_LABEL: Record<WorkflowState, string> = {
  open: "Open",
  answered: "Answered",
  deferred: "Deferred",
  not_applicable: "Not applicable",
  acknowledged: "Acknowledged",
  resolved: "Resolved",
  dismissed: "Dismissed",
};

/** The verb on the button, which is not the word for the state it produces. */
export const WORKFLOW_ACTION_LABEL: Record<WorkflowState, string> = {
  open: "Reopen",
  answered: "Mark answered",
  deferred: "Defer",
  not_applicable: "Not applicable",
  acknowledged: "Acknowledge",
  resolved: "Resolve",
  dismissed: "Dismiss",
};

/**
 * The heading over the note field, which is the honest name for what is being asked
 * for. "Note" would be true of all six and useful for none.
 */
export const WORKFLOW_NOTE_LABEL: Record<WorkflowState, string> = {
  open: "Reason for reopening",
  answered: "Stakeholder answer",
  deferred: "Why this is being deferred",
  not_applicable: "Why this does not apply",
  acknowledged: "Note (optional)",
  resolved: "How this was resolved",
  dismissed: "Why this finding does not stand",
};

/** Mirrors `review_activity_type`'s eight new labels. */
export const WORKFLOW_ACTIVITY_LABEL: Record<string, string> = {
  question_answered: "Answered stakeholder question",
  question_deferred: "Deferred stakeholder question",
  question_not_applicable: "Marked question as not applicable",
  question_reopened: "Reopened stakeholder question",
  quality_acknowledged: "Acknowledged quality finding",
  quality_resolved: "Resolved quality finding",
  quality_dismissed: "Dismissed quality finding",
  quality_reopened: "Reopened quality finding",
};

/**
 * An answer may well mean a requirement has to change — but this slice never changes
 * one, silently or otherwise. The UI says so and points at the workflow that will.
 */
export const CHANGE_REQUEST_HINT = "This answer may require a requirement change.";
export const CHANGE_REQUEST_ACTION = "Create change request — Coming next";
