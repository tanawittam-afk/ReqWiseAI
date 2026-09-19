"use client";

/**
 * Adding a requirement directly, not from an analysis run (Phase 2, Slice 4).
 *
 * Mirrors `item-edit-form.tsx`'s shape closely — same `Field` layout, same
 * `useActionState`/`useFormStatus` wiring, same "the form says Add, nothing is written
 * until it is pressed" discipline. The difference is what's being created rather than
 * changed: a fresh item, always `draft`, always `origin: manual` (decided by the
 * database, never a choice this form offers).
 *
 * `sourceId` is always the run's one source document (this app has exactly one source
 * per run; multi-source runs are explicitly deferred, CLAUDE.md → Source Input Layer),
 * so "cite the source" needs no picker — just an excerpt to paste. `prefillExcerpt` is
 * set when opened from the Quality tab's "Add requirement from this" on an open
 * finding, pre-checking the box and filling it with that finding's own excerpt; typing
 * one in by hand works the same way from the general "Add requirement" entry point —
 * no new text-selection-to-citation UI, matching how a Gemini-provider run's own
 * citations already have no verified offsets either.
 */

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { T } from "@/app/_components/t";
import { pick, useLocale } from "@/lib/i18n";
import { EVIDENCE_CLASSES, PRIORITIES } from "@/lib/contracts/item-types";
import { REVIEWABLE_ITEM_TYPES, ITEM_TITLE_MAX, ITEM_DESCRIPTION_MAX } from "@/lib/contracts/review";
import { MANUAL_EXCERPT_MAX } from "@/lib/contracts/manual-item";
import { EVIDENCE_LABEL, PRIORITY_LABEL, TYPE_LABEL, labelFor } from "@/app/workspace/_components/item-labels";
import { addManualRequirementAction } from "../actions";
import { EMPTY_REVIEW_STATE } from "../form-state";

export function AddRequirementForm({
  projectId,
  runId,
  sourceId,
  prefillExcerpt,
  onDone,
}: {
  projectId: string;
  runId: string;
  sourceId: string;
  prefillExcerpt: string | null;
  onDone: () => void;
}) {
  const locale = useLocale();
  const [state, formAction] = useActionState(addManualRequirementAction, EMPTY_REVIEW_STATE);
  const typeId = useId();
  const titleId = useId();
  const descriptionId = useId();
  const priorityId = useId();
  const evidenceId = useId();
  const excerptId = useId();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [citeSource, setCiteSource] = useState(prefillExcerpt !== null);
  const [excerpt, setExcerpt] = useState(prefillExcerpt ?? "");

  // A successful add clears the content fields (not the type/priority/evidence
  // choices — likely the same for the next one) rather than closing the form, since
  // adding several requirements in a row is the expected use, not a one-shot dialog.
  // The action already revalidated the route, so the new item is already in the list.
  const clearedFor = useRef<string | null>(null);
  useEffect(() => {
    if (state.ok && state.message !== null && clearedFor.current !== state.message) {
      clearedFor.current = state.message;
      setTitle("");
      setDescription("");
      setExcerpt("");
      // Not "form-remembers-your-last-choice" for this one: an unchecked excerpt would
      // otherwise leave `citeSource` true with nothing typed, and the hidden `sourceId`
      // would submit alone — exactly the "provide both or neither" refusal the schema
      // exists to catch, just delayed to the next click instead of caught here.
      setCiteSource(false);
    }
  }, [state.ok, state.message]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4 border-b border-border-soft bg-surface-muted px-3.5 py-3.5"
    >
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="runId" value={runId} />
      {citeSource ? <input type="hidden" name="sourceId" value={sourceId} /> : null}

      {state.ok && state.message !== null ? (
        <p role="status" className="text-[12.5px] text-ok">
          {state.message}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-[12.5px] leading-relaxed text-danger">
          {state.error}
        </p>
      ) : null}

      <Field id={typeId} label={<T en="Type" th="ประเภท" />} error={state.fieldErrors.itemType}>
        <select
          id={typeId}
          name="itemType"
          defaultValue="functional_requirement"
          className="min-h-11 w-full rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 text-[13.5px]
                     text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
        >
          {REVIEWABLE_ITEM_TYPES.map((type) => (
            <option key={type} value={type}>
              {TYPE_LABEL[type]}
            </option>
          ))}
        </select>
      </Field>

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
          placeholder={pick(locale, "What must be true", "สิ่งที่ต้องเป็นจริง")}
          aria-invalid={state.fieldErrors.title ? true : undefined}
          className="w-full resize-y rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 py-2 text-[13.5px]
                     leading-snug text-text placeholder:text-text-faint focus:border-accent focus:outline-none
                     focus:ring-2 focus:ring-accent/25"
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
          rows={4}
          maxLength={ITEM_DESCRIPTION_MAX}
          required
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          aria-invalid={state.fieldErrors.description ? true : undefined}
          className="w-full resize-y rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 py-2 text-[13px]
                     leading-relaxed text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field id={priorityId} label={<T en="Priority" th="ลำดับความสำคัญ" />} error={state.fieldErrors.priority}>
          <select
            id={priorityId}
            name="priority"
            defaultValue="unassigned"
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

        <Field id={evidenceId} label={<T en="Evidence" th="หลักฐาน" />} error={state.fieldErrors.evidenceClass}>
          <select
            id={evidenceId}
            name="evidenceClass"
            defaultValue="stated"
            className="min-h-11 w-full rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 text-[13.5px]
                       text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          >
            {EVIDENCE_CLASSES.map((value) => (
              <option key={value} value={value}>
                {EVIDENCE_LABEL[value]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <label className="flex items-center gap-2 text-[12.5px] text-text-muted">
        <input
          type="checkbox"
          checked={citeSource}
          onChange={(event) => setCiteSource(event.target.checked)}
          className="size-4 rounded-sm border border-border-soft"
        />
        <T en="Cite the source" th="อ้างอิงต้นทาง" />
      </label>

      {citeSource ? (
        <Field
          id={excerptId}
          label={<T en="Excerpt" th="ข้อความอ้างอิง" />}
          error={state.fieldErrors.excerpt}
          count={`${excerpt.length}/${MANUAL_EXCERPT_MAX}`}
        >
          <textarea
            id={excerptId}
            name="excerpt"
            rows={2}
            maxLength={MANUAL_EXCERPT_MAX}
            value={excerpt}
            onChange={(event) => setExcerpt(event.target.value)}
            className="w-full resize-y rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 py-2 text-[13px]
                       leading-relaxed text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          />
        </Field>
      ) : null}

      <div className="flex items-center gap-2">
        <AddButton />
        <button
          type="button"
          onClick={onDone}
          className="min-h-11 rounded-[var(--radius-card)] px-3 text-sm text-text-muted transition-colors duration-150 hover:text-text"
        >
          <T en="Cancel" th="ยกเลิก" />
        </button>
      </div>
    </form>
  );
}

function AddButton() {
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
      {pending ? <T en="Adding…" th="กำลังเพิ่ม…" /> : <T en="Add requirement" th="เพิ่มข้อกำหนด" />}
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
        {count ? <span className="ml-auto text-[11px] tabular-nums text-text-faint">{count}</span> : null}
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
