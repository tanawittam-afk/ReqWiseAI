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

import { Icon } from "@/app/_components/icon";
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
} from "@/app/workspace/_components/item-labels";
import { T } from "@/app/_components/t";
import { pick, useLocale } from "@/lib/i18n";

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
  const hasPendingChangeRequest = item.changeRequests.some((changeRequest) => changeRequest.status === "pending");
  const locale = useLocale();

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      // A bordered card per row, not a flush divider-separated line (owner override of
      // CLAUDE.md's original "compact rows, not cards" — see docs/design/INTERFACE.md
      // §5 for the trade-off this accepts: fewer rows visible per screen in exchange
      // for a row a reader can actually tell apart from its neighbours). Selection is
      // still shown three ways — border colour, the left accent stripe, and a tinted
      // background — because colour alone is never a state.
      className={`flex w-full min-h-11 flex-col gap-1 rounded-[var(--radius-card)] border border-l-[3px]
                  px-3 py-2 text-left leading-snug shadow-[var(--shadow-card)]
                  transition-colors duration-150
                  ${
                    active
                      ? "border-accent-border border-l-accent bg-accent-soft"
                      : "border-border-soft border-l-border-soft bg-surface hover:border-border-strong hover:bg-surface-hover"
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
                <span
                  className="inline-flex items-center gap-1 text-warn tabular-nums"
                  title={pick(locale, "Follow up on", "ติดตามเมื่อ")}
                >
                  <Icon name="follow-up" size={11} />
                  {item.followUpOn}
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
            <span className="tabular-nums" title={pick(locale, `Version ${item.versionNo}`, `เวอร์ชัน ${item.versionNo}`)}>
              v{item.versionNo}
            </span>
          </>
        )}
        {cited ? (
          <span className="inline-flex items-center gap-1 text-signal">
            <Icon name="quote" size={11} />
            <span className="sr-only">
              <T en="Has an exact source excerpt" th="มีข้อความอ้างอิงตรงจากต้นทาง" />
            </span>
          </span>
        ) : null}
        {item.relatedDisplayIds.length > 0 ? (
          <span className="inline-flex items-center gap-1">
            <Icon name="relations" size={11} />
            {item.relatedDisplayIds.length}
            <span className="sr-only">
              <T en="related items" th="รายการที่เกี่ยวข้อง" />
            </span>
          </span>
        ) : null}
        {hasPendingChangeRequest ? (
          <span className="inline-flex items-center gap-1 font-medium text-warn">
            <Dot />
            <Icon name="pending" size={11} />
            <span>
              <T en="Change pending" th="รอเปลี่ยนแปลง" />
            </span>
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
