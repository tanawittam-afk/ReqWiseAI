"use client";

/**
 * Answering a question, and resolving a finding.
 *
 * One component for both because the *shape* is identical — a current state, the moves
 * it allows, and a note whose heading depends on which move was chosen — while the
 * rules that differ (which transitions exist, which need words) live in
 * `lib/contracts/workflow.ts` and are enforced again by the database. Two nearly
 * identical components would be two places to forget a rule.
 *
 * Like the review actions, the decision opens an inline form rather than a modal: the
 * source panel stays visible behind it, which is the whole point of deciding here
 * rather than in a dialog.
 */

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { AnalysisItemView } from "@/lib/analysis/queries";
import {
  CHANGE_REQUEST_ACTION,
  CHANGE_REQUEST_HINT,
  WORKFLOW_ACTION_LABEL,
  WORKFLOW_NOTE_LABEL,
  WORKFLOW_NOTE_MAX,
  WORKFLOW_STATE_LABEL,
  isClosedWorkflowState,
  transitionsFor,
  workflowNoteRequired,
  type WorkflowState,
} from "@/lib/contracts/workflow";
import { resolveQuestionAction, updateFindingAction } from "../actions";
import { EMPTY_REVIEW_STATE } from "../form-state";

/** Constructive first, dismissive last — the same ordering rule as the review actions. */
const ORDER: WorkflowState[] = [
  "answered",
  "acknowledged",
  "resolved",
  "deferred",
  "not_applicable",
  "dismissed",
  "open",
];

const STATE_TONE: Record<string, string> = {
  open: "border-border-soft bg-surface-muted text-text-muted",
  acknowledged: "border-signal-border bg-signal-soft text-signal",
  deferred: "border-warn-border bg-warn-soft text-warn",
  answered: "border-ok-border bg-ok-soft text-ok",
  resolved: "border-ok-border bg-ok-soft text-ok",
  dismissed: "border-border-soft bg-surface-muted text-text-muted",
  not_applicable: "border-border-soft bg-surface-muted text-text-muted",
};

export function WorkflowStateChip({ state }: { state: string }) {
  const tone = STATE_TONE[state] ?? "border-border-soft bg-surface-muted text-text-muted";
  return (
    <span className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${tone}`}>
      {WORKFLOW_STATE_LABEL[state as WorkflowState] ?? state}
    </span>
  );
}

export function WorkflowActions({
  item,
  projectId,
  runId,
  canAct,
  onDirtyChange,
}: {
  item: AnalysisItemView;
  projectId: string;
  runId: string;
  /** False for an archived project: read the record, change nothing. */
  canAct: boolean;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const isQuestion = item.type === "open_question";
  const [state, formAction] = useActionState(
    isQuestion ? resolveQuestionAction : updateFindingAction,
    EMPTY_REVIEW_STATE,
  );
  const [pending, setPending] = useState<WorkflowState | null>(null);
  const [note, setNote] = useState("");
  const [followUp, setFollowUp] = useState("");
  const noteId = useId();
  const followUpId = useId();

  // Changing the selected item abandons a half-composed decision. Adjusted during
  // render rather than in an effect, so no frame shows one item's answer under
  // another item's heading.
  const [lastItemId, setLastItemId] = useState(item.id);
  if (item.id !== lastItemId) {
    setLastItemId(item.id);
    setPending(null);
    setNote("");
    setFollowUp("");
  }

  // The workspace warns before a pending answer would be discarded (§18).
  useEffect(() => {
    onDirtyChange(pending !== null && note.trim().length > 0);
  }, [pending, note, onDirtyChange]);

  const closedFor = useRef<string | null>(null);
  useEffect(() => {
    if (state.ok && closedFor.current !== state.message) {
      closedFor.current = state.message;
      setPending(null);
      setNote("");
      setFollowUp("");
      onDirtyChange(false);
    }
  }, [state.ok, state.message, onDirtyChange]);

  const current = item.workflowState ?? "open";
  const available = ORDER.filter((next) =>
    (transitionsFor(item.type, current) as readonly string[]).includes(next),
  );
  const noteFieldName = isQuestion ? "answer" : "note";
  const noteError = state.fieldErrors[noteFieldName];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <WorkflowStateChip state={current} />
        {isClosedWorkflowState(current) && !canAct ? (
          <span className="text-[11px] text-text-faint">read-only</span>
        ) : null}
      </div>

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger-border bg-danger-soft px-3 py-2 text-[12.5px] leading-relaxed text-danger"
        >
          {state.error}
        </p>
      ) : null}
      {state.ok && state.message ? (
        <p
          role="status"
          className="rounded-lg border border-ok-border bg-ok-soft px-3 py-2 text-[12.5px] leading-relaxed text-ok"
        >
          {state.message}
        </p>
      ) : null}

      {!canAct ? (
        <p className="rounded-lg border border-border-soft bg-surface-muted px-3 py-2 text-[12px] leading-relaxed text-text-muted">
          This project is archived and read-only. Restore it to answer questions or resolve
          findings. Every answer, resolution and activity stays readable.
        </p>
      ) : pending === null ? (
        <div className="flex flex-wrap gap-2">
          {available.map((next) => (
            <button
              key={next}
              type="button"
              onClick={() => setPending(next)}
              className={`min-h-11 rounded-lg border px-3 text-[13px] font-medium transition-colors duration-150 ${
                next === "answered" || next === "resolved"
                  ? "border-ok-border bg-ok-soft text-ok hover:border-ok"
                  : next === "dismissed" || next === "not_applicable"
                    ? "border-danger-border bg-danger-soft text-danger hover:border-danger"
                    : "border-border-soft bg-surface text-text-muted hover:bg-surface-hover hover:text-text"
              }`}
            >
              {WORKFLOW_ACTION_LABEL[next]}
            </button>
          ))}
        </div>
      ) : (
        <form
          action={formAction}
          aria-label={`${WORKFLOW_ACTION_LABEL[pending]} — confirm`}
          className="flex flex-col gap-2.5 rounded-[var(--radius-card)] border border-border-soft bg-surface-muted p-3"
        >
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="runId" value={runId} />
          <input type="hidden" name="itemId" value={item.id} />
          <input type="hidden" name="toState" value={pending} />
          {/* The state the person actually judged. If it moved, the RPC refuses. */}
          <input type="hidden" name="expectedState" value={current} />

          <p className="text-[12.5px] font-medium text-text">
            {WORKFLOW_ACTION_LABEL[pending]} — {item.displayId}
          </p>

          <div className="flex flex-col gap-1">
            <div className="flex items-baseline gap-2">
              <label
                htmlFor={noteId}
                className="text-[11px] font-medium uppercase tracking-[0.04em] text-text-faint"
              >
                {WORKFLOW_NOTE_LABEL[pending]}
                {workflowNoteRequired(item.type, pending) ? " (required)" : ""}
              </label>
              <span className="ml-auto text-[11px] tabular-nums text-text-faint">
                {note.length}/{WORKFLOW_NOTE_MAX}
              </span>
            </div>
            <textarea
              id={noteId}
              name={noteFieldName}
              rows={4}
              required={workflowNoteRequired(item.type, pending)}
              maxLength={WORKFLOW_NOTE_MAX}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              aria-invalid={noteError ? true : undefined}
              placeholder={
                pending === "answered"
                  ? "What the stakeholder actually said"
                  : pending === "resolved"
                    ? "How this was resolved"
                    : undefined
              }
              className="w-full resize-y rounded-lg border border-border-soft bg-surface px-3 py-2 text-[13px]
                         leading-relaxed text-text placeholder:text-text-faint focus:border-accent
                         focus:outline-none focus:ring-2 focus:ring-accent/25"
            />
            {noteError ? (
              <p role="alert" className="text-[11.5px] text-danger">
                {noteError}
              </p>
            ) : null}
          </div>

          {pending === "deferred" ? (
            <div className="flex flex-col gap-1">
              <label
                htmlFor={followUpId}
                className="text-[11px] font-medium uppercase tracking-[0.04em] text-text-faint"
              >
                Follow up on (optional)
              </label>
              <input
                id={followUpId}
                name="followUpOn"
                type="date"
                value={followUp}
                onChange={(event) => setFollowUp(event.target.value)}
                className="min-h-11 w-full rounded-lg border border-border-soft bg-surface px-3 text-[13px]
                           text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
              />
              {state.fieldErrors.followUpOn ? (
                <p role="alert" className="text-[11.5px] text-danger">
                  {state.fieldErrors.followUpOn}
                </p>
              ) : null}
            </div>
          ) : (
            <input type="hidden" name="followUpOn" value="" />
          )}

          {isQuestion && pending === "answered" ? (
            <div className="flex flex-col gap-1.5 rounded-lg border border-border-soft bg-surface p-2.5">
              <p className="text-[11.5px] leading-relaxed text-text-muted">{CHANGE_REQUEST_HINT}</p>
              <button
                type="button"
                disabled
                aria-disabled="true"
                title="Not available yet"
                className="min-h-11 w-fit cursor-not-allowed rounded-lg border border-border-soft px-3
                           text-[12.5px] font-medium text-text-faint opacity-70"
              >
                {CHANGE_REQUEST_ACTION}
              </button>
              <p className="text-[11px] leading-relaxed text-text-faint">
                Recording the answer changes nothing about any requirement — not its text, not
                its status, not its evidence. Acting on it is a change request, and that is the
                next slice.
              </p>
            </div>
          ) : null}

          <div className="flex items-center gap-2">
            <ConfirmButton
              label={WORKFLOW_ACTION_LABEL[pending]}
              destructive={pending === "dismissed" || pending === "not_applicable"}
            />
            <button
              type="button"
              onClick={() => {
                setPending(null);
                setNote("");
                setFollowUp("");
                onDirtyChange(false);
              }}
              className="min-h-11 rounded-lg px-3 text-[13px] text-text-muted transition-colors duration-150 hover:text-text"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ConfirmButton({ label, destructive }: { label: string; destructive: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className={`min-h-11 rounded-lg px-4 text-[13px] font-semibold transition-colors duration-150
                  disabled:cursor-not-allowed disabled:opacity-60 ${
                    destructive
                      ? "border border-danger-border bg-danger-soft text-danger hover:border-danger"
                      : "bg-accent text-on-accent hover:bg-accent-hover"
                  }`}
    >
      {pending ? "Working…" : label}
    </button>
  );
}
