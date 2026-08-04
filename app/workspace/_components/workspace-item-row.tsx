/**
 * One requirement in a workspace-wide list.
 *
 * A compact scannable row, not a card (docs/design/INTERFACE.md §5) — the same shape
 * the analysis workspace's requirements panel uses, with one addition a cross-project
 * list needs and a single run does not: which project the row belongs to.
 *
 * The whole row is the link, and it always lands on the analysis workspace with the
 * item selected — the only surface that can act on it.
 */

import Link from "next/link";
import { itemHref } from "@/lib/workspace/outstanding";
import type { WorkspaceItemRow } from "@/lib/workspace/types";
import {
  DisplayId,
  EvidenceChip,
  ItemStatusChip,
  PriorityChip,
  ProjectChip,
  TypeChip,
} from "./item-chips";

export function ItemRow({
  item,
  showStatus = true,
}: {
  item: WorkspaceItemRow;
  /**
   * The Reviews queue groups by state, so repeating "Draft" on every row inside the
   * "Awaiting review" section would be noise. The Requirements list mixes states and
   * needs it.
   */
  showStatus?: boolean;
}) {
  return (
    <Link
      href={itemHref(item.project.id, item.analysisRunId, item.id)}
      className="group flex flex-col gap-1.5 bg-surface px-4 py-3 transition-colors hover:bg-surface-hover"
    >
      <div className="flex items-baseline gap-2">
        <DisplayId value={item.displayId} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-text group-hover:text-accent">
          {item.title}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <TypeChip type={item.type} />
        {showStatus ? <ItemStatusChip status={item.status} /> : null}
        <PriorityChip priority={item.priority} />
        <EvidenceChip cited={item.hasSourceEvidence} />
        <span aria-hidden="true" className="text-text-faint">
          ·
        </span>
        <ProjectChip name={item.project.name} archived={item.project.status === "archived"} />
      </div>
    </Link>
  );
}

/** The shared list shell — hairline-separated rows inside one panel, never cards. */
export function ItemRowList({ children }: { children: React.ReactNode }) {
  return (
    <ul className="flex flex-col gap-px overflow-hidden rounded-[var(--radius-panel)] border border-border-soft bg-border-soft">
      {children}
    </ul>
  );
}
