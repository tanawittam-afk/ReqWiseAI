"use client";

/**
 * The guided explanation layer.
 *
 * Deliberately **not** pixel-anchored markers glued to each panel: `AnalysisWorkspace`
 * is reused whole from the real app (docs — Phase 2 of the 2026-08-03 UX/UI plan
 * chose "reuse, do not fork"), and its three-panel grid reflows at three different
 * breakpoints down to a one-pane segmented view. An overlay that had to track that
 * layout would be a second copy of `workspace.tsx`'s own breakpoint logic, fragile by
 * construction and exactly the "modify the shared production component" risk the plan
 * chose not to take. A rail that explains the same four things in order, opened by one
 * real button, gets the same job done without duplicating layout logic.
 *
 * Four numbered items, each a real `<button>` toggling its own explanation via
 * `aria-expanded`/`aria-controls` — never a hover tooltip
 * (docs/design/INTERFACE.md §15: no critical content depends only on hover). No
 * pulsing, no glow, no continuous motion (§10) — only the 150–200ms open/close
 * transition already used throughout the workspace.
 *
 * Copy is about BA judgment, not features — what a reader should notice, not what the
 * button does.
 */

import { useId, useState, useSyncExternalStore } from "react";
import { T } from "@/app/_components/t";
import { Icon } from "@/app/_components/icon";

const STORAGE_KEY = "reqwise-demo-tour-dismissed";

function subscribe() {
  // Dismissal only ever changes from a click in this same component, which already
  // re-renders itself — there is no external event to listen for, so this is a
  // deliberate no-op. useSyncExternalStore still requires a subscribe function; not
  // having a real one to give it is what makes this a read, not a subscription.
  return () => {};
}

/**
 * Whether the visitor has already closed the guide before. Read through
 * `useSyncExternalStore`, the same technique `lib/i18n.ts`'s `useLocale()` uses, so the
 * server/client value mismatch (no localStorage on the server) is corrected the way
 * React expects, instead of via a `useState` + `useEffect` pair that would call
 * `setState` synchronously inside an effect (react-hooks/set-state-in-effect) and risk
 * a hydration warning besides.
 */
function useTourDismissed(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => {
      try {
        return window.localStorage.getItem(STORAGE_KEY) === "1";
      } catch {
        return false;
      }
    },
    // Server snapshot: assume dismissed, so the panel starts closed and never flashes
    // open during SSR — a real first-time visitor sees it open one render later, once
    // the client snapshot (above) resolves to `false`, exactly like a theme or locale
    // correcting after hydration.
    () => true,
  );
}

function dismissTour(): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Storage can be unavailable; the guide still closes for this page view.
  }
}

const POINTS: Array<{ en: string; th: string; detailEn: string; detailTh: string }> = [
  {
    en: "The source panel is the original text, unedited",
    th: "พาเนลซ้ายคือข้อความต้นฉบับ ไม่มีการแก้ไข",
    detailEn:
      "Every word here is exactly what was submitted. Nothing the analysis produced ever changes the source — the record of what was actually said has to stay intact for a citation to mean anything.",
    detailTh:
      "ทุกคำในนี้คือสิ่งที่ถูกส่งเข้ามาจริง ไม่มีสิ่งที่วิเคราะห์ได้เปลี่ยนแปลงต้นฉบับเลย — บันทึกสิ่งที่พูดจริงต้องคงเดิม การอ้างอิงถึงจะมีความหมาย",
  },
  {
    en: "Every requirement in the middle panel was generated from that text",
    th: "ทุกความต้องการในพาเนลกลางถูกสร้างจากข้อความนั้น",
    detailEn:
      "Grouped by type, with a confidence score on each. Selecting one highlights the exact sentence it came from in the source panel — that link is the point of the product.",
    detailTh:
      "จัดกลุ่มตามประเภท พร้อมคะแนนความมั่นใจของแต่ละรายการ เลือกรายการใดจะไฮไลต์ประโยคต้นฉบับที่เป็นที่มาให้ทันที — การเชื่อมโยงนี้คือหัวใจของผลิตภัณฑ์",
  },
  {
    en: "An item with no highlight says so, instead of guessing",
    th: "รายการที่ไม่มีการไฮไลต์จะบอกตรง ๆ แทนการเดา",
    detailEn:
      "Some items — an assumption, a risk drawn from domain knowledge — have no sentence to point at. Those are always labelled inferred or assumed, and the Evidence tab says exactly why. Nothing here fabricates a quotation to look more certain than it is.",
    detailTh:
      "บางรายการ เช่น ข้อสันนิษฐานหรือความเสี่ยงจากความรู้โดเมน ไม่มีประโยคให้ชี้ รายการเหล่านี้จะระบุว่า inferred หรือ assumed เสมอ และแท็บ Evidence จะบอกเหตุผลตรง ๆ ไม่มีการสร้างคำพูดปลอมเพื่อให้ดูมั่นใจเกินจริง",
  },
  {
    en: "Nothing here is approved — every item starts as a draft a person reviews",
    th: "ไม่มีอะไรถูกอนุมัติเอง — ทุกรายการเริ่มต้นเป็นฉบับร่างที่รอคนตรวจ",
    detailEn:
      "The review controls are visible in the inspector on the right, shown disabled — this is a read-only demo, not a live workspace. In your own account, the same buttons approve, reject, or ask for clarification, and every decision is recorded.",
    detailTh:
      "ปุ่มตรวจสอบแสดงอยู่ในพาเนล inspector ทางขวา แต่ถูกปิดใช้งานไว้ — เพราะนี่คือ demo แบบอ่านอย่างเดียว ไม่ใช่พื้นที่ทำงานจริง ในบัญชีของคุณเอง ปุ่มเดียวกันนี้จะใช้อนุมัติ ปฏิเสธ หรือขอความชัดเจนได้ และทุกการตัดสินใจจะถูกบันทึกไว้",
  },
];

export function Tour() {
  const dismissedBefore = useTourDismissed();
  // `null` means "no manual choice yet this page view" — follow `dismissedBefore`.
  // Once the visitor clicks the toggle, their click always wins over the stored value
  // for the rest of this page view, whichever direction it goes.
  const [manualOpen, setManualOpen] = useState<boolean | null>(null);
  const [expanded, setExpanded] = useState<number | null>(0);
  const baseId = useId();

  const open = manualOpen ?? !dismissedBefore;

  function close() {
    setManualOpen(false);
    dismissTour();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => (open ? close() : setManualOpen(true))}
        aria-expanded={open}
        aria-controls={`${baseId}-panel`}
        className="fixed bottom-4 left-4 z-30 flex min-h-11 items-center gap-2 rounded-[var(--radius-card)] border border-accent-border
                   bg-accent-soft px-3.5 text-sm font-semibold text-accent shadow-[0_8px_24px_rgba(27,26,24,0.12)]
                   transition-colors duration-150 hover:border-accent"
      >
        <Icon name="external" size={16} />
        <T en={open ? "Close guide" : "What am I looking at?"} th={open ? "ปิดคำอธิบาย" : "นี่คืออะไร?"} />
      </button>

      {open ? (
        <div
          id={`${baseId}-panel`}
          role="complementary"
          aria-label="Guided explanation"
          className="fixed inset-x-3 bottom-20 z-30 max-h-[70vh] overflow-y-auto rounded-[var(--radius-panel)] border border-border-soft
                     bg-surface p-4 shadow-[0_8px_24px_rgba(27,26,24,0.12)] sm:inset-x-auto sm:bottom-20 sm:left-4 sm:w-[380px]"
        >
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.04em] text-text-faint">
            <T en="What a Business Analyst sees here" th="สิ่งที่ Business Analyst เห็นในหน้านี้" />
          </p>
          <ol className="flex flex-col gap-1">
            {POINTS.map((point, index) => {
              const isExpanded = expanded === index;
              const detailId = `${baseId}-detail-${index}`;
              return (
                <li key={index} className="border-t border-border-soft first:border-t-0">
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : index)}
                    aria-expanded={isExpanded}
                    aria-controls={detailId}
                    className="flex w-full min-h-11 items-start gap-2.5 py-2 text-left transition-colors duration-150 hover:text-accent"
                  >
                    <span
                      aria-hidden="true"
                      className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-accent-soft font-mono text-[11px] font-semibold text-accent"
                    >
                      {index + 1}
                    </span>
                    <span className="text-[13px] font-medium leading-snug text-text">
                      <T en={point.en} th={point.th} />
                    </span>
                    <Icon
                      name={isExpanded ? "chevron-down" : "chevron-right"}
                      size={16}
                      className="ml-auto mt-0.5 shrink-0 text-text-faint"
                    />
                  </button>
                  {isExpanded ? (
                    <p id={detailId} className="pb-3 pl-7 text-[12.5px] leading-relaxed text-text-muted">
                      <T en={point.detailEn} th={point.detailTh} />
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      ) : null}
    </>
  );
}
