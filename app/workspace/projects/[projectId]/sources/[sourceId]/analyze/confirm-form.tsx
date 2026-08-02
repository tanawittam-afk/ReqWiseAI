"use client";

/**
 * The analyze confirmation.
 *
 * `requestKey` is generated once, on mount — not per render — so a double click on
 * the submit button, or a browser retrying a slow POST, resubmits the exact same key
 * and `persist_analysis_result()` answers with the run that already exists rather
 * than creating a second one. Reloading this page mints a new key, which is correct:
 * that is a new confirmation, not a retry of the old one.
 */

import { useActionState, useState } from "react";
import type { ProviderOption } from "@/lib/config/env";
import type { ProviderKey } from "@/lib/providers/types";
import { analyzeSourceAction } from "./actions";
import { emptyAnalyzeFormState } from "./form-state";
import { AnalysisProviderControls } from "./provider-controls";

export function AnalyzeConfirmForm({
  projectId,
  sourceId,
  revisionNumber,
  alreadyLocked,
  providerOptions,
  defaultProvider,
}: {
  projectId: string;
  sourceId: string;
  revisionNumber: number;
  alreadyLocked: boolean;
  providerOptions: ProviderOption[];
  defaultProvider: ProviderKey;
}) {
  const [state, formAction, pending] = useActionState(
    analyzeSourceAction,
    emptyAnalyzeFormState,
  );
  const [requestKey] = useState(() => crypto.randomUUID());

  return (
    <form action={formAction} aria-busy={pending} className="flex flex-col gap-5">
      <input type="hidden" name="projectId" value={projectId} />
      <input type="hidden" name="sourceId" value={sourceId} />
      <input type="hidden" name="requestKey" value={requestKey} />

      {state.error ? (
        <p
          role="alert"
          className="rounded-[var(--radius-card)] border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {state.error}
        </p>
      ) : null}

      <ul className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-border-soft bg-surface p-5 text-sm leading-relaxed text-text-muted">
        <ConfirmPoint>
          The system will analyse <strong className="text-text">revision {revisionNumber}</strong> of
          this document, exactly as it currently reads.
        </ConfirmPoint>
        <ConfirmPoint>
          {alreadyLocked
            ? "This revision is already locked by an earlier analysis. Running it again creates a new, separate run — the earlier run and its results are untouched."
            : "This revision will be locked once the run is created. To change the text afterwards, create a new revision."}
        </ConfirmPoint>
        <ConfirmPoint>
          Every requirement this produces starts as a <strong className="text-text">draft</strong> —
          nothing is approved automatically.
        </ConfirmPoint>
        <ConfirmPoint>
          The domain profile guides the analysis; it is never treated as evidence about
          this specific source.
        </ConfirmPoint>
        <ConfirmPoint>
          Choose the analysis provider for this run. The saved run records which
          provider produced it.
        </ConfirmPoint>
      </ul>

      <AnalysisProviderControls
        providerOptions={providerOptions}
        defaultProvider={defaultProvider}
        pending={pending}
      />
    </form>
  );
}

function ConfirmPoint({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span aria-hidden="true" className="mt-1 text-signal">
        ◆
      </span>
      <span>{children}</span>
    </li>
  );
}
