"use client";

/**
 * Every change request raised against this item, newest first, with an inline
 * approve / reject / withdraw action for a pending one.
 *
 * The item itself never appears changed here — approving rewrites its title,
 * description and priority through `resolveChangeRequestAction`, but its `status`
 * stays exactly what it was. What this tab shows is the proposal's own lifecycle, not
 * a second copy of the item.
 */

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { T } from "@/app/_components/t";
import { pick, useLocale } from "@/lib/i18n";
import type { ChangeRequestView } from "@/lib/review/change-requests";
import { CHANGE_REQUEST_STATUS_LABEL, CR_RESOLUTION_NOTE_MAX } from "@/lib/contracts/change-requests";
import { PRIORITY_LABEL, labelFor } from "@/app/workspace/_components/item-labels";
import { FieldLabel } from "./panel";
import { resolveChangeRequestAction, withdrawChangeRequestAction } from "../actions";
import { EMPTY_REVIEW_STATE } from "../form-state";

function when(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_TONE: Record<string, string> = {
  pending: "border-warn-border bg-warn-soft text-warn",
  approved: "border-ok-border bg-ok-soft text-ok",
  rejected: "border-danger-border bg-danger-soft text-danger",
  withdrawn: "border-border-soft bg-surface-muted text-text-muted",
};

export function ChangeRequestsTab({
  changeRequests,
  projectId,
  runId,
  canReview,
}: {
  changeRequests: ChangeRequestView[];
  projectId: string;
  runId: string;
  canReview: boolean;
}) {
  if (changeRequests.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        <T
          en="No change requests have been raised against this item."
          th="ยังไม่มีคำขอเปลี่ยนแปลงที่ยื่นสำหรับรายการนี้"
        />
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {changeRequests.map((changeRequest) => (
        <li
          key={changeRequest.id}
          className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border-soft bg-surface-muted p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-2.5 py-1 text-[11.5px] font-semibold ${
                STATUS_TONE[changeRequest.status] ?? STATUS_TONE.pending
              }`}
            >
              {CHANGE_REQUEST_STATUS_LABEL[changeRequest.status]}
            </span>
            <span className="text-[11px] text-text-faint">{when(changeRequest.requestedAt)}</span>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel>
              <T en="Reason" th="เหตุผล" />
            </FieldLabel>
            <p className="text-[13px] leading-relaxed text-text">{changeRequest.reason}</p>
          </div>

          <div className="flex flex-col gap-1">
            <FieldLabel>
              <T en="Proposed statement" th="ข้อความที่เสนอ" />
            </FieldLabel>
            <p className="text-[13px] leading-relaxed text-text">{changeRequest.proposedTitle}</p>
          </div>

          {changeRequest.proposedDescription.trim() ? (
            <div className="flex flex-col gap-1">
              <FieldLabel>
                <T en="Proposed description" th="คำอธิบายที่เสนอ" />
              </FieldLabel>
              <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text-muted">
                {changeRequest.proposedDescription}
              </p>
            </div>
          ) : null}

          <p className="text-[11.5px] text-text-faint">
            <T en="Proposed priority:" th="ลำดับความสำคัญที่เสนอ:" />{" "}
            {labelFor(PRIORITY_LABEL, changeRequest.proposedPriority)}
          </p>

          {changeRequest.status !== "pending" && changeRequest.resolutionNote ? (
            <div className="flex flex-col gap-1">
              <FieldLabel>
                <T en="Resolution note" th="หมายเหตุการแก้ไข" />
              </FieldLabel>
              <p className="text-[13px] leading-relaxed text-text-muted">{changeRequest.resolutionNote}</p>
            </div>
          ) : null}

          {changeRequest.status === "pending" && canReview ? (
            <ResolveForm projectId={projectId} runId={runId} changeRequestId={changeRequest.id} />
          ) : null}
        </li>
      ))}
    </ol>
  );
}

function ResolveForm({
  projectId,
  runId,
  changeRequestId,
}: {
  projectId: string;
  runId: string;
  changeRequestId: string;
}) {
  const locale = useLocale();
  const [resolveState, resolveAction] = useActionState(resolveChangeRequestAction, EMPTY_REVIEW_STATE);
  const [withdrawState, withdrawAction] = useActionState(withdrawChangeRequestAction, EMPTY_REVIEW_STATE);
  const [decision, setDecision] = useState<"approved" | "rejected" | null>(null);
  const [note, setNote] = useState("");
  const noteId = useId();

  const closedFor = useRef<string | null>(null);
  useEffect(() => {
    if (resolveState.ok && closedFor.current !== resolveState.message) {
      closedFor.current = resolveState.message;
      setDecision(null);
      setNote("");
    }
  }, [resolveState.ok, resolveState.message]);

  const error = resolveState.error ?? withdrawState.error;

  return (
    <div className="flex flex-col gap-2 border-t border-border-soft pt-2">
      {error ? (
        <p role="alert" className="text-[11.5px] text-danger">
          {error}
        </p>
      ) : null}
      {resolveState.ok && resolveState.message ? (
        <p role="status" className="text-[11.5px] text-ok">
          {resolveState.message}
        </p>
      ) : null}
      {withdrawState.ok && withdrawState.message ? (
        <p role="status" className="text-[11.5px] text-ok">
          {withdrawState.message}
        </p>
      ) : null}

      {decision === null ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setDecision("approved")}
            className="min-h-11 lg:min-h-9 rounded-[var(--radius-card)] border border-ok-border bg-ok-soft px-2.5 text-[12.5px] font-medium
                       text-ok transition-colors duration-150 hover:border-ok"
          >
            <T en="Approve change" th="อนุมัติการเปลี่ยนแปลง" />
          </button>
          <button
            type="button"
            onClick={() => setDecision("rejected")}
            className="min-h-11 lg:min-h-9 rounded-[var(--radius-card)] border border-danger-border bg-danger-soft px-2.5 text-[12.5px] font-medium
                       text-danger transition-colors duration-150 hover:border-danger"
          >
            <T en="Reject change" th="ปฏิเสธการเปลี่ยนแปลง" />
          </button>
          <form action={withdrawAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="runId" value={runId} />
            <input type="hidden" name="changeRequestId" value={changeRequestId} />
            <WithdrawButton />
          </form>
        </div>
      ) : (
        <form
          action={resolveAction}
          aria-label={
            decision === "approved"
              ? pick(locale, "Approve change request", "อนุมัติคำขอเปลี่ยนแปลง")
              : pick(locale, "Reject change request", "ปฏิเสธคำขอเปลี่ยนแปลง")
          }
          className="flex flex-col gap-2"
        >
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="runId" value={runId} />
          <input type="hidden" name="changeRequestId" value={changeRequestId} />
          <input type="hidden" name="decision" value={decision} />

          <div className="flex flex-col gap-1">
            <label htmlFor={noteId} className="text-[11px] font-medium uppercase tracking-[0.04em] text-text-faint">
              <T en="Resolution note" th="หมายเหตุการแก้ไข" />{" "}
              {decision === "rejected" ? (
                <T en="(required)" th="(จำเป็น)" />
              ) : (
                <T en="(optional)" th="(ไม่บังคับ)" />
              )}
            </label>
            <textarea
              id={noteId}
              name="resolutionNote"
              rows={2}
              required={decision === "rejected"}
              maxLength={CR_RESOLUTION_NOTE_MAX}
              value={note}
              onChange={(event) => setNote(event.target.value)}
              aria-invalid={resolveState.fieldErrors.resolutionNote ? true : undefined}
              className="w-full resize-y rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 py-2 text-[13px]
                         leading-relaxed text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            />
            {resolveState.fieldErrors.resolutionNote ? (
              <p role="alert" className="text-[11.5px] text-danger">
                {resolveState.fieldErrors.resolutionNote}
              </p>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            <ConfirmButton
              label={
                decision === "approved"
                  ? { en: "Confirm approval", th: "ยืนยันการอนุมัติ" }
                  : { en: "Confirm rejection", th: "ยืนยันการปฏิเสธ" }
              }
            />
            <button
              type="button"
              onClick={() => {
                setDecision(null);
                setNote("");
              }}
              className="min-h-11 lg:min-h-9 rounded-[var(--radius-card)] px-2.5 text-[12.5px] text-text-muted transition-colors duration-150 hover:text-text"
            >
              <T en="Cancel" th="ยกเลิก" />
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ConfirmButton({ label }: { label: { en: string; th: string } }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="min-h-11 lg:min-h-9 rounded-[var(--radius-card)] bg-accent px-3 text-[12.5px] font-semibold text-on-accent
                 transition-colors duration-150 hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <T en="Working…" th="กำลังดำเนินการ…" /> : <T en={label.en} th={label.th} />}
    </button>
  );
}

function WithdrawButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="min-h-11 lg:min-h-9 rounded-[var(--radius-card)] border border-border-soft bg-surface px-2.5 text-[12.5px] font-medium
                 text-text-muted transition-colors duration-150 hover:bg-surface-hover hover:text-text
                 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <T en="Withdrawing…" th="กำลังถอน…" /> : <T en="Withdraw" th="ถอนคำขอ" />}
    </button>
  );
}
