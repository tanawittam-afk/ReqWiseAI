"use client";

/**
 * Create a project — shaped like a document-creation panel in a desktop app, not a
 * web signup form.
 *
 * Two columns on desktop: what you are describing on the left, what will be created
 * on the right. The right column is a live summary rather than decoration — it is the
 * only place that answers "what am I about to make" without scrolling back up. On
 * tablet portrait and below the columns stack and the summary keeps the primary
 * action within thumb reach.
 *
 * A client island for four reasons: per-field errors, the domain preview, the live
 * summary, and a submit button that disables itself. Everything that decides whether
 * the project is valid happens on the server — `required` and `maxLength` here are
 * courtesy, not a gate.
 */

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import {
  PROJECT_NAME_MAX,
  PROJECT_TEXT_MAX,
  PROJECT_STAKEHOLDERS_MAX_COUNT,
} from "@/lib/contracts/project";
import { createProjectAction } from "../actions";
import { emptyProjectFormState } from "../form-state";

export type DomainOption = {
  id: string;
  key: string;
  name: string;
  description: string;
  supported: boolean;
};

const control =
  "w-full rounded-lg border border-border-soft bg-surface px-3 py-2.5 text-sm text-text " +
  "placeholder:text-text-faint transition-colors hover:border-border-strong " +
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25";

function countStakeholders(value: string): number {
  return value.split(/\r?\n/).filter((line) => line.trim() !== "").length;
}

export function ProjectForm({ domains }: { domains: DomainOption[] }) {
  const [state, formAction, pending] = useActionState(createProjectAction, emptyProjectFormState);
  const firstSupported = domains.find((d) => d.supported);

  const [domainId, setDomainId] = useState(state.values.domainProfileId || firstSupported?.id || "");
  const [name, setName] = useState(state.values.name ?? "");
  const [stakeholders, setStakeholders] = useState(state.values.knownStakeholders ?? "");
  const [outputLang, setOutputLang] = useState(state.values.outputLang || "th");

  const selected = domains.find((d) => d.id === domainId);
  const ids = useId();
  const errorFor = (field: string) => state.fieldErrors[field];

  return (
    <form action={formAction} className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
      {/* ---------------- left: what you are describing ---------------- */}
      <div className="flex flex-col gap-4">
        <Panel title="Project information" hint="One project holds one piece of business reality.">
          <Field label="Project name" htmlFor={`${ids}-name`} error={errorFor("name")} required>
            <input
              id={`${ids}-name`}
              name="name"
              type="text"
              required
              autoFocus
              maxLength={PROJECT_NAME_MAX}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Smart Space booking — discovery notes"
              aria-invalid={Boolean(errorFor("name"))}
              className={control}
            />
          </Field>

          <Field
            label="Description"
            htmlFor={`${ids}-description`}
            error={errorFor("description")}
            hint="Optional. What the work is about, in a sentence or two."
          >
            <textarea
              id={`${ids}-description`}
              name="description"
              rows={3}
              maxLength={PROJECT_TEXT_MAX}
              defaultValue={state.values.description}
              className={`${control} resize-y`}
            />
          </Field>

          <Field
            label="Business objective"
            htmlFor={`${ids}-objective`}
            error={errorFor("businessObjective")}
            hint="Optional. What the business is trying to achieve — not the software."
          >
            <textarea
              id={`${ids}-objective`}
              name="businessObjective"
              rows={3}
              maxLength={PROJECT_TEXT_MAX}
              defaultValue={state.values.businessObjective}
              className={`${control} resize-y`}
            />
          </Field>

          <Field
            label="Known stakeholders"
            htmlFor={`${ids}-stakeholders`}
            error={errorFor("knownStakeholders")}
            hint={`Optional. One per line, up to ${PROJECT_STAKEHOLDERS_MAX_COUNT}.`}
          >
            <textarea
              id={`${ids}-stakeholders`}
              name="knownStakeholders"
              rows={4}
              value={stakeholders}
              onChange={(event) => setStakeholders(event.target.value)}
              placeholder={"Front Desk Staff\nOperations Manager"}
              className={`${control} resize-y font-mono text-[13px]`}
            />
          </Field>
        </Panel>

        <Panel
          title="Business domain"
          hint="Guides the questions the analysis asks. It never becomes evidence."
        >
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Business domain</legend>
            {domains.map((domain) => {
              const checked = domainId === domain.id;
              return (
                <label
                  key={domain.id}
                  className={`flex min-h-11 items-start gap-3 rounded-lg border p-3 transition-colors ${
                    checked
                      ? "border-accent-border bg-accent-soft"
                      : "border-border-soft bg-surface hover:bg-surface-hover"
                  } ${domain.supported ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                >
                  <input
                    type="radio"
                    name="domainProfileId"
                    value={domain.id}
                    checked={checked}
                    disabled={!domain.supported}
                    onChange={() => setDomainId(domain.id)}
                    className="mt-0.5 size-4 accent-[var(--accent)]"
                  />
                  <span className="flex flex-col gap-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-medium text-text">
                      {domain.name}
                      <span className="rounded border border-border-soft px-1.5 py-0.5 text-[11px] font-normal uppercase tracking-wide text-text-faint">
                        Built-in
                      </span>
                      {domain.supported ? null : (
                        <span className="rounded border border-warn-border bg-warn-soft px-1.5 py-0.5 text-[11px] font-normal text-warn">
                          Coming soon
                        </span>
                      )}
                    </span>
                    <span className="text-xs leading-relaxed text-text-muted">
                      {domain.description}
                    </span>
                  </span>
                </label>
              );
            })}
          </fieldset>
          {errorFor("domainProfileId") ? (
            <p role="alert" className="text-sm text-danger">
              {errorFor("domainProfileId")}
            </p>
          ) : null}
        </Panel>

        <Panel
          title="Output language"
          hint="The language requirements are written in — separate from the interface language."
        >
          <div className="flex flex-wrap gap-2">
            {[
              { value: "th", label: "ไทย · Thai" },
              { value: "en", label: "English" },
            ].map((option) => (
              <label
                key={option.value}
                className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-4 text-sm transition-colors ${
                  outputLang === option.value
                    ? "border-accent-border bg-accent-soft font-medium text-text"
                    : "border-border-soft bg-surface text-text-muted hover:bg-surface-hover"
                }`}
              >
                <input
                  type="radio"
                  name="outputLang"
                  value={option.value}
                  checked={outputLang === option.value}
                  onChange={() => setOutputLang(option.value)}
                  className="size-4 accent-[var(--accent)]"
                />
                {option.label}
              </label>
            ))}
          </div>
          {errorFor("outputLang") ? (
            <p role="alert" className="text-sm text-danger">
              {errorFor("outputLang")}
            </p>
          ) : null}
        </Panel>
      </div>

      {/* ---------------- right: what will be created ---------------- */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
        {selected ? (
          <section className="rounded-[var(--radius-panel)] border border-border-soft bg-surface p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-faint">
              Domain preview
            </h2>
            <p className="mt-2 text-sm font-medium text-text">{selected.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">{selected.description}</p>
            <p className="mt-3 border-t border-border-soft pt-3 text-xs leading-relaxed text-text-muted">
              Supplies terminology, typical stakeholders and the clarifications worth asking
              for. It is <strong className="font-semibold text-text">context, not evidence</strong>
              {" "}— every requirement still has to trace back to something you actually wrote
              down.
            </p>
          </section>
        ) : null}

        <section className="rounded-[var(--radius-panel)] border border-border-soft bg-surface p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-faint">
            Will be created
          </h2>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <SummaryRow label="Name" value={name.trim() || "Untitled"} muted={!name.trim()} />
            <SummaryRow label="Domain" value={selected?.name ?? "None selected"} muted={!selected} />
            <SummaryRow label="Output" value={outputLang === "th" ? "Thai" : "English"} />
            <SummaryRow
              label="Stakeholders"
              value={String(countStakeholders(stakeholders))}
              muted={countStakeholders(stakeholders) === 0}
            />
            <SummaryRow label="Status" value="Active" />
          </dl>

          {state.error ? (
            <p
              role="alert"
              className="mt-3 rounded-lg border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger"
            >
              {state.error}
            </p>
          ) : null}

          <div className="mt-4 flex flex-col gap-2">
            <button
              type="submit"
              disabled={pending}
              aria-busy={pending}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Creating…" : "Create project"}
            </button>
            <Link
              href="/workspace/projects"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-border-soft px-4 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
            >
              Cancel
            </Link>
          </div>
        </section>
      </aside>
    </form>
  );
}

function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-panel)] border border-border-soft bg-surface p-5">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        <p className="text-xs text-text-muted">{hint}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-text">
        {label}
        {required ? (
          <span className="ml-1 text-accent" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-text-faint">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-text-faint">{label}</dt>
      <dd className={`truncate text-right text-sm ${muted ? "text-text-faint" : "text-text"}`}>
        {value}
      </dd>
    </div>
  );
}
