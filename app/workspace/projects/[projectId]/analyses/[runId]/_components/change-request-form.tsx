"use client";

/**
 * Raising a change request against an already-approved or already-rejected item.
 *
 * Shared by two entry points: the terminal item's own inspector (`ReviewActions`,
 * where the target is already fixed — no picker needed) and an answered question's
 * Answer tab (`WorkflowActions`, where the target is resolved from the question's
 * `raises_question` relation if there is exactly one candidate, or left to a manual
 * picker otherwise). The proposed fields are pre-filled from whichever candidate is
 * currently selected, since a change request proposes a delta against real values, not
 * a blank form.
 */

import { useActionState, useEffect, useId, useMemo, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { PRIORITIES, type Priority } from "@/lib/contracts/item-types";
import { PRIORITY_LABEL, labelFor } from "./labels";
import { CR_DESCRIPTION_MAX, CR_REASON_MAX, CR_TITLE_MAX } from "@/lib/contracts/change-requests";
import { openChangeRequestAction } from "../actions";
import { EMPTY_REVIEW_STATE } from "../form-state";

export type ChangeRequestCandidate = {
  id: string;
  displayId: string;
  title: string;
  description: string;
  priority: string;
};

export function ChangeRequestForm({
  projectId,
  runId,
  candidates,
  sourceQuestionId,
  onCancel,
  onDone,
  onDirtyChange,
}: {
  projectId: string;
  runId: string;
  /** At least one candidate; more than one renders a picker instead of a fixed target. */
  candidates: ChangeRequestCandidate[];
  sourceQuestionId: string | null;
  onCancel: () => void;
  onDone: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [state, formAction] = useActionState(openChangeRequestAction, EMPTY_REVIEW_STATE);
  const [targetItemId, setTargetItemId] = useState(candidates[0]?.id ?? "");
  const target = useMemo(
    () => candidates.find((candidate) => candidate.id === targetItemId) ?? candidates[0],
    [candidates, targetItemId],
  );

  const [title, setTitle] = useState(target?.title ?? "");
  const [description, setDescription] = useState(target?.description ?? "");
  const [priority, setPriority] = useState<Priority>((target?.priority as Priority) ?? "unassigned");
  const [reason, setReason] = useState("");

  const titleId = useId();
  const descriptionId = useId();
  const priorityId = useId();
  const reasonId = useId();
  const targetId = useId();

  // Switching the picked target re-fills the proposed fields from that item's current
  // values — a reviewer proposing a change starts from what is actually there.
  function selectTarget(id: string) {
    setTargetItemId(id);
    const next = candidates.find((candidate) => candidate.id === id);
    setTitle(next?.title ?? "");
    setDescription(next?.description ?? "");
    setPriority((next?.priority as Priority) ?? "unassigned");
  }

  useEffect(() => {
    onDirtyChange(reason.trim().length > 0);
  }, [reason, onDirtyChange]);

  const closedFor = useRef<string | null>(null);
  useEffect(() => {
    if (state.ok && closedFor.current !== state.message) {
      closedFor.current = state.message;
      onDirtyChange(false);
      onDone();
    }
  }, [state.ok, state.message, onDirtyChange, onDone]);

  return (
    <form
      action={formAction}
      aria-label="Raise a change request"
      className="flex flex-col gap-2.5 rounded-[var(--radius-card)] border border-border-soft bg-surface-muted p-3"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="targetItemId" value={target?.id ?? ""} />
      <input type="hidden" name="sourceQuestionId" value={sourceQuestionId ?? ""} />

      {state.error ? (
        <p
          role="alert"
          className="rounded-[var(--radius-card)] border border-danger-border bg-danger-soft px-3 py-2 text-[12.5px] leading-relaxed text-danger"
        >
          {state.error}
        </p>
      ) : null}

      {candidates.length > 1 ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={targetId} className="text-[11px] font-medium uppercase tracking-[0.04em] text-text-faint">
            Which requirement does this change?
          </label>
          <select
            id={targetId}
            value={targetItemId}
            onChange={(event) => selectTarget(event.target.value)}
            className="min-h-11 w-full rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 text-[13px] text-text
                       focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          >
            {candidates.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {candidate.displayId} — {candidate.title}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="text-[12.5px] font-medium text-text">Change request — {target?.displayId}</p>
      )}

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <label htmlFor={titleId} className="text-[11px] font-medium uppercase tracking-[0.04em] text-text-faint">
            Proposed statement
          </label>
          <span className="ml-auto text-[11px] tabular-nums text-text-faint">
            {title.length}/{CR_TITLE_MAX}
          </span>
        </div>
        <input
          id={titleId}
          name="proposedTitle"
          value={title}
          maxLength={CR_TITLE_MAX}
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={state.fieldErrors.proposedTitle ? true : undefined}
          className="min-h-11 w-full rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 text-[13px] text-text
                     focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
        />
        {state.fieldErrors.proposedTitle ? (
          <p role="alert" className="text-[11.5px] text-danger">
            {state.fieldErrors.proposedTitle}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <label
            htmlFor={descriptionId}
            className="text-[11px] font-medium uppercase tracking-[0.04em] text-text-faint"
          >
            Proposed description
          </label>
          <span className="ml-auto text-[11px] tabular-nums text-text-faint">
            {description.length}/{CR_DESCRIPTION_MAX}
          </span>
        </div>
        <textarea
          id={descriptionId}
          name="proposedDescription"
          rows={3}
          maxLength={CR_DESCRIPTION_MAX}
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          aria-invalid={state.fieldErrors.proposedDescription ? true : undefined}
          className="w-full resize-y rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 py-2 text-[13px]
                     leading-relaxed text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
        />
        {state.fieldErrors.proposedDescription ? (
          <p role="alert" className="text-[11.5px] text-danger">
            {state.fieldErrors.proposedDescription}
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={priorityId} className="text-[11px] font-medium uppercase tracking-[0.04em] text-text-faint">
          Proposed priority
        </label>
        <select
          id={priorityId}
          name="proposedPriority"
          value={priority}
          onChange={(event) => setPriority(event.target.value as Priority)}
          className="min-h-11 w-full rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 text-[13px] text-text
                     focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
        >
          {PRIORITIES.map((value) => (
            <option key={value} value={value}>
              {labelFor(PRIORITY_LABEL, value)}
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <label htmlFor={reasonId} className="text-[11px] font-medium uppercase tracking-[0.04em] text-text-faint">
            Reason (required)
          </label>
          <span className="ml-auto text-[11px] tabular-nums text-text-faint">
            {reason.length}/{CR_REASON_MAX}
          </span>
        </div>
        <textarea
          id={reasonId}
          name="reason"
          rows={3}
          required
          maxLength={CR_REASON_MAX}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          aria-invalid={state.fieldErrors.reason ? true : undefined}
          placeholder="Why this requirement should change"
          className="w-full resize-y rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 py-2 text-[13px]
                     leading-relaxed text-text placeholder:text-text-faint focus:border-accent
                     focus:outline-none focus:ring-2 focus:ring-accent/25"
        />
        {state.fieldErrors.reason ? (
          <p role="alert" className="text-[11.5px] text-danger">
            {state.fieldErrors.reason}
          </p>
        ) : null}
      </div>

      <p className="text-[11px] leading-relaxed text-text-faint">
        This does not change the requirement. It stays pending until a reviewer approves or
        rejects it; approving supersedes the current text but never reopens the item for review.
      </p>

      <div className="flex items-center gap-2">
        <SubmitButton />
        <button
          type="button"
          onClick={onCancel}
          className="min-h-11 rounded-[var(--radius-card)] px-3 text-[13px] text-text-muted transition-colors duration-150 hover:text-text"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="min-h-11 rounded-[var(--radius-card)] bg-accent px-4 text-[13px] font-semibold text-on-accent
                 transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Submitting…" : "Submit change request"}
    </button>
  );
}
