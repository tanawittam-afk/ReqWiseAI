"use client";

/**
 * One compact row above the workspace — never a dashboard header, because every pixel
 * it takes is a line of requirement text someone cannot read (docs/design/INTERFACE.md
 * §6).
 *
 * Every number here is counted from the run's own items. There is no quality score and
 * no coverage percentage: neither is defined anywhere in the product, and a number
 * invented to fill a layout is exactly what this application exists to prevent.
 */

import type { RunSummary } from "@/lib/analysis/workspace-view";
import { T } from "@/app/_components/t";
import { pick, useLocale } from "@/lib/i18n";

export function SummaryBar({
  summary,
  runDate,
  sourceCount,
  inspectorOpen,
  onToggleInspector,
}: {
  summary: RunSummary;
  runDate: string;
  /** One, by construction — a run analyses exactly one source revision (DATA-MODEL). */
  sourceCount: number;
  inspectorOpen: boolean;
  onToggleInspector: () => void;
}) {
  const locale = useLocale();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-b border-border-soft bg-chrome px-4 py-2.5">
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-text">
        <span aria-hidden="true" className="size-1.5 rounded-full bg-ok" />
        <T en="Analysis completed" th="วิเคราะห์เสร็จสิ้น" />
        <span className="font-normal text-text-faint">{runDate}</span>
      </span>

      <span aria-hidden="true" className="hidden h-4 w-px bg-border-soft sm:block" />

      <Metric en="Requirements" th="ข้อกำหนด" value={summary.requirementCount} />
      <Metric
        en="Open questions"
        th="คำถามที่เปิดอยู่"
        value={summary.openQuestions}
        note={
          summary.questionsUnresolved > 0
            ? pick(locale, `${summary.questionsUnresolved} unanswered`, `ยังไม่ตอบ ${summary.questionsUnresolved}`)
            : pick(locale, "all handled", "จัดการแล้วทั้งหมด")
        }
      />
      <Metric en="Risks" th="ความเสี่ยง" value={summary.risks} />
      <Metric
        en="Quality findings"
        th="ข้อค้นพบด้านคุณภาพ"
        value={summary.qualityFindings}
        note={
          summary.findingsUnresolved > 0
            ? pick(locale, `${summary.findingsUnresolved} unresolved`, `ยังไม่แก้ไข ${summary.findingsUnresolved}`)
            : pick(locale, "all handled", "จัดการแล้วทั้งหมด")
        }
      />
      <Metric en="Cited" th="มีการอ้างอิง" value={`${summary.citedCount}/${summary.itemCount}`} />
      <Metric en="Sources" th="แหล่งข้อมูล" value={sourceCount} />

      <button
        type="button"
        onClick={onToggleInspector}
        aria-pressed={inspectorOpen}
        className={`ml-auto hidden min-h-9 shrink-0 rounded-[var(--radius-card)] border px-2.5 text-xs font-medium
                    transition-colors duration-150 lg:block ${
                      inspectorOpen
                        ? "border-accent-border bg-accent-soft text-accent"
                        : "border-border-soft bg-surface text-text-muted hover:bg-surface-hover"
                    }`}
      >
        <T en="Inspector" th="แผงตรวจสอบ" />
      </button>
    </div>
  );
}

function Metric({
  en,
  th,
  value,
  note,
}: {
  en: string;
  th: string;
  value: number | string;
  /** A real sub-count, never a derived score — "3 unanswered", not "78% healthy". */
  note?: string;
}) {
  return (
    <span className="text-xs text-text-faint">
      <T en={en} th={th} /> <span className="font-medium tabular-nums text-text-muted">{value}</span>
      {note ? <span className="text-text-faint"> · {note}</span> : null}
    </span>
  );
}
