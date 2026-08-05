"use client";

/**
 * Editing a requirement, in place.
 *
 * The inspector becomes the form rather than opening a modal over it: review work is
 * a loop of read-source, read-requirement, judge, and a dialog that covers the source
 * panel removes the evidence at the exact moment somebody is deciding whether the
 * text matches it (docs/design/INTERFACE.md §5).
 *
 * `expectedVersion` is a hidden input, and it is the only hidden input here that
 * matters: it is the version the reader actually saw. If somebody else has saved in
 * the meantime the database refuses this write and their edit stands, rather than
 * this form silently overwriting work it never displayed.
 *
 * There is no autosave. The form says "Save", and nothing is written until it is
 * pressed — claiming otherwise would be the one lie a form like this must never tell.
 */

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { T } from "@/app/_components/t";
import { pick, useLocale } from "@/lib/i18n";
import type { AnalysisItemView } from "@/lib/analysis/queries";
import { PRIORITIES } from "@/lib/contracts/item-types";
import { ITEM_DESCRIPTION_MAX, ITEM_TITLE_MAX, CHANGE_REASON_MAX } from "@/lib/contracts/review";
import { editItemAction } from "../actions";
import { EMPTY_REVIEW_STATE } from "../form-state";
import { PRIORITY_LABEL, labelFor } from "@/app/workspace/_components/item-labels";

export function ItemEditForm({
  item,
  projectId,
  runId,
  onDone,
  onDirtyChange,
}: {
  item: AnalysisItemView;
  projectId: string;
  runId: string;
  onDone: () => void;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const locale = useLocale();
  const [state, formAction] = useActionState(editItemAction, EMPTY_REVIEW_STATE);
  const titleId = useId();
  const descriptionId = useId();
  const priorityId = useId();
  const reasonId = useId();

  const [title, setTitle] = useState(item.title);
  const [description, setDescription] = useState(item.description);
  const [priority, setPriority] = useState(item.priority);
  const [reason, setReason] = useState("");

  const dirty =
    title !== item.title || description !== item.description || priority !== item.priority;

  // Reported upward so the panel switcher can warn before it drops the form
  // (docs/design/INTERFACE.md §12: a pending edit must not vanish silently).
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  // A successful save closes the form exactly once. The action revalidated the route,
  // so the values behind it are already the saved ones.
  const closedFor = useRef<string | null>(null);
  useEffect(() => {
    if (state.ok && closedFor.current !== state.message) {
      closedFor.current = state.message;
      onDirtyChange(false);
      onDone();
    }
  }, [state.ok, state.message, onDone, onDirtyChange]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="itemId" value={item.id} />
      <input type="hidden" name="expectedVersion" value={item.versionNo} />

      <p className="text-[11px] leading-relaxed text-text-faint">
        <T en="Editing version" th="กำลังแก้ไขเวอร์ชัน" /> {item.versionNo}.{" "}
        <T
          en="Saving writes a new version and keeps the old one in History. Type, evidence and confidence stay as the analysis produced them."
          th="การบันทึกจะสร้างเวอร์ชันใหม่และเก็บเวอร์ชันเดิมไว้ในประวัติ ส่วนประเภท หลักฐาน และความมั่นใจจะคงเป็นไปตามที่การวิเคราะห์ผลิตออกมา"
        />
      </p>

      {state.error ? (
        <p
          role="alert"
          className="rounded-[var(--radius-card)] border border-danger-border bg-danger-soft px-3 py-2 text-[12.5px] leading-relaxed text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <Field
        id={titleId}
        label={<T en="Statement" th="ข้อความ" />}
        error={state.fieldErrors.title}
        count={`${title.length}/${ITEM_TITLE_MAX}`}
      >
        <textarea
          id={titleId}
          name="title"
          rows={2}
          maxLength={ITEM_TITLE_MAX}
          required
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          aria-invalid={state.fieldErrors.title ? true : undefined}
          className="w-full resize-y rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 py-2 text-[13.5px]
                     leading-snug text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
        />
      </Field>

      <Field
        id={descriptionId}
        label={<T en="Description" th="คำอธิบาย" />}
        error={state.fieldErrors.description}
        count={`${description.length}/${ITEM_DESCRIPTION_MAX}`}
      >
        <textarea
          id={descriptionId}
          name="description"
          rows={5}
          maxLength={ITEM_DESCRIPTION_MAX}
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          aria-invalid={state.fieldErrors.description ? true : undefined}
          className="w-full resize-y rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 py-2 text-[13px]
                     leading-relaxed text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
        />
      </Field>

      <Field id={priorityId} label={<T en="Priority" th="ลำดับความสำคัญ" />} error={state.fieldErrors.priority}>
        <select
          id={priorityId}
          name="priority"
          value={priority}
          onChange={(event) => setPriority(event.target.value)}
          className="min-h-11 w-full rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 text-[13.5px]
                     text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
        >
          {PRIORITIES.map((value) => (
            <option key={value} value={value}>
              {labelFor(PRIORITY_LABEL, value)}
            </option>
          ))}
        </select>
      </Field>

      <Field
        id={reasonId}
        label={<T en="Why (optional)" th="เหตุผล (ไม่บังคับ)" />}
        error={state.fieldErrors.changeReason}
        count={`${reason.length}/${CHANGE_REASON_MAX}`}
      >
        <input
          id={reasonId}
          name="changeReason"
          type="text"
          maxLength={CHANGE_REASON_MAX}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder={pick(locale, "Clarified after the stakeholder call", "ชี้แจงหลังการประชุมกับผู้มีส่วนได้ส่วนเสีย")}
          className="min-h-11 w-full rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 text-[13px]
                     text-text placeholder:text-text-faint focus:border-accent focus:outline-none
                     focus:ring-2 focus:ring-accent/25"
        />
      </Field>

      <div className="flex items-center gap-2">
        <SaveButton />
        <button
          type="button"
          onClick={() => {
            onDirtyChange(false);
            onDone();
          }}
          className="min-h-11 rounded-[var(--radius-card)] px-3 text-sm text-text-muted transition-colors duration-150 hover:text-text"
        >
          <T en="Cancel" th="ยกเลิก" />
        </button>
      </div>
    </form>
  );
}

/**
 * Disabled while in flight, so a second press cannot produce a second version. The
 * pending state is the form's real one — `useFormStatus` reads the submission the
 * browser is actually waiting on, not a timer.
 */
function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      aria-busy={pending}
      className="min-h-11 rounded-[var(--radius-card)] bg-accent px-4 text-sm font-semibold text-on-accent
                 transition-colors duration-150 hover:bg-accent-hover
                 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <T en="Saving…" th="กำลังบันทึก…" /> : <T en="Save" th="บันทึก" />}
    </button>
  );
}

function Field({
  id,
  label,
  error,
  count,
  children,
}: {
  id: string;
  label: React.ReactNode;
  error?: string;
  count?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-2">
        <label htmlFor={id} className="text-[11px] font-medium uppercase tracking-[0.04em] text-text-faint">
          {label}
        </label>
        {count ? (
          <span className="ml-auto text-[11px] tabular-nums text-text-faint">{count}</span>
        ) : null}
      </div>
      {children}
      {error ? (
        <p role="alert" className="text-[11.5px] leading-relaxed text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
