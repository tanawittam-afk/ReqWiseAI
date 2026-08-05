"use client";

/**
 * The Answer tab on a question, the Resolution tab on a finding.
 *
 * What it shows is decided by the item's own workflow state: an open item shows the
 * form, a closed one shows the decision that closed it and the way back. The two are
 * never on screen at once, because "here is the answer, and also here is a form to
 * answer it" is how somebody overwrites a colleague's work by accident.
 */

import { T } from "@/app/_components/t";
import { pick, useLocale, type Locale } from "@/lib/i18n";
import type { AnalysisItemView } from "@/lib/analysis/queries";
import { WORKFLOW_STATE_LABEL, type WorkflowState } from "@/lib/contracts/workflow";
import { FieldLabel } from "./panel";
import { WorkflowActions } from "./workflow-actions";

function when(timestamp: string | null): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function day(value: string | null): string {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Actor names are not shown for other people: `profiles` is readable only by its own
 * user (RLS policy `profiles_select_self`), so naming somebody else would mean widening
 * who can read whose profile — a tenancy decision, not a detail of this panel.
 */
function actor(id: string | null, currentUserId: string | null, locale: Locale): string {
  if (id === null) return pick(locale, "Unknown", "ไม่ทราบ");
  return id === currentUserId
    ? pick(locale, "You", "คุณ")
    : pick(locale, "Another workspace member", "สมาชิกคนอื่นในทีม");
}

export function WorkflowTab({
  item,
  allItems,
  projectId,
  runId,
  canAct,
  currentUserId,
  onDirtyChange,
}: {
  item: AnalysisItemView;
  allItems: AnalysisItemView[];
  projectId: string;
  runId: string;
  canAct: boolean;
  currentUserId: string | null;
  onDirtyChange: (dirty: boolean) => void;
}) {
  const locale = useLocale();
  const isQuestion = item.type === "open_question";
  const state = (item.workflowState ?? "open") as WorkflowState;
  const decided = item.resolutionText !== null && item.resolutionText.trim() !== "";

  return (
    <div className="flex flex-col gap-4">
      {decided ? (
        <section className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border-soft bg-surface-muted p-3">
          <FieldLabel>
            {isQuestion ? (
              state === "answered" ? (
                <T en="Stakeholder answer" th="คำตอบจากผู้มีส่วนได้ส่วนเสีย" />
              ) : state === "deferred" ? (
                <T en="Why this is deferred" th="เหตุผลที่เลื่อนออกไป" />
              ) : (
                <T en="Why this does not apply" th="เหตุผลที่ไม่เกี่ยวข้อง" />
              )
            ) : state === "resolved" ? (
              <T en="How this was resolved" th="วิธีการแก้ไข" />
            ) : (
              <T en="Why this finding does not stand" th="เหตุผลที่ข้อค้นพบนี้ไม่ยืนยัน" />
            )}
          </FieldLabel>
          <p className="whitespace-pre-wrap text-[13px] leading-relaxed text-text">
            {item.resolutionText}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-faint">
            <span>{actor(item.resolvedBy, currentUserId, locale)}</span>
            {item.resolvedAt ? (
              <>
                <span aria-hidden="true">·</span>
                <span className="tabular-nums">{when(item.resolvedAt)}</span>
              </>
            ) : null}
            <span aria-hidden="true">·</span>
            <span>{WORKFLOW_STATE_LABEL[state] ?? state}</span>
          </div>
          {item.followUpOn ? (
            <p className="text-[11.5px] text-warn">
              <T en="Follow up on" th="ติดตามผลที่" /> {day(item.followUpOn)}
            </p>
          ) : null}
        </section>
      ) : null}

      {state === "acknowledged" ? (
        <p className="rounded-[var(--radius-card)] border border-signal-border bg-signal-soft px-3 py-2 text-[12px] leading-relaxed text-signal">
          <T
            en={
              <>
                Acknowledged means somebody has seen this finding. It is <strong>not</strong>{" "}
                fixed — the finding stays open until it is resolved or dismissed.
              </>
            }
            th={
              <>
                รับทราบหมายถึงมีคนเห็นข้อค้นพบนี้แล้ว แต่<strong>ไม่ได้</strong>
                หมายความว่าแก้ไขแล้ว — ข้อค้นพบยังคงเปิดอยู่จนกว่าจะถูกแก้ไขหรือยกเลิก
              </>
            }
          />
        </p>
      ) : null}

      <WorkflowActions
        item={item}
        allItems={allItems}
        projectId={projectId}
        runId={runId}
        canAct={canAct}
        onDirtyChange={onDirtyChange}
      />

      <p className="text-[11px] leading-relaxed text-text-faint">
        {isQuestion ? (
          <T
            en="The question, its evidence, its origin and its confidence are what the analysis produced and are never edited by this workflow."
            th="คำถาม หลักฐาน ที่มา และความมั่นใจ คือสิ่งที่การวิเคราะห์ผลิตออกมาและจะไม่ถูกแก้ไขโดยขั้นตอนนี้"
          />
        ) : (
          <T
            en="The finding, its evidence, its origin and its confidence are what the analysis produced and are never edited by this workflow. Resolving one changes no requirement."
            th="ข้อค้นพบ หลักฐาน ที่มา และความมั่นใจ คือสิ่งที่การวิเคราะห์ผลิตออกมาและจะไม่ถูกแก้ไขโดยขั้นตอนนี้ การแก้ไขข้อค้นพบไม่เปลี่ยนแปลงข้อกำหนดใด ๆ"
          />
        )}
      </p>
    </div>
  );
}
