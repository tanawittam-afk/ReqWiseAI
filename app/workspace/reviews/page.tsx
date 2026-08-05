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
import { T } from "../../_components/t";

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
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-[var(--space-shell-gap)] px-[var(--space-shell-x)] py-[var(--space-shell-y)] sm:px-[var(--space-shell-x-lg)] sm:py-[var(--space-shell-y-lg)]">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">
          <T en="Reviews" th="การตรวจสอบ" />
        </h1>
        <p className="text-sm text-text-muted">
          {total === 0 ? (
            <T
              en="Nothing is waiting on you. Every requirement, question and finding has been decided."
              th="ไม่มีสิ่งใดรอคุณอยู่ ทุกข้อกำหนด คำถาม และข้อค้นพบได้รับการตัดสินใจแล้ว"
            />
          ) : (
            <T
              en={`${total} ${total === 1 ? "item is" : "items are"} waiting on a decision. Nothing is ever approved without you.`}
              th={`มี ${total} รายการรอการตัดสินใจ ไม่มีสิ่งใดถูกอนุมัติโดยไม่ผ่านคุณ`}
            />
          )}
        </p>
      </header>

      <Section
        anchor={BUCKET_ANCHOR.awaiting_review}
        title={{ en: "Requirements awaiting review", th: "ข้อกำหนดที่รอตรวจสอบ" }}
        count={counts.awaiting_review}
        blurb={{
          en: "Draft, or sent back for clarification. Every one of these was generated as a draft — no code path can create a requirement in any other status.",
          th: "อยู่ในสถานะร่างหรือถูกตีกลับเพื่อขอความชัดเจน ทุกรายการถูกสร้างขึ้นเป็นร่าง — ไม่มีเส้นทางใดสร้างข้อกำหนดในสถานะอื่นได้",
        }}
        empty={{ en: "Every requirement has been reviewed.", th: "ข้อกำหนดทุกข้อได้รับการตรวจสอบแล้ว" }}
      >
        <ItemsSection items={work.awaitingReview} />
      </Section>

      <Section
        anchor={BUCKET_ANCHOR.unanswered_questions}
        title={{ en: "Unanswered questions", th: "คำถามที่ยังไม่มีคำตอบ" }}
        count={counts.unanswered_questions}
        blurb={{
          en: "The analysis surfaced missing information instead of guessing at it. Each one needs an answer, a deferral, or a note that it does not apply.",
          th: "การวิเคราะห์แจ้งข้อมูลที่ขาดหายแทนการเดา แต่ละรายการต้องการคำตอบ การเลื่อนออกไป หรือหมายเหตุว่าไม่เกี่ยวข้อง",
        }}
        empty={{ en: "No open questions.", th: "ไม่มีคำถามที่ยังเปิดอยู่" }}
      >
        <ItemsSection items={work.unansweredQuestions} />
      </Section>

      <Section
        anchor={BUCKET_ANCHOR.open_findings}
        title={{ en: "Open quality findings", th: "ข้อค้นพบด้านคุณภาพที่ยังไม่ปิด" }}
        count={counts.open_findings}
        blurb={{
          en: "Ambiguous, incomplete, conflicting, untestable or duplicated requirements the analysis found in its own output. Acknowledged still counts — seeing a finding is not resolving it.",
          th: "ข้อกำหนดที่คลุมเครือ ไม่ครบถ้วน ขัดแย้ง ทดสอบไม่ได้ หรือซ้ำซ้อน ที่การวิเคราะห์พบในผลลัพธ์ของตัวเอง การรับทราบยังไม่ใช่การแก้ไข",
        }}
        empty={{ en: "No findings outstanding.", th: "ไม่มีข้อค้นพบที่ค้างอยู่" }}
      >
        <ItemsSection items={work.openFindings} />
      </Section>

      <Section
        anchor={BUCKET_ANCHOR.pending_change_requests}
        title={{ en: "Change requests pending", th: "คำขอเปลี่ยนแปลงที่รออนุมัติ" }}
        count={counts.pending_change_requests}
        blurb={{
          en: "A proposal against a requirement that was already approved or rejected. Approved and rejected content is never silently rewritten — a disagreement becomes a new object with its own audit trail.",
          th: "ข้อเสนอต่อข้อกำหนดที่ได้รับการอนุมัติหรือปฏิเสธไปแล้ว เนื้อหาที่อนุมัติหรือปฏิเสธแล้วจะไม่ถูกเขียนทับโดยไม่แจ้ง — ความเห็นต่างจะกลายเป็นออบเจกต์ใหม่ที่มีประวัติของตัวเอง",
        }}
        empty={{ en: "No change requests waiting.", th: "ไม่มีคำขอเปลี่ยนแปลงที่รออยู่" }}
      >
        <ChangeRequestSection rows={work.pendingChangeRequests} />
      </Section>
    </main>
  );
}

type Bilingual = { en: string; th: string };

function Section({
  anchor,
  title,
  count,
  blurb,
  empty,
  children,
}: {
  anchor: string;
  title: Bilingual;
  count: number;
  blurb: Bilingual;
  empty: Bilingual;
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
            <T en={title.en} th={title.th} />
          </h2>
          <span
            className={`font-mono text-xs font-semibold ${count > 0 ? "text-accent" : "text-text-faint"}`}
          >
            {count}
          </span>
        </div>
        <p className="max-w-2xl text-xs leading-relaxed text-text-faint">
          <T en={blurb.en} th={blurb.th} />
        </p>
      </div>

      {count === 0 ? (
        <p className="rounded-[var(--radius-panel)] border border-border-soft bg-surface px-4 py-6 text-sm text-text-muted">
          <T en={empty.en} th={empty.th} />
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
                <T
                  en={`Replaces "${row.targetTitle}" · raised ${formatDate(row.requestedAt)}`}
                  th={`แทนที่ "${row.targetTitle}" · เสนอเมื่อ ${formatDate(row.requestedAt)}`}
                />
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
