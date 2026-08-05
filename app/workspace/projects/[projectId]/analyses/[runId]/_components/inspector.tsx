"use client";

/**
 * The right panel: everything known about the selected item, and every decision that
 * can be taken about it — without a modal.
 *
 * Review work is repetitive — select, read, judge, select again — and a dialog that has
 * to be dismissed between every item taxes exactly that loop (docs/design/INTERFACE.md
 * §5). Four sections keep the panel shallow: what it says, what it rests on, what it
 * connects to, and what has happened to it.
 *
 * Notes remain absent: there is no note that is not either a change reason (on a
 * version) or a review comment (on an activity), so a Notes tab would either duplicate
 * History or promise a data model that does not exist.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Icon } from "@/app/_components/icon";
import { T } from "@/app/_components/t";
import { pick, useLocale } from "@/lib/i18n";
import type { AnalysisItemView } from "@/lib/analysis/queries";
import type { ItemHistory } from "@/lib/review/history";
import { isReviewableItemType, isTerminalStatus } from "@/lib/contracts/review";
import { isWorkflowItemType, WORKFLOW_STATE_LABEL, type WorkflowState } from "@/lib/contracts/workflow";
import { FieldLabel, FieldValue, PanelHeader, PanelTitle } from "./panel";
import { HistoryPanel } from "./history-panel";
import { ItemEditForm } from "./item-edit-form";
import { ReviewActions } from "./review-actions";
import { WorkflowTab } from "./workflow-tab";
import { WorkflowStateChip } from "./workflow-actions";
import { ChangeRequestsTab } from "./change-requests-tab";
import {
  EVIDENCE_LABEL,
  ORIGIN_LABEL,
  PRIORITY_LABEL,
  STATUS_LABEL,
  TYPE_LABEL,
  confidencePercent,
  labelFor,
} from "@/app/workspace/_components/item-labels";

type InspectorTab =
  | "details"
  | "evidence"
  | "relations"
  | "answer"
  | "resolution"
  | "changeRequests"
  | "history";

/**
 * The workflow tab's name is the job it does, which differs by type: a question is
 * *answered*, a finding is *resolved*. "Workflow" would be accurate for both and
 * meaningful for neither.
 *
 * "Change requests" only appears for a reviewable item that actually has one — most
 * approved or rejected items never do, and cluttering every one of them with an empty
 * tab would bury the ones that matter.
 */
function tabsFor(type: string, hasChangeRequests: boolean): InspectorTab[] {
  if (type === "open_question") return ["details", "evidence", "answer", "history"];
  if (type === "quality_finding") return ["details", "evidence", "resolution", "history"];
  const base: InspectorTab[] = ["details", "evidence", "relations"];
  if (hasChangeRequests) base.push("changeRequests");
  base.push("history");
  return base;
}

const DRAWER_QUERY = "(min-width: 1024px) and (max-width: 1279.98px)";

// `useSyncExternalStore`, the same technique `useLocale()` uses (app/lib/i18n.ts) — a
// `useEffect` + `setState` pair here trips `react-hooks/set-state-in-effect`, and this
// is exactly the "subscribe to an external source" case the hook exists for.
function subscribeToDrawerQuery(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const query = window.matchMedia(DRAWER_QUERY);
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
function isDrawerWidth() {
  return typeof window !== "undefined" && window.matchMedia(DRAWER_QUERY).matches;
}
function isDrawerWidthServer() {
  return false;
}

const TAB_LABEL: Record<string, { en: string; th: string }> = {
  details: { en: "Details", th: "รายละเอียด" },
  evidence: { en: "Evidence", th: "หลักฐาน" },
  relations: { en: "Relations", th: "ความสัมพันธ์" },
  answer: { en: "Answer", th: "คำตอบ" },
  resolution: { en: "Resolution", th: "การแก้ไข" },
  changeRequests: { en: "Change requests", th: "คำขอเปลี่ยนแปลง" },
  history: { en: "History", th: "ประวัติ" },
};

export function Inspector({
  item,
  allItems,
  history,
  projectId,
  runId,
  canReview,
  currentUserId,
  editing,
  onEditingChange,
  onDirtyChange,
  onSelectDisplayId,
  onClose,
  className = "",
}: {
  item: AnalysisItemView | null;
  /** Every item in the run — needed to resolve a change request's target picker. */
  allItems: AnalysisItemView[];
  history: ItemHistory;
  projectId: string;
  runId: string;
  canReview: boolean;
  currentUserId: string | null;
  editing: boolean;
  onEditingChange: (editing: boolean) => void;
  onDirtyChange: (dirty: boolean) => void;
  onSelectDisplayId: (displayId: string) => void;
  onClose?: () => void;
  className?: string;
}) {
  const locale = useLocale();
  const [tab, setTab] = useState<InspectorTab>("details");

  // A new item is read from the top; carrying the previous tab across hides the
  // statement behind whatever section the last item was being inspected on. Adjusted
  // during render, not in an effect, so no frame shows the wrong pairing.
  const [lastItemId, setLastItemId] = useState(item?.id ?? null);
  if ((item?.id ?? null) !== lastItemId) {
    setLastItemId(item?.id ?? null);
    setTab("details");
  }

  const stopEditing = useCallback(() => onEditingChange(false), [onEditingChange]);

  /*
   * Between `lg` (1024px) and `xl` (1280px) this panel renders as an absolutely
   * positioned drawer floating over the source/requirements panels (the `lg:absolute
   * ... lg:shadow-[...] xl:static xl:shadow-none` pair below) — the one place the
   * plan's "lg inspector drawer" accessibility gaps (role, aria-modal, Escape) apply.
   * Below `lg` it is one pane of the segmented control (normal document flow, nothing
   * floats over anything); at `xl` and up it is a static grid column. Neither of those
   * is a modal, so `role="dialog"`/`aria-modal` would be wrong there — a screen reader
   * treats `aria-modal="true"` as "everything else on the page is inert", which is
   * false outside the actual overlay state. Tracked with `matchMedia` rather than a
   * CSS-only trick because ARIA attributes have no CSS equivalent.
   */
  const isDrawer = useSyncExternalStore(
    subscribeToDrawerQuery,
    isDrawerWidth,
    isDrawerWidthServer,
  );

  const isOpenDrawer = isDrawer && item !== null && onClose !== undefined;

  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenDrawerRef = useRef(false);

  // Opening the drawer: remember what was focused (a requirement row, typically) and
  // move focus into the panel, matching the standard dialog-open contract.
  useEffect(() => {
    if (isOpenDrawer && !wasOpenDrawerRef.current) {
      restoreFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
      closeButtonRef.current?.focus();
    }
    wasOpenDrawerRef.current = isOpenDrawer;
  }, [isOpenDrawer]);

  // Escape closes the drawer and returns focus to whatever opened it — never left to
  // fall back to <body>, which is where focus silently goes if nothing else claims it.
  useEffect(() => {
    if (!isOpenDrawer) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      event.stopPropagation();
      onClose?.();
      const target = restoreFocusRef.current;
      if (target && document.contains(target)) target.focus();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isOpenDrawer, onClose]);

  const workflowItem = item !== null && isWorkflowItemType(item.type);
  const tabs = tabsFor(item?.type ?? "", (item?.changeRequests.length ?? 0) > 0);
  // A tab list that changed with the item can leave `tab` pointing at one that is no
  // longer there; falling back to Details is better than rendering nothing.
  const activeTab = tabs.includes(tab) ? tab : "details";
  const panelTitle =
    item === null
      ? { en: "Inspector", th: "แผงตรวจสอบ" }
      : item.type === "open_question"
        ? { en: "Question inspector", th: "แผงตรวจสอบคำถาม" }
        : item.type === "quality_finding"
          ? { en: "Finding inspector", th: "แผงตรวจสอบข้อค้นพบ" }
          : { en: "Requirement inspector", th: "แผงตรวจสอบข้อกำหนด" };

  return (
    <section
      aria-label={pick(locale, "Requirement inspector", "แผงตรวจสอบข้อกำหนด")}
      role={isOpenDrawer ? "dialog" : undefined}
      aria-modal={isOpenDrawer ? "true" : undefined}
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden border-border-soft bg-surface ${className}`}
    >
      <PanelHeader>
        <div className="flex min-w-0 flex-col">
          <PanelTitle>
            <T en={panelTitle.en} th={panelTitle.th} />
          </PanelTitle>
          {item ? (
            <span className="font-mono text-[11px] text-text-faint">{item.displayId}</span>
          ) : null}
        </div>
        {onClose ? (
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="ml-auto grid size-11 shrink-0 place-items-center rounded-[var(--radius-card)] text-text-faint
                       transition-colors duration-150 hover:bg-surface-hover hover:text-text lg:size-9"
          >
            <Icon name="close" size={16} />
            <span className="sr-only">
              <T en="Close inspector" th="ปิดแผงตรวจสอบ" />
            </span>
          </button>
        ) : null}
      </PanelHeader>

      {item === null ? (
        <p className="px-4 py-8 text-center text-sm text-text-muted">
          <T en="Select a requirement to inspect it." th="เลือกข้อกำหนดเพื่อตรวจสอบ" />
        </p>
      ) : (
        <>
          <div className="flex items-center gap-1 border-b border-border-soft px-3 pt-2">
            {tabs.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTab(value)}
                aria-current={activeTab === value ? "true" : undefined}
                className={`-mb-px min-h-11 border-b-2 px-2.5 text-sm transition-colors duration-150 ${
                  activeTab === value
                    ? "border-b-accent font-semibold text-text"
                    : "border-b-transparent text-text-muted hover:text-text"
                }`}
              >
                <T en={TAB_LABEL[value].en} th={TAB_LABEL[value].th} />
              </button>
            ))}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3.5">
            {activeTab === "details" ? (
              editing ? (
                <ItemEditForm
                  key={item.id}
                  item={item}
                  projectId={projectId}
                  runId={runId}
                  onDone={stopEditing}
                  onDirtyChange={onDirtyChange}
                />
              ) : (
                <Details item={item} />
              )
            ) : null}
            {activeTab === "evidence" ? <Evidence item={item} /> : null}
            {activeTab === "relations" ? (
              <Relations item={item} onSelectDisplayId={onSelectDisplayId} />
            ) : null}
            {activeTab === "answer" || activeTab === "resolution" ? (
              <WorkflowTab
                key={item.id}
                item={item}
                allItems={allItems}
                projectId={projectId}
                runId={runId}
                canAct={canReview}
                currentUserId={currentUserId}
                onDirtyChange={onDirtyChange}
              />
            ) : null}
            {activeTab === "changeRequests" ? (
              <ChangeRequestsTab
                changeRequests={item.changeRequests}
                projectId={projectId}
                runId={runId}
                canReview={canReview}
              />
            ) : null}
            {activeTab === "history" ? (
              <HistoryPanel
                history={history}
                current={{
                  versionNo: item.versionNo,
                  title: item.title,
                  priority: item.priority,
                  status: item.status,
                }}
                currentUserId={currentUserId}
              />
            ) : null}
          </div>

          {/* The decision sits at the foot of the panel, in view whichever tab is open —
              a reviewer who has just read the evidence should not have to navigate back
              to Details to act on it. Hidden only while the edit form owns the panel. */}
          {/* A question or a finding takes its decisions in its own tab, where the
              answer being written is next to the words being answered. Only the
              requirement review row lives at the foot of the panel. */}
          {!editing && !workflowItem ? (
            <div className="border-t border-border-soft bg-surface-muted px-4 py-3">
              <ReviewActions
                key={item.id}
                item={item}
                projectId={projectId}
                runId={runId}
                canReview={canReview}
                onEdit={() => {
                  setTab("details");
                  onEditingChange(true);
                }}
                onShowHistory={() => setTab("history")}
                onDirtyChange={onDirtyChange}
              />
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}

function Details({ item }: { item: AnalysisItemView }) {
  const deferred = !isReviewableItemType(item.type);
  const workflow = isWorkflowItemType(item.type);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-1.5">
        <Chip tone="accent">{TYPE_LABEL[item.type]}</Chip>
        {workflow ? (
          <WorkflowStateChip state={item.workflowState ?? "open"} />
        ) : (
          <Chip>{labelFor(STATUS_LABEL, item.status)}</Chip>
        )}
        {workflow ? null : <Chip>{labelFor(PRIORITY_LABEL, item.priority)}</Chip>}
        <Chip tone="signal">
          <T en="Confidence" th="ความมั่นใจ" /> {confidencePercent(item.confidence)}
        </Chip>
        {workflow ? null : (
          <Chip>
            <T en="Version" th="เวอร์ชัน" /> {item.versionNo}
          </Chip>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <FieldLabel>
          <T en="Statement" th="ข้อความ" />
        </FieldLabel>
        <p className="text-[15px] font-medium leading-snug text-text">{item.title}</p>
      </div>

      {item.description.trim() ? (
        <div className="flex flex-col gap-1">
          <FieldLabel>
            <T en="Description" th="คำอธิบาย" />
          </FieldLabel>
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-text-muted">
            {item.description}
          </p>
        </div>
      ) : null}

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        <div className="flex flex-col gap-0.5">
          <FieldLabel>
            <T en="Evidence class" th="ประเภทหลักฐาน" />
          </FieldLabel>
          <FieldValue>{labelFor(EVIDENCE_LABEL, item.evidenceClass)}</FieldValue>
        </div>
        <div className="flex flex-col gap-0.5">
          <FieldLabel>
            <T en="Origin" th="ที่มา" />
          </FieldLabel>
          <FieldValue>{labelFor(ORIGIN_LABEL, item.origin)}</FieldValue>
        </div>
      </dl>

      {item.rationale?.trim() ? (
        <div className="flex flex-col gap-1">
          <FieldLabel>
            <T en="Rationale" th="เหตุผล" />
          </FieldLabel>
          <p className="text-sm leading-relaxed text-text-muted">{item.rationale}</p>
        </div>
      ) : null}

      {workflow && item.followUpOn ? (
        <p className="text-[11.5px] text-warn">
          <T en="Follow up on" th="ติดตามผลที่" /> {item.followUpOn}
        </p>
      ) : null}

      <p className="text-[11px] leading-relaxed text-text-faint">
        {workflow ? (
          item.type === "open_question" ? (
            <T
              en={`This is a question the analysis could not settle. Answer it in the Answer tab — the question, its evidence and its confidence never change. Current state: ${WORKFLOW_STATE_LABEL[(item.workflowState ?? "open") as WorkflowState]}.`}
              th={`นี่คือคำถามที่การวิเคราะห์ยังหาข้อสรุปไม่ได้ ตอบคำถามได้ในแท็บคำตอบ — ตัวคำถาม หลักฐาน และความมั่นใจจะไม่เปลี่ยนแปลง สถานะปัจจุบัน: ${WORKFLOW_STATE_LABEL[(item.workflowState ?? "open") as WorkflowState]}`}
            />
          ) : (
            <T
              en={`This is an observation about the analysis, not a requirement. Acknowledge, resolve or dismiss it in the Resolution tab. Current state: ${WORKFLOW_STATE_LABEL[(item.workflowState ?? "open") as WorkflowState]}.`}
              th={`นี่คือข้อสังเกตเกี่ยวกับการวิเคราะห์ ไม่ใช่ข้อกำหนด รับทราบ แก้ไข หรือยกเลิกได้ในแท็บการแก้ไข สถานะปัจจุบัน: ${WORKFLOW_STATE_LABEL[(item.workflowState ?? "open") as WorkflowState]}`}
            />
          )
        ) : deferred ? (
          <T
            en="Type, evidence, origin and confidence describe what the analysis found and are never edited."
            th="ประเภท หลักฐาน ที่มา และความมั่นใจ อธิบายสิ่งที่การวิเคราะห์พบ และจะไม่ถูกแก้ไข"
          />
        ) : isTerminalStatus(item.status) ? (
          <T
            en="This requirement is closed. Its statement, description and priority are frozen; type, evidence and confidence were never editable."
            th="ข้อกำหนดนี้ปิดแล้ว ข้อความ คำอธิบาย และลำดับความสำคัญถูกล็อกไว้ ส่วนประเภท หลักฐาน และความมั่นใจไม่เคยแก้ไขได้อยู่แล้ว"
          />
        ) : (
          <T
            en="Statement, description and priority can be edited. Type, evidence, origin and confidence describe what the analysis found and are never edited."
            th="สามารถแก้ไขข้อความ คำอธิบาย และลำดับความสำคัญได้ ส่วนประเภท หลักฐาน ที่มา และความมั่นใจ อธิบายสิ่งที่การวิเคราะห์พบและจะไม่ถูกแก้ไข"
          />
        )}
      </p>
    </div>
  );
}

function Evidence({ item }: { item: AnalysisItemView }) {
  if (item.sourceReferences.length === 0) {
    /*
     * No excerpt, so no highlight — not a highlight of the nearest plausible sentence.
     * A domain-profile item is raised BECAUSE the source is silent; inventing a
     * citation for it would fabricate the exact thing a citation exists to prove
     * (product spec §14).
     */
    const fromProfile = item.origin === "domain_profile";
    return (
      <div className="flex flex-col gap-2">
        <p className="text-sm text-text-muted">
          {fromProfile ? (
            <T
              en="Generated from domain guidance; no direct source evidence."
              th="สร้างจากแนวทางของโดเมน ไม่มีหลักฐานจากแหล่งข้อมูลโดยตรง"
            />
          ) : (
            <T
              en="This item cites no excerpt from the source document."
              th="รายการนี้ไม่ได้อ้างอิงข้อความจากเอกสารต้นฉบับ"
            />
          )}
        </p>
        <p className="text-[11px] leading-relaxed text-text-faint">
          <T
            en={`That is expected for an ${labelFor(EVIDENCE_LABEL, item.evidenceClass).toLowerCase()} item raised from ${labelFor(ORIGIN_LABEL, item.origin).toLowerCase()} — it is a question the source never answered, not a claim about what the source says. The source panel shows no highlight for it, deliberately.`}
            th={`เป็นเรื่องปกติสำหรับรายการประเภท ${labelFor(EVIDENCE_LABEL, item.evidenceClass)} ที่มาจาก ${labelFor(ORIGIN_LABEL, item.origin)} — เป็นคำถามที่แหล่งข้อมูลไม่เคยตอบ ไม่ใช่ข้อความอ้างว่าแหล่งข้อมูลระบุไว้ แผงแหล่งข้อมูลจึงตั้งใจไม่ไฮไลต์ให้`}
          />
        </p>
      </div>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {item.sourceReferences.map((reference, index) => (
        <li
          key={index}
          className="flex flex-col gap-2 rounded-[var(--radius-card)] border border-border-soft bg-surface-muted p-3"
        >
          <p className="whitespace-pre-wrap font-mono text-[12.5px] leading-relaxed text-text">
            {reference.excerpt}
          </p>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-faint">
            {reference.offsetVerified && reference.startOffset !== null && reference.endOffset !== null ? (
              <span className="tabular-nums">
                <T en="Characters" th="ตัวอักษร" /> {reference.startOffset}–{reference.endOffset}
              </span>
            ) : (
              <span>
                <T en="Excerpt found; no exact position proven" th="พบข้อความ แต่ไม่สามารถยืนยันตำแหน่งที่แน่นอนได้" />
              </span>
            )}
            {reference.evidenceStrength !== null ? (
              <span className="tabular-nums">
                <T en="Strength" th="ความหนักแน่น" /> {confidencePercent(reference.evidenceStrength)}
              </span>
            ) : null}
            <span
              className={`inline-flex items-center gap-1 ${reference.offsetVerified ? "text-signal" : "text-warn"}`}
            >
              <Icon name={reference.offsetVerified ? "verified" : "unverified"} size={12} />
              <T en={reference.offsetVerified ? "Verified" : "Unverified"} th={reference.offsetVerified ? "ยืนยันแล้ว" : "ยังไม่ยืนยัน"} />
            </span>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Relations({
  item,
  onSelectDisplayId,
}: {
  item: AnalysisItemView;
  onSelectDisplayId: (displayId: string) => void;
}) {
  if (item.relatedDisplayIds.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        <T en="This item has no recorded relations." th="รายการนี้ไม่มีความสัมพันธ์ที่บันทึกไว้" />
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-wrap gap-1.5">
        {item.relatedDisplayIds.map((displayId) => (
          <li key={displayId}>
            <button
              type="button"
              onClick={() => onSelectDisplayId(displayId)}
              className="min-h-11 lg:min-h-9 rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-2.5 font-mono text-[11px]
                         font-medium text-text-muted transition-colors duration-150
                         hover:border-accent-border hover:bg-accent-soft hover:text-accent"
            >
              {displayId}
            </button>
          </li>
        ))}
      </ul>
      <p className="text-xs leading-relaxed text-text-muted">
        <T
          en="Relations are typed by the provider and validated against the application pair matrix. Legacy derives_from rows remain visible without being reclassified."
          th="ความสัมพันธ์ถูกกำหนดประเภทโดยผู้ให้บริการและตรวจสอบกับตารางคู่ความสัมพันธ์ที่ใช้ได้ แถว derives_from แบบเดิมยังคงแสดงอยู่โดยไม่ถูกจัดประเภทใหม่"
        />
      </p>
    </div>
  );
}

function Chip({ children, tone }: { children: React.ReactNode; tone?: "accent" | "signal" }) {
  const style =
    tone === "accent"
      ? "border-accent-border bg-accent-soft text-accent"
      : tone === "signal"
        ? "border-signal-border bg-signal-soft text-signal"
        : "border-border-soft bg-surface-muted text-text-muted";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${style}`}>
      {children}
    </span>
  );
}
