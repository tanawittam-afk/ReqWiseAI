"use client";

/**
 * One compact row above the workspace — never a dashboard header, because every pixel
 * it takes is a line of requirement text someone cannot read (docs/design/INTERFACE.md
 * §6).
 *
 * Every number here is counted from the run's own items. There is no quality score and
 * no coverage percentage: neither is defined anywhere in the product, and a number
 * invented to fill a layout is exactly what this application exists to prevent.
 */

import type { RunSummary } from "@/lib/analysis/workspace-view";

export function SummaryBar({
  summary,
  runDate,
  sourceCount,
  inspectorOpen,
  onToggleInspector,
}: {
  summary: RunSummary;
  runDate: string;
  /** One, by construction — a run analyses exactly one source revision (DATA-MODEL). */
  sourceCount: number;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-border-soft bg-chrome px-4 py-2">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-ok" />
        Analysis completed
        <span className="font-normal text-text-faint">{runDate}</span>
      </span>

      <span aria-hidden="true" className="hidden h-4 w-px bg-border-soft sm:block" />

      <Metric label="Requirements" value={summary.requirementCount} />
      <Metric label="Open questions" value={summary.openQuestions} />
      <Metric label="Risks" value={summary.risks} />
      <Metric label="Quality findings" value={summary.qualityFindings} />
      <Metric label="Cited" value={`${summary.citedCount}/${summary.itemCount}`} />
      <Metric label="Sources" value={sourceCount} />

      <button
        type="button"
        onClick={onToggleInspector}
        aria-pressed={inspectorOpen}
        className={`ml-auto hidden min-h-9 shrink-0 rounded-lg border px-2.5 text-xs font-medium
                    transition-colors duration-150 lg:block ${
                      inspectorOpen
                        ? "border-accent-border bg-accent-soft text-accent"
                        : "border-border-soft bg-surface text-text-muted hover:bg-surface-hover"
                    }`}
      >
        Inspector
      </button>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | string }) {
  return (
    <span className="text-xs text-text-faint">
      {label} <span className="font-medium tabular-nums text-text-muted">{value}</span>
    </span>
  );
}
