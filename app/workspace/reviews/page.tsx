/**
 * Reviews — the outstanding-work queue.
 *
 * Four sections, one per thing that can be waiting on a person: requirements not yet
 * decided, questions nobody has answered, quality findings still in play, and change
 * requests proposed against an already-decided requirement. The dashboard's four
 * counts link straight to these anchors, and both read the **same** predicates
 * (`lib/workspace/outstanding.ts`) — a count and the list it refers to cannot drift
 * apart, because there is only one definition of each.
 *
 * Nothing here acts on an item. Every row links to the analysis workspace, which is
 * the only surface that may review, answer or resolve one — and which re-derives
 * authorization server-side regardless of what this page rendered.
 *
 * Archived projects are absent by construction (see `outstanding.ts`): they are
 * read-only, so nothing in one can be worked on.
 */

import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  BUCKET_ANCHOR,
  itemHref,
  outstandingCounts,
  partitionOutstanding,
  totalOutstanding,
} from "@/lib/workspace/outstanding";
import { listPendingChangeRequests, listWorkspaceItems } from "@/lib/workspace/queries";
import type { WorkspaceChangeRequestRow, WorkspaceItemRow } from "@/lib/workspace/types";
import { formatDate } from "../_components/badges";
import { DisplayId, ProjectChip } from "../_components/item-chips";
import { ItemRow, ItemRowList } from "../_components/workspace-item-row";

export const metadata = { title: "Reviews — ReqWise AI" };

export default async function ReviewsPage() {
  const supabase = await createClient();
  const [{ items }, changeRequests] = await Promise.all([
    listWorkspaceItems(supabase),
    listPendingChangeRequests(supabase),
  ]);

  const work = partitionOutstanding(items, changeRequests);
  const counts = outstandingCounts(work);
  const total = totalOutstanding(counts);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">Reviews</h1>
        <p className="text-sm text-text-muted">
          {total === 0
            ? "Nothing is waiting on you. Every requirement, question and finding has been decided."
            : `${total} ${total === 1 ? "item is" : "items are"} waiting on a decision. Nothing is ever approved without you.`}
        </p>
      </header>

      <Section
        anchor={BUCKET_ANCHOR.awaiting_review}
        title="Requirements awaiting review"
        count={counts.awaiting_review}
        blurb="Draft, or sent back for clarification. Every one of these was generated as a draft — no code path can create a requirement in any other status."
        empty="Every requirement has been reviewed."
      >
        <ItemsSection items={work.awaitingReview} />
      </Section>

      <Section
        anchor={BUCKET_ANCHOR.unanswered_questions}
        title="Unanswered questions"
        count={counts.unanswered_questions}
        blurb="The analysis surfaced missing information instead of guessing at it. Each one needs an answer, a deferral, or a note that it does not apply."
        empty="No open questions."
      >
        <ItemsSection items={work.unansweredQuestions} />
      </Section>

      <Section
        anchor={BUCKET_ANCHOR.open_findings}
        title="Open quality findings"
        count={counts.open_findings}
        blurb="Ambiguous, incomplete, conflicting, untestable or duplicated requirements the analysis found in its own output. Acknowledged still counts — seeing a finding is not resolving it."
        empty="No findings outstanding."
      >
        <ItemsSection items={work.openFindings} />
      </Section>

      <Section
        anchor={BUCKET_ANCHOR.pending_change_requests}
        title="Change requests pending"
        count={counts.pending_change_requests}
        blurb="A proposal against a requirement that was already approved or rejected. Approved and rejected content is never silently rewritten — a disagreement becomes a new object with its own audit trail."
        empty="No change requests waiting."
      >
        <ChangeRequestSection rows={work.pendingChangeRequests} />
      </Section>
    </main>
  );
}

function Section({
  anchor,
  title,
  count,
  blurb,
  empty,
  children,
}: {
  anchor: string;
  title: string;
  count: number;
  blurb: string;
  empty: string;
  children: React.ReactNode;
}) {
  const headingId = `${anchor}-heading`;
  return (
    // `scroll-mt` so a `#anchor` landing from the dashboard does not tuck the heading
    // under the sticky toolbar.
    <section id={anchor} aria-labelledby={headingId} className="flex scroll-mt-20 flex-col gap-3">
      <div className="flex flex-col gap-1">
        <div className="flex items-baseline gap-2">
          <h2 id={headingId} className="text-sm font-semibold text-text">
            {title}
          </h2>
          <span
            className={`font-mono text-xs font-semibold ${count > 0 ? "text-accent" : "text-text-faint"}`}
          >
            {count}
          </span>
        </div>
        <p className="max-w-2xl text-xs leading-relaxed text-text-faint">{blurb}</p>
      </div>

      {count === 0 ? (
        <p className="rounded-[var(--radius-panel)] border border-border-soft bg-surface px-4 py-6 text-sm text-text-muted">
          {empty}
        </p>
      ) : (
        children
      )}
    </section>
  );
}

function ItemsSection({ items }: { items: WorkspaceItemRow[] }) {
  return (
    <ItemRowList>
      {items.map((item) => (
        <li key={item.id}>
          <ItemRow item={item} showStatus={false} />
        </li>
      ))}
    </ItemRowList>
  );
}

/**
 * A change request row shows the *proposal*, not the item — the reason it exists is
 * the thing a reviewer has to weigh. It links to the target item, where the Change
 * requests tab holds the approve/reject actions.
 */
function ChangeRequestSection({ rows }: { rows: WorkspaceChangeRequestRow[] }) {
  return (
    <ItemRowList>
      {rows.map((row) => (
        <li key={row.id}>
          <Link
            href={itemHref(row.project.id, row.analysisRunId, row.targetItemId)}
            className="group flex flex-col gap-1.5 bg-surface px-4 py-3 transition-colors hover:bg-surface-hover"
          >
            <div className="flex items-baseline gap-2">
              <DisplayId value={row.targetDisplayId} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-text group-hover:text-accent">
                {row.proposedTitle}
              </span>
            </div>
            <p className="line-clamp-2 text-xs leading-relaxed text-text-muted">{row.reason}</p>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-text-faint">
                Replaces “{row.targetTitle}” · raised {formatDate(row.requestedAt)}
              </span>
              <span aria-hidden="true" className="text-text-faint">
                ·
              </span>
              <ProjectChip name={row.project.name} archived={false} />
            </div>
          </Link>
        </li>
      ))}
    </ItemRowList>
  );
}
