"use client";

/**
 * The source editor.
 *
 * One component for all three jobs — create, edit, supersede — because they are the
 * same act of writing a document, and a person switching between them should not have
 * to relearn the screen. What differs is the heading, the button, and which action the
 * form posts to; the surface itself does not move.
 *
 * Layout follows the document/inspector split the rest of the workspace uses: the
 * writing surface takes the reading column, intake metadata sits in a panel beside it
 * on desktop and folds underneath on tablet portrait. The textarea is the largest
 * thing on the page on purpose — this is the one screen where the user is producing
 * text rather than steering the app.
 *
 * There is no autosave. There is therefore no "saving…" chrome pretending otherwise;
 * the only status shown is the one that is real (a submit in flight), and leaving with
 * unsaved changes is warned about rather than silently swallowed.
 */

import Link from "next/link";
import { useActionState, useEffect, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  SOURCE_KINDS,
  SOURCE_KIND_LABELS,
  SOURCE_TEXT_MAX,
  SOURCE_TITLE_MAX,
} from "@/lib/contracts/source";
import { emptySourceFormState, type SourceFormState } from "./form-state";

export type SourceFormMode = "create" | "edit" | "revise";

export type SourceFormValues = {
  title: string;
  kind: string;
  rawText: string;
  sourceDate: string;
  stakeholder: string;
  notes: string;
};

const EMPTY: SourceFormValues = {
  title: "",
  kind: "meeting_notes",
  rawText: "",
  sourceDate: "",
  stakeholder: "",
  notes: "",
};

export function SourceForm({
  mode,
  projectId,
  sourceId,
  revisionNumber,
  initial,
  action,
  cancelHref,
}: {
  mode: SourceFormMode;
  projectId: string;
  sourceId?: string;
  /** The revision this form will produce — shown so the outcome is never a surprise. */
  revisionNumber: number;
  initial?: Partial<SourceFormValues>;
  action: (state: SourceFormState, formData: FormData) => Promise<SourceFormState>;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, emptySourceFormState);
  const seed = { ...EMPTY, ...initial, ...(state.values as Partial<SourceFormValues>) };

  const [rawText, setRawText] = useState(seed.rawText);
  const [dirty, setDirty] = useState(false);
  const ids = {
    title: useId(),
    kind: useId(),
    rawText: useId(),
    sourceDate: useId(),
    stakeholder: useId(),
    notes: useId(),
  };

  // A browser-native warning, which is the only kind that can survive a real
  // navigation. It is armed only once something has actually been typed.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const heading =
    mode === "create"
      ? "Add source information"
      : mode === "revise"
        ? `New revision ${revisionNumber}`
        : `Edit revision ${revisionNumber}`;

  const submitLabel =
    mode === "create" ? "Save source" : mode === "revise" ? "Create revision" : "Save changes";

  const overLimit = rawText.length > SOURCE_TEXT_MAX;

  return (
    <form action={formAction} onChange={() => setDirty(true)} className="flex flex-col gap-5">
      <input type="hidden" name="projectId" value={projectId} />
      {sourceId ? <input type="hidden" name="sourceId" value={sourceId} /> : null}

      <header className="flex flex-col gap-1">
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">{heading}</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-text-muted">
          {mode === "revise"
            ? "Revision " +
              (revisionNumber - 1) +
              " has been analysed and is now permanent. Your changes are saved as a new revision, and the earlier one stays exactly as it was cited."
            : "Paste the notes, interview or message this project is about. The text is stored exactly as you enter it — every requirement is traced back to these characters."}
        </p>
      </header>

      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        {/* Reading / writing column */}
        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-4 rounded-[var(--radius-panel)] border border-border-soft bg-surface p-5">
            <Field
              id={ids.title}
              label="Title"
              hint="How you will recognise this document in the list"
              error={state.fieldErrors.title}
            >
              <input
                id={ids.title}
                name="title"
                type="text"
                required
                maxLength={SOURCE_TITLE_MAX}
                defaultValue={seed.title}
                placeholder="Kick-off meeting with the front desk team"
                aria-invalid={state.fieldErrors.title ? true : undefined}
                className={inputClass(!!state.fieldErrors.title)}
              />
            </Field>

            <Field id={ids.kind} label="Source type" error={state.fieldErrors.kind}>
              <select
                id={ids.kind}
                name="kind"
                defaultValue={seed.kind}
                className={`${inputClass(!!state.fieldErrors.kind)} appearance-none`}
              >
                {SOURCE_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {SOURCE_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </Field>
          </section>

          <section className="flex flex-col rounded-[var(--radius-panel)] border border-border-soft bg-surface">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border-soft px-5 py-3">
              <label htmlFor={ids.rawText} className="text-sm font-semibold text-text">
                Source text
              </label>
              <span
                className={`font-mono text-xs ${overLimit ? "text-danger" : "text-text-faint"}`}
              >
                {rawText.length.toLocaleString()} / {SOURCE_TEXT_MAX.toLocaleString()}
              </span>
            </div>
            <textarea
              id={ids.rawText}
              name="rawText"
              required
              rows={22}
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              spellCheck={false}
              placeholder={"Paste the raw notes here.\n\nLine breaks and spacing are preserved."}
              aria-invalid={state.fieldErrors.rawText ? true : undefined}
              aria-describedby={`${ids.rawText}-help`}
              className="min-h-[45vh] w-full resize-y rounded-b-[var(--radius-panel)] bg-surface px-5 py-4
                         font-mono text-[13.5px] leading-[1.75] text-text
                         placeholder:text-text-faint focus:outline-none"
            />
            <p
              id={`${ids.rawText}-help`}
              className="border-t border-border-soft px-5 py-2.5 text-xs text-text-faint"
            >
              Stored verbatim — spacing, blank lines and bullet characters are kept as
              typed. Nothing is reformatted.
            </p>
            {state.fieldErrors.rawText ? (
              <p role="alert" className="px-5 pb-3 text-xs text-danger">
                {state.fieldErrors.rawText}
              </p>
            ) : null}
          </section>
        </div>

        {/* Inspector — optional context, kept out of the writing column */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
          <section className="flex flex-col gap-4 rounded-[var(--radius-panel)] border border-border-soft bg-surface p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-faint">
              Context <span className="font-normal normal-case">(optional)</span>
            </h2>

            <Field id={ids.sourceDate} label="Source date" error={state.fieldErrors.sourceDate}>
              <input
                id={ids.sourceDate}
                name="sourceDate"
                type="date"
                defaultValue={seed.sourceDate}
                aria-invalid={state.fieldErrors.sourceDate ? true : undefined}
                className={inputClass(!!state.fieldErrors.sourceDate)}
              />
            </Field>

            <Field
              id={ids.stakeholder}
              label="Stakeholder"
              hint="Who said it, if this came from a person"
              error={state.fieldErrors.stakeholder}
            >
              <input
                id={ids.stakeholder}
                name="stakeholder"
                type="text"
                defaultValue={seed.stakeholder}
                placeholder="Front Desk Manager"
                className={inputClass(!!state.fieldErrors.stakeholder)}
              />
            </Field>

            <Field id={ids.notes} label="Notes" error={state.fieldErrors.notes}>
              <textarea
                id={ids.notes}
                name="notes"
                rows={4}
                defaultValue={seed.notes}
                placeholder="How this document was obtained, what to be careful about"
                className={`${inputClass(!!state.fieldErrors.notes)} resize-y leading-relaxed`}
              />
            </Field>
          </section>

          <div className="flex flex-col gap-2 rounded-[var(--radius-panel)] border border-border-soft bg-surface p-4">
            <p className="text-xs text-text-faint">
              Saves as <span className="font-medium text-text-muted">revision {revisionNumber}</span>
              {mode === "revise" ? " — the previous revision stays untouched." : "."}
            </p>
            <SubmitButton label={submitLabel} disabled={overLimit} />
            <Link
              href={cancelHref}
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border-soft
                         px-4 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
            >
              Cancel
            </Link>
          </div>
        </aside>
      </div>
    </form>
  );
}

function inputClass(invalid: boolean): string {
  return `w-full min-h-11 rounded-lg border bg-surface px-3 py-2.5 text-sm text-text
          placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-accent/25
          ${invalid ? "border-danger" : "border-border-soft focus:border-accent"}`;
}

function Field({
  id,
  label,
  hint,
  error,
  children,
}: {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-text">
        {label}
      </label>
      {children}
      {error ? (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-text-faint">{hint}</p>
      ) : null}
    </div>
  );
}

/** Disabled while the action is in flight — the one honest way to stop a double post. */
function SubmitButton({ label, disabled }: { label: string; disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      aria-busy={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm
                 font-semibold text-on-accent transition-colors hover:bg-accent-hover
                 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}
