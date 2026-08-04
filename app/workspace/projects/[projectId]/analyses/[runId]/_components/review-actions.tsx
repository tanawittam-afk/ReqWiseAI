"use client";

/**
 * The review decision, taken where the requirement is read.
 *
 * Which buttons exist is derived from the item's own status through
 * `ALLOWED_TRANSITIONS`, the same table the database enforces — so the UI cannot
 * offer a move the server will refuse, and cannot be *made* to offer one by editing
 * the page, because the RPC re-derives the item's real status anyway.
 *
 * Rejection and "needs clarification" open an inline note field rather than a modal,
 * and approval opens an inline confirmation. That is the pattern this design system
 * already uses for a consequential decision (`archive-controls.tsx`); it needs no new
 * dialog primitive, keeps the source panel visible behind the decision, and is a real
 * focusable region rather than `window.confirm`, which cannot be styled, cannot be
 * read by the page's own live region, and cannot say what it is about to do.
 */

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import type { AnalysisItemView } from "@/lib/analysis/queries";
import {
  ALLOWED_TRANSITIONS,
  DEFERRED_WORKFLOW_LABEL,
  REVIEW_NOTE_MAX,
  isReviewableItemType,
  isTerminalStatus,
  requiresNote,
  type ItemStatus,
} from "@/lib/contracts/review";
import type { ItemType } from "@/lib/contracts/item-types";
import { reviewItemAction } from "../actions";
import { EMPTY_REVIEW_STATE } from "../form-state";
import { STATUS_LABEL, labelFor } from "@/app/workspace/_components/item-labels";
import { ChangeRequestForm } from "./change-request-form";

/** The verb on the button, which is not the same word as the state it produces. */
const ACTION_LABEL: Record<ItemStatus, string> = {
  draft: "Return to draft",
  reviewed: "Mark reviewed",
  needs_clarification: "Needs clarification",
  approved: "Approve",
  rejected: "Reject",
};

/** Ordered so the constructive decision is first and the destructive one last. */
const ACTION_ORDER: ItemStatus[] = ["reviewed", "approved", "needs_clarification", "rejected"];

export function ReviewActions({
  item,
  projectId,
  runId,
  canReview,
  onEdit,
  onShowHistory,
  onDirtyChange,
}: {
  item: AnalysisItemView;
  projectId: string;
  runId: string;
  /** False for an archived project: read the record, change nothing. */
  canReview: boolean;
  onEdit: () => void;
  onShowHistory: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const [state, formAction] = useActionState(reviewItemAction, EMPTY_REVIEW_STATE);
  const [pendingAction, setPendingAction] = useState<ItemStatus | null>(null);
  const [note, setNote] = useState("");
  const [raisingChangeRequest, setRaisingChangeRequest] = useState(false);
  const noteId = useId();

  // Changing the selected item abandons a half-composed decision — adjusted during
  // render rather than in an effect, so no frame shows one item's note under another
  // item's heading.
  const [lastItemId, setLastItemId] = useState(item.id);
  if (item.id !== lastItemId) {
    setLastItemId(item.id);
    setPendingAction(null);
    setNote("");
  }

  const closedFor = useRef<string | null>(null);
  useEffect(() => {
    if (state.ok && closedFor.current !== state.message) {
      closedFor.current = state.message;
      setPendingAction(null);
      setNote("");
    }
  }, [state.ok, state.message]);

  if (!isReviewableItemType(item.type)) {
    return (
      <Notice>
        {DEFERRED_WORKFLOW_LABEL[item.type as ItemType] ?? "This item type uses a different workflow"}
        . It is read-only here — approving or rejecting it would be answering a question that has
        not been asked yet.
      </Notice>
    );
  }

  if (isTerminalStatus(item.status)) {
    if (raisingChangeRequest) {
      return (
        <ChangeRequestForm
          projectId={projectId}
          runId={runId}
          candidates={[
            {
              id: item.id,
              displayId: item.displayId,
              title: item.title,
              description: item.description,
              priority: item.priority,
            },
          ]}
          sourceQuestionId={null}
          onCancel={() => {
            setRaisingChangeRequest(false);
            onDirtyChange(false);
          }}
          onDone={() => setRaisingChangeRequest(false)}
          onDirtyChange={onDirtyChange}
        />
      );
    }

    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${
              item.status === "approved"
                ? "border-ok-border bg-ok-soft text-ok"
                : "border-danger-border bg-danger-soft text-danger"
            }`}
          >
            {labelFor(STATUS_LABEL, item.status)} · read-only
          </span>
          <button
            type="button"
            onClick={onShowHistory}
            className="min-h-11 rounded-[var(--radius-card)] border border-border-soft px-3 text-[13px] text-text-muted
                       transition-colors duration-150 hover:bg-surface-hover hover:text-text"
          >
            View history
          </button>
          {canReview ? (
            <button
              type="button"
              onClick={() => setRaisingChangeRequest(true)}
              className="min-h-11 rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 text-[13px] font-medium
                         text-text transition-colors duration-150 hover:bg-surface-hover"
            >
              Raise a change request
            </button>
          ) : null}
        </div>
        <p className="text-[11px] leading-relaxed text-text-faint">
          {item.status === "approved"
            ? "Approved requirements are frozen in this release. Raising a change request proposes a new statement without reopening this one for review."
            : "Rejected requirements are kept, not deleted — the record of what was considered and turned down is part of the analysis."}
        </p>
      </div>
    );
  }

  if (!canReview) {
    return (
      <Notice>
        This project is archived and read-only. Restore it to edit or review requirements. Every
        version and review activity stays readable.
      </Notice>
    );
  }

  const available = ALLOWED_TRANSITIONS[item.status as ItemStatus] ?? [];
  const ordered = ACTION_ORDER.filter((status) => available.includes(status));

  return (
    <div className="flex flex-col gap-3">
      {state.error ? (
        <p
          role="alert"
          className="rounded-[var(--radius-card)] border border-danger-border bg-danger-soft px-3 py-2 text-[12.5px] leading-relaxed text-danger"
        >
          {state.error}
        </p>
      ) : null}
      {state.ok && state.message ? (
        <p
          role="status"
          className="rounded-[var(--radius-card)] border border-ok-border bg-ok-soft px-3 py-2 text-[12.5px] leading-relaxed text-ok"
        >
          {state.message}
        </p>
      ) : null}

      {pendingAction === null ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onEdit}
            className="min-h-11 rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 text-[13px] font-medium
                       text-text transition-colors duration-150 hover:bg-surface-hover"
          >
            Edit
          </button>
          {ordered.map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setPendingAction(status)}
              className={`min-h-11 rounded-[var(--radius-card)] border px-3 text-[13px] font-medium transition-colors duration-150 ${
                status === "approved"
                  ? "border-ok-border bg-ok-soft text-ok hover:border-ok"
                  : status === "rejected"
                    ? "border-danger-border bg-danger-soft text-danger hover:border-danger"
                    : "border-border-soft bg-surface text-text-muted hover:bg-surface-hover hover:text-text"
              }`}
            >
              {ACTION_LABEL[status]}
            </button>
          ))}
        </div>
      ) : (
        <form
          action={formAction}
          aria-label={`${ACTION_LABEL[pendingAction]} — confirm`}
          className="flex flex-col gap-2.5 rounded-[var(--radius-card)] border border-border-soft bg-surface-muted p-3"
        >
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="runId" value={runId} />
          <input type="hidden" name="itemId" value={item.id} />
          <input type="hidden" name="toStatus" value={pendingAction} />
          {/* The status the reviewer actually judged. If it moved, the RPC refuses. */}
          <input type="hidden" name="expectedStatus" value={item.status} />

          <p className="text-[12.5px] font-medium text-text">
            {pendingAction === "approved"
              ? `Approve ${item.displayId}?`
              : `${ACTION_LABEL[pendingAction]} — ${item.displayId}`}
          </p>

          {pendingAction === "approved" ? (
            <ul className="flex flex-col gap-1 text-[11.5px] leading-relaxed text-text-muted">
              <li>This is your decision as a reviewer, not the analysis engine&rsquo;s.</li>
              <li>The requirement becomes read-only for the rest of this release.</li>
              <li>Nothing about the analysis run or the source document changes.</li>
            </ul>
          ) : null}

          {requiresNote(pendingAction) ? (
            <div className="flex flex-col gap-1">
              <div className="flex items-baseline gap-2">
                <label
                  htmlFor={noteId}
                  className="text-[11px] font-medium uppercase tracking-[0.04em] text-text-faint"
                >
                  Note (required)
                </label>
                <span className="ml-auto text-[11px] tabular-nums text-text-faint">
                  {note.length}/{REVIEW_NOTE_MAX}
                </span>
              </div>
              <textarea
                id={noteId}
                name="note"
                rows={3}
                required
                maxLength={REVIEW_NOTE_MAX}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                aria-invalid={state.fieldErrors.note ? true : undefined}
                placeholder={
                  pendingAction === "rejected"
                    ? "Why this requirement is not going forward"
                    : "What needs to be clarified, and with whom"
                }
                className="w-full resize-y rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 py-2 text-[13px]
                           leading-relaxed text-text placeholder:text-text-faint focus:border-accent
                           focus:outline-none focus:ring-2 focus:ring-accent/25"
              />
              {state.fieldErrors.note ? (
                <p role="alert" className="text-[11.5px] text-danger">
                  {state.fieldErrors.note}
                </p>
              ) : null}
            </div>
          ) : (
            <input type="hidden" name="note" value="" />
          )}

          <div className="flex items-center gap-2">
            <ConfirmButton label={ACTION_LABEL[pendingAction]} destructive={pendingAction === "rejected"} />
            <button
              type="button"
              onClick={() => setPendingAction(null)}
              className="min-h-11 rounded-[var(--radius-card)] px-3 text-[13px] text-text-muted transition-colors duration-150 hover:text-text"
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
      className={`min-h-11 rounded-[var(--radius-card)] px-4 text-[13px] font-semibold transition-colors duration-150
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

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-3 py-2 text-[12px] leading-relaxed text-text-muted">
      {children}
    </p>
  );
}
