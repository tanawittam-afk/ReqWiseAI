"use client";

/**
 * The coverage summary — one compact row, never a dashboard header.
 *
 * `docs/design/INTERFACE.md` §6 rules out oversized KPI cards above the working area,
 * and CLAUDE.md rules out inventing a metric to fill a mockup. Every number here is a
 * count of rows the database actually holds; there is no score, no percentage of
 * "quality", and no sparkline.
 *
 * Each figure is a button that applies the matching filter, so the number and the view
 * beneath it can never disagree about what they are describing.
 */

import { COVERAGE_DISCLAIMER, type CoverageKey, type CoverageReport } from "@/lib/traceability/coverage";

type Figure = {
  label: string;
  value: number;
  /** The filter this figure opens. `null` for a total that filters nothing. */
  filter: CoverageKey | null;
  /** True when a non-zero value is something a reviewer should look at. */
  attention?: boolean;
};

export function CoverageRow({
  coverage,
  active,
  onFilter,
}: {
  coverage: CoverageReport;
  active: CoverageKey | "none";
  onFilter: (key: CoverageKey | "none") => void;
}) {
  const { totals } = coverage;
  const figures: Figure[] = [
    { label: "Total items", value: totals.items, filter: null },
    { label: "Linked", value: totals.linked, filter: null },
    { label: "Orphans", value: totals.orphans, filter: "orphan", attention: true },
    {
      label: "Missing acceptance criteria",
      value: totals.missingAcceptanceCriteria,
      filter: "story_without_criterion",
      attention: true,
    },
    {
      label: "Open questions",
      value: totals.openQuestions,
      filter: "unresolved_question",
      attention: true,
    },
    {
      label: "Unresolved findings",
      value: totals.unresolvedQualityFindings,
      filter: "unresolved_finding",
      attention: true,
    },
  ];

  return (
    <section aria-labelledby="coverage-heading" className="flex flex-col gap-1.5">
      <h2 id="coverage-heading" className="sr-only">
        Coverage summary
      </h2>
      <ul className="flex flex-wrap items-stretch gap-1.5">
        {figures.map((figure) => (
          <li key={figure.label}>
            <Figure
              figure={figure}
              active={figure.filter !== null && figure.filter === active}
              onFilter={onFilter}
            />
          </li>
        ))}
      </ul>
      <p className="text-xs leading-relaxed text-text-faint">{COVERAGE_DISCLAIMER}</p>
    </section>
  );
}

function Figure({
  figure,
  active,
  onFilter,
}: {
  figure: Figure;
  active: boolean;
  onFilter: (key: CoverageKey | "none") => void;
}) {
  /*
   * A figure worth attention is marked three ways — a word, a dot glyph and a border —
   * because status may never be carried by colour alone (CLAUDE.md → Accessibility).
   */
  const flagged = figure.attention === true && figure.value > 0;
  const shared =
    "flex min-h-11 flex-col justify-center rounded-[var(--radius-card)] border px-3 py-1.5 text-left";

  const body = (
    <>
      <span className="flex items-baseline gap-1.5">
        <span className="text-base font-semibold tabular-nums text-text">{figure.value}</span>
        {flagged ? (
          <span aria-hidden="true" className="size-1.5 shrink-0 self-center rounded-full bg-warn" />
        ) : null}
      </span>
      <span className="text-[11px] leading-tight text-text-faint">{figure.label}</span>
    </>
  );

  if (figure.filter === null) {
    return (
      <div className={`${shared} border-border-soft bg-surface`}>
        {body}
      </div>
    );
  }

  const filter = figure.filter;
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => onFilter(active ? "none" : filter)}
      className={`${shared} transition-colors ${
        active
          ? "border-accent-border bg-accent-soft"
          : flagged
            ? "border-warn-border bg-warn-soft hover:bg-surface-hover"
            : "border-border-soft bg-surface hover:bg-surface-hover"
      }`}
    >
      {body}
      <span className="sr-only">
        {flagged ? "Needs attention. " : ""}
        {active ? "Filter applied. Activate to clear." : "Activate to filter to these items."}
      </span>
    </button>
  );
}
