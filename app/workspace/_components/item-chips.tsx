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

export function TypeChip({ type }: { type: ItemType }) {
  return <span className={NEUTRAL}>{TYPE_SHORT_LABEL[type]}</span>;
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
