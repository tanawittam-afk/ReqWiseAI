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
  WORKFLOW_STATE_LABEL,
  isWorkflowItemType,
  type WorkflowState,
} from "@/lib/contracts/workflow";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TYPE_SHORT_LABEL,
  confidencePercent,
  labelFor,
} from "./labels";

/**
 * Review status carries a tone as well as its word — the word is what conveys the
 * state, the tone is what makes a screenful scannable. Never the tone alone.
 */
const STATUS_TONE: Record<string, string> = {
  needs_clarification: "text-warn",
  reviewed: "text-signal",
  approved: "text-ok",
  rejected: "text-danger",
};

/** The same rule for the workflow states: the word carries the meaning, the tone scans. */
const WORKFLOW_TONE: Record<string, string> = {
  open: "text-text-muted",
  acknowledged: "text-signal",
  deferred: "text-warn",
  answered: "text-ok",
  resolved: "text-ok",
  dismissed: "text-text-faint",
  not_applicable: "text-text-faint",
};

/** `attributes.finding` is a real provider field — the kind of defect, not a severity. */
function findingKind(item: AnalysisItemView): string | null {
  const value = (item.attributes ?? {}).finding;
  return typeof value === "string" ? value : null;
}

/**
 * The most useful line to show inline, in order of directness.
 *
 * For a question or finding that has been decided, the *answer* is what a reader wants
 * on the row — the excerpt is still one tab away, and the decision is the new fact.
 */
function supportingLine(item: AnalysisItemView): string {
  const resolution = item.resolutionText?.trim();
  if (resolution) return resolution;
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
  const workflow = isWorkflowItemType(item.type);
  const state = item.workflowState ?? "open";
  const kind = workflow ? findingKind(item) : null;

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
        {workflow ? (
          <>
            <Dot />
            <span className={WORKFLOW_TONE[state] ?? ""}>
              {WORKFLOW_STATE_LABEL[state as WorkflowState] ?? state}
            </span>
            {kind ? (
              <>
                <Dot />
                <span>{kind}</span>
              </>
            ) : null}
            {item.followUpOn ? (
              <>
                <Dot />
                <span className="text-warn tabular-nums" title="Follow up on">
                  ⏱ {item.followUpOn}
                </span>
              </>
            ) : null}
          </>
        ) : (
          <>
            <Dot />
            <span>{labelFor(PRIORITY_LABEL, item.priority)}</span>
            <Dot />
            <span className={STATUS_TONE[item.status] ?? ""}>
              {labelFor(STATUS_LABEL, item.status)}
            </span>
            <Dot />
            <span className="tabular-nums" title={`Version ${item.versionNo}`}>
              v{item.versionNo}
            </span>
          </>
        )}
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
