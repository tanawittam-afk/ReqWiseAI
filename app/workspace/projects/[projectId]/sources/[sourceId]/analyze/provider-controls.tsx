import type { ProviderOption } from "@/lib/config/env";
import type { ProviderKey } from "@/lib/providers/types";

export function AnalysisProviderControls({
  providerOptions,
  defaultProvider,
  pending,
}: {
  providerOptions: ProviderOption[];
  defaultProvider: ProviderKey;
  pending: boolean;
}) {
  return (
    <>
      <fieldset disabled={pending} className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-text">Analysis provider</legend>
        <div className="mt-1 flex flex-col gap-2">
          {providerOptions.map((option) => {
            const explanationId =
              option.key === "gemini" && !option.available
                ? "gemini-unavailable-explanation"
                : undefined;

            return (
              <label
                key={option.key}
                className={`flex min-h-11 items-start gap-3 rounded-lg border px-3 py-2.5 ${
                  option.available
                    ? "border-border-soft bg-surface text-text"
                    : "cursor-not-allowed border-border-soft bg-surface-muted text-text-muted"
                }`}
              >
                <input
                  type="radio"
                  name="provider"
                  value={option.key}
                  defaultChecked={option.key === defaultProvider && option.available}
                  disabled={pending || !option.available}
                  aria-describedby={explanationId}
                  className="mt-0.5 size-4 shrink-0 accent-accent"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{option.label}</span>
                  {explanationId ? (
                    <span
                      id={explanationId}
                      className="mt-0.5 block text-xs leading-relaxed text-text-muted"
                    >
                      Gemini is not available in this workspace. Choose Deterministic
                      Mock or try again later.
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-lg bg-accent px-5 text-sm
                     font-semibold text-on-accent transition-colors hover:bg-accent-hover
                     disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Analysing…" : "Analyze requirements"}
        </button>
        <p
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="text-xs text-text-muted"
        >
          {pending ? "Analysis in progress. Keep this page open." : ""}
        </p>
      </div>
    </>
  );
}
