/**
 * Compact item descriptors shared by the workspace-wide views.
 *
 * Every one of these carries a **word**, never a colour alone (CLAUDE.md →
 * Accessibility), and every one reads its text from `item-labels.ts` rather than
 * writing a second copy of it.
 */

import { Icon } from "@/app/_components/icon";
import type { ItemType } from "@/lib/contracts/item-types";
import {
  PRIORITY_LABEL,
  STATUS_LABEL,
  TYPE_SHORT_LABEL,
  labelFor,
} from "./item-labels";
import { T } from "@/app/_components/t";

const NEUTRAL =
  "inline-flex items-center rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-1.5 py-0.5 text-[11px] font-medium text-text-muted";

/**
 * Soft per-type tints (`CLAUDE.md` → Visual character, `INTERFACE.md` §9), added
 * 2026-09-02 alongside the tokens themselves — fourteen item types collapse into four
 * content families, not fourteen colours, so this stays signal rather than noise:
 * context (what the analysis is about) · requirement (what must be built) · spec (how
 * it is expressed) · caveat (a condition on the above). Risk, open question and quality
 * finding are deliberately excluded — they are states needing attention, so they keep
 * the existing `--warn`/`--danger` tone `ItemStatusChip` already uses for the same kind
 * of state, not a content-family tint.
 */
const TYPE_TINT: Partial<Record<ItemType, string>> = {
  problem_statement: "border-tint-context-border bg-tint-context-soft text-tint-context",
  business_objective: "border-tint-context-border bg-tint-context-soft text-tint-context",
  stakeholder: "border-tint-context-border bg-tint-context-soft text-tint-context",
  business_requirement:
    "border-tint-requirement-border bg-tint-requirement-soft text-tint-requirement",
  functional_requirement:
    "border-tint-requirement-border bg-tint-requirement-soft text-tint-requirement",
  non_functional_requirement:
    "border-tint-requirement-border bg-tint-requirement-soft text-tint-requirement",
  business_rule:
    "border-tint-requirement-border bg-tint-requirement-soft text-tint-requirement",
  user_story: "border-tint-spec-border bg-tint-spec-soft text-tint-spec",
  acceptance_criterion: "border-tint-spec-border bg-tint-spec-soft text-tint-spec",
  assumption: "border-tint-caveat-border bg-tint-caveat-soft text-tint-caveat",
  constraint: "border-tint-caveat-border bg-tint-caveat-soft text-tint-caveat",
  risk: "border-danger-border bg-danger-soft text-danger",
  open_question: "border-warn-border bg-warn-soft text-warn",
  quality_finding: "border-warn-border bg-warn-soft text-warn",
};

export function TypeChip({ type }: { type: ItemType }) {
  const tint = TYPE_TINT[type];
  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius-card)] border px-1.5 py-0.5 text-[11px] font-medium ${
        tint ?? "border-border-soft bg-surface-muted text-text-muted"
      }`}
    >
      {TYPE_SHORT_LABEL[type]}
    </span>
  );
}

/**
 * Review status. `draft` and `needs_clarification` are the two states that mean
 * somebody still has to act, so they carry the warn tone; the rest stay neutral —
 * "approved" is not an alert.
 */
export function ItemStatusChip({ status }: { status: string }) {
  const pending = status === "draft" || status === "needs_clarification";
  return (
    <span
      className={
        pending
          ? "inline-flex items-center rounded-[var(--radius-card)] border border-warn-border bg-warn-soft px-1.5 py-0.5 text-[11px] font-medium text-warn"
          : NEUTRAL
      }
    >
      {labelFor(STATUS_LABEL, status)}
    </span>
  );
}

export function PriorityChip({ priority }: { priority: string }) {
  if (priority === "unassigned") return null;
  return (
    <span className={NEUTRAL}>{labelFor(PRIORITY_LABEL, priority)}</span>
  );
}

/**
 * Whether the item is cited. `--signal` is reserved for citation and liveness and for
 * nothing else (CLAUDE.md → Design direction), which is precisely what this is.
 */
export function EvidenceChip({ cited }: { cited: boolean }) {
  if (!cited) {
    return (
      <span className={NEUTRAL}>
        <T en="Not cited" th="ไม่มีการอ้างอิง" />
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-[var(--radius-card)] border border-signal-border bg-signal-soft px-1.5 py-0.5 text-[11px] font-medium text-signal">
      <Icon name="quote" size={11} />
      <T en="Cited" th="มีการอ้างอิง" />
    </span>
  );
}

/** The display id, in mono — the one string a stakeholder quotes back at you. */
export function DisplayId({ value }: { value: string }) {
  return (
    <span className="font-mono text-[11px] font-medium tracking-wide text-text-faint">{value}</span>
  );
}

/** Which project a row belongs to. Only ever shown on the cross-project views. */
export function ProjectChip({ name, archived }: { name: string; archived: boolean }) {
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-text-faint">
      <Icon name="projects" size={11} />
      <span className="max-w-[24ch] truncate">{name}</span>
      {archived ? (
        <span className="text-text-faint">
          · <T en="Archived" th="เก็บถาวรแล้ว" />
        </span>
      ) : null}
    </span>
  );
}
