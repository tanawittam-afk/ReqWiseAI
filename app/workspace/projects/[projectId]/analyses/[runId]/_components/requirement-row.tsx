"use client";

/**
 * One requirement, compact enough that a screenful is a working set rather than a
 * sample. Two lines: identity and title, then the metadata an analyst scans for —
 * type, priority, confidence, review status, and the evidence behind it.
 *
 * Selection is shown three ways at once (left accent bar, tinted background,
 * `aria-current`) because colour alone is not a state (CLAUDE.md → Accessibility) and
 * a glow alone is not either (docs/design/INTERFACE.md §3).
 */

import type { AnalysisItemView } from "@/lib/analysis/queries";
import { computeHighlightRanges } from "@/lib/analysis/highlight";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TYPE_SHORT_LABEL,
  confidencePercent,
  labelFor,
} from "./labels";

/** The most useful line of evidence to show inline, in order of directness. */
function supportingLine(item: AnalysisItemView): string {
  const excerpt = item.sourceReferences[0]?.excerpt?.trim();
  if (excerpt) return excerpt;
  if (item.rationale?.trim()) return item.rationale.trim();
  return item.description.trim();
}

export function RequirementRow({
  item,
  active,
  onSelect,
}: {
  item: AnalysisItemView;
  active: boolean;
  onSelect: () => void;
}) {
  const cited = computeHighlightRanges(item).length > 0;
  const supporting = supportingLine(item);

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={`flex w-full min-h-11 flex-col gap-0.5 border-l-2 px-3 py-1.5 text-left leading-snug
                  transition-colors duration-150
                  ${
                    active
                      ? "border-l-accent bg-accent-soft"
                      : "border-l-transparent hover:bg-surface-hover"
                  }`}
    >
      <div className="flex items-baseline gap-2">
        <span className="shrink-0 font-mono text-[11px] font-semibold text-text-faint">
          {item.displayId}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-text">
          {item.title}
        </span>
        <span className="shrink-0 tabular-nums text-[11px] text-text-faint">
          {confidencePercent(item.confidence)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-x-2 text-[11px] leading-tight text-text-faint">
        <span className="text-text-muted">{TYPE_SHORT_LABEL[item.type]}</span>
        <Dot />
        <span>{labelFor(PRIORITY_LABEL, item.priority)}</span>
        <Dot />
        <span>{labelFor(STATUS_LABEL, item.status)}</span>
        {cited ? (
          <span className="inline-flex items-center gap-1 text-signal">
            <span aria-hidden="true">◆</span>
            <span className="sr-only">Has an exact source excerpt</span>
          </span>
        ) : null}
        {item.relatedDisplayIds.length > 0 ? (
          <span className="inline-flex items-center gap-1">
            <span aria-hidden="true">⇄</span>
            {item.relatedDisplayIds.length}
            <span className="sr-only">related items</span>
          </span>
        ) : null}
      </div>

      {supporting ? (
        <p className="line-clamp-1 text-[11.5px] leading-tight text-text-muted">{supporting}</p>
      ) : null}
    </button>
  );
}

function Dot() {
  return (
    <span aria-hidden="true" className="text-border-strong">
      ·
    </span>
  );
}
