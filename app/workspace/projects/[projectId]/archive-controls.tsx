"use client";

/**
 * Archive and restore.
 *
 * A client island purely so the buttons can disable themselves while the action is in
 * flight — a second click would be harmless (both RPCs are idempotent) but a button
 * that looks unpressed after a press is a lie. The decision itself is entirely
 * server-side; this component knows only a project id.
 *
 * No `confirm()` dialog: archiving is reversible, and a modal here would be ceremony
 * for a decision that costs nothing to undo.
 */

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { archiveProjectAction, restoreProjectAction } from "../actions";

export function ArchiveControls({
  projectId,
  archived,
}: {
  projectId: string;
  archived: boolean;
}) {
  const [open, setOpen] = useState(false);

  if (archived) {
    return (
      <section className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-border-soft bg-surface p-4">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-faint">Restore project</h2>
        <p className="text-xs leading-relaxed text-text-muted">
          Puts the project back in the active list and makes it editable again. Only a
          workspace owner can restore.
        </p>
        <form action={restoreProjectAction}>
          <input type="hidden" name="projectId" value={projectId} />
          <SubmitButton
            idleLabel="Restore project"
            busyLabel="Restoring…"
            className="inline-flex min-h-11 w-full items-center justify-center rounded-lg bg-accent px-4 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
          />
        </form>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-border-soft bg-surface p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-text-faint">Archive project</h2>
      <p className="text-xs leading-relaxed text-text-muted">
        Takes the project out of the active list and makes it read-only. Nothing is
        deleted — sources, runs and review history stay exactly as they are, and you can
        restore it at any time.
      </p>

      {open ? (
        <form action={archiveProjectAction} className="flex flex-col gap-3">
          <input type="hidden" name="projectId" value={projectId} />
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium text-text">Reason (optional)</span>
            <input
              name="reason"
              type="text"
              maxLength={2000}
              placeholder="Client paused the engagement"
              className="w-full rounded-lg border border-border-soft bg-surface px-3 py-2.5 text-sm text-text placeholder:text-text-faint focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
            />
          </label>
          <div className="flex items-center gap-3">
            <SubmitButton
              idleLabel="Archive project"
              busyLabel="Archiving…"
              className="inline-flex min-h-11 items-center justify-center rounded-lg border border-warn-border bg-warn-soft px-4 text-sm font-semibold text-warn transition-colors hover:border-warn disabled:cursor-not-allowed disabled:opacity-60"
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md px-3 py-2 text-sm text-text-muted transition-colors hover:text-text"
            >
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-lg border border-border-soft px-4 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
        >
          Archive project…
        </button>
      )}
    </section>
  );
}

function SubmitButton({
  idleLabel,
  busyLabel,
  className,
}: {
  idleLabel: string;
  busyLabel: string;
  className: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={className}>
      {pending ? busyLabel : idleLabel}
    </button>
  );
}
