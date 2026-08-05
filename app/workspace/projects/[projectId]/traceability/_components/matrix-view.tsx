"use client";

/**
 * The traceability matrix — the primary view.
 *
 * A real `<table>`, not a grid of divs: the relationship between a cell and its column
 * header *is* the information, and `<th scope="col">` is what conveys it to a screen
 * reader without a single ARIA attribute.
 *
 * Two rules the design imposes:
 *
 *  1. **A gap is rendered, never blank.** "No user story for this requirement" is the
 *     finding a reviewer opened this screen for; an empty cell would read as an
 *     unfinished component.
 *  2. **Never colour alone.** A gap carries the word "Missing" and a dashed border; an
 *     item carries its display id. Removing every colour from this component would
 *     lose no information (CLAUDE.md → Accessibility).
 */

import { T } from "@/app/_components/t";
import { pick, useLocale } from "@/lib/i18n";
import {
  COLUMN_LABEL,
  describeMatrixRow,
  type MatrixCell,
  type MatrixRow,
} from "@/lib/traceability/matrix";
import { TRACEABILITY_SPINE } from "@/lib/contracts/relations";
import type { TraceItem } from "@/lib/traceability/types";

export function MatrixView({
  rows,
  truncated,
  matchedCount,
  selectedId,
  onSelect,
}: {
  rows: MatrixRow[];
  truncated: boolean;
  /**
   * How many items survived the filter, regardless of whether any of them sit on the
   * spine. Without it the empty state cannot tell "nothing matched" apart from
   * "everything that matched lives off the matrix", and it said the wrong one.
   */
  matchedCount: number;
  selectedId: string | null;
  onSelect: (item: TraceItem) => void;
}) {
  const locale = useLocale();
  if (rows.length === 0) {
    return (
      <p className="rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-4 py-6 text-sm leading-relaxed text-text-muted">
        {matchedCount > 0 ? (
          <T
            en={
              <>
                {matchedCount} item{matchedCount === 1 ? "" : "s"} match, but none of them sit on
                the objective → requirement → story → criterion chain the matrix shows. Switch to
                the <strong className="font-semibold text-text">Map</strong> to see them, or
                clear the filter.
              </>
            }
            th={
              <>
                มี {matchedCount} รายการที่ตรงกัน แต่ไม่มีรายการใดอยู่ในสายโซ่ วัตถุประสงค์ →
                ข้อกำหนด → เรื่องราว → เกณฑ์การยอมรับ ที่ตารางนี้แสดง สลับไปที่{" "}
                <strong className="font-semibold text-text">แผนที่</strong> เพื่อดูรายการเหล่านั้น
                หรือล้างตัวกรอง
              </>
            }
          />
        ) : (
          <T
            en="No items match the current filters. Clear a filter to see the matrix."
            th="ไม่มีรายการที่ตรงกับตัวกรองปัจจุบัน ล้างตัวกรองเพื่อดูตาราง"
          />
        )}
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-col gap-2">
      {truncated ? (
        <p role="status" className="text-xs text-warn">
          <T
            en={`Showing the first ${rows.length} paths. Narrow the filters to see the rest — nothing has been dropped from the data, only from this table.`}
            th={`กำลังแสดง ${rows.length} เส้นทางแรก ปรับตัวกรองให้แคบลงเพื่อดูส่วนที่เหลือ — ไม่มีข้อมูลใดถูกตัดออกไป มีเพียงตารางนี้ที่แสดงบางส่วน`}
          />
        </p>
      ) : null}

      {/* The table scrolls inside its own box; the page never scrolls sideways. */}
      <div className="min-h-0 flex-1 overflow-auto rounded-[var(--radius-panel)] border border-border-soft bg-surface">
        <table className="w-full min-w-[900px] border-collapse text-left">
          <caption className="sr-only">
            <T
              en={
                <>
                  Traceability matrix. Each row is one path from a business objective down to an
                  acceptance criterion. Cells marked &ldquo;Missing&rdquo; have no item at that
                  level.
                </>
              }
              th={
                <>
                  ตารางการเชื่อมโยง แต่ละแถวคือหนึ่งเส้นทางจากวัตถุประสงค์ทางธุรกิจลงไปจนถึง
                  เกณฑ์การยอมรับ ช่องที่ระบุ &ldquo;ขาดหาย&rdquo; หมายถึงไม่มีรายการในระดับนั้น
                </>
              }
            />
          </caption>
          <thead className="sticky top-0 z-10 bg-surface-muted">
            <tr>
              {TRACEABILITY_SPINE.map((type) => (
                <th
                  key={type}
                  scope="col"
                  className="border-b border-border-soft px-3 py-2 text-xs font-semibold uppercase tracking-wide text-text-faint"
                >
                  {COLUMN_LABEL[type] ?? type}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-border-soft last:border-b-0">
                {row.cells.map((cell, index) => (
                  <td key={`${row.key}-${index}`} className="align-top">
                    <Cell cell={cell} selectedId={selectedId} onSelect={onSelect} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/*
       * The accessible alternative required by the design brief. It carries the same
       * information as the table — every cell, including the gaps — rather than a
       * summary of it, so a screen-reader user is not reading a lesser view.
       */}
      <details className="rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-3 py-2">
        <summary className="min-h-11 cursor-pointer text-xs font-medium text-text-muted">
          <T en="Matrix as a list" th="ตารางในรูปแบบรายการ" /> ({rows.length}{" "}
          {pick(locale, rows.length === 1 ? "path" : "paths", "เส้นทาง")})
        </summary>
        <ol className="mt-2 flex flex-col gap-1.5 text-xs leading-relaxed text-text-muted">
          {rows.map((row) => (
            <li key={`list-${row.key}`}>{describeMatrixRow(row)}</li>
          ))}
        </ol>
      </details>
    </div>
  );
}

function Cell({
  cell,
  selectedId,
  onSelect,
}: {
  cell: MatrixCell;
  selectedId: string | null;
  onSelect: (item: TraceItem) => void;
}) {
  const locale = useLocale();
  if (cell.kind === "not_applicable") {
    return (
      <div className="px-3 py-2.5 text-xs text-text-faint">
        <span aria-hidden="true">—</span>
        <span className="sr-only">
          <T en="Not applicable at this level" th="ไม่เกี่ยวข้องในระดับนี้" />
        </span>
      </div>
    );
  }

  if (cell.kind === "missing") {
    return (
      <div className="m-1.5 flex min-h-11 flex-col justify-center rounded-[var(--radius-card)] border border-dashed border-warn-border bg-warn-soft px-2.5 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-warn">
          <T en="Missing" th="ขาดหาย" />
        </span>
        <span className="text-[11px] leading-tight text-text-muted">{cell.reason}</span>
      </div>
    );
  }

  const { item } = cell;
  const selected = item.id === selectedId;

  return (
    <button
      type="button"
      onClick={() => onSelect(item)}
      aria-pressed={selected}
      className={`m-1.5 flex min-h-11 w-[calc(100%-0.75rem)] flex-col gap-0.5 rounded-[var(--radius-card)] border px-2.5 py-2 text-left transition-colors ${
        selected
          ? "border-accent-border bg-accent-soft"
          : "border-border-soft bg-surface hover:bg-surface-hover"
      }`}
    >
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="font-mono text-[11px] font-semibold text-text-muted">
          {item.displayId}
        </span>
        <StatusWord status={item.status} />
        {item.hasSourceEvidence ? (
          <span
            title={pick(locale, "Cited in the source", "อ้างอิงในต้นฉบับ")}
            className="rounded-[var(--radius-card)] border border-signal-border bg-signal-soft px-1 text-[10px] font-medium text-signal"
          >
            <T en="Cited" th="อ้างอิงแล้ว" />
          </span>
        ) : (
          <span className="rounded-[var(--radius-card)] border border-border-soft px-1 text-[10px] text-text-faint">
            <T en="No citation" th="ไม่มีการอ้างอิง" />
          </span>
        )}
      </span>
      <span className="line-clamp-2 text-xs leading-snug text-text">{item.title}</span>
    </button>
  );
}

/** Status as a word first; the colour only reinforces it. */
function StatusWord({ status }: { status: string }) {
  const tone =
    status === "approved"
      ? "border-ok-border bg-ok-soft text-ok"
      : status === "rejected"
        ? "border-danger-border bg-danger-soft text-danger"
        : status === "needs_clarification"
          ? "border-warn-border bg-warn-soft text-warn"
          : "border-border-soft text-text-faint";
  return (
    <span className={`rounded-[var(--radius-card)] border px-1 text-[10px] font-medium capitalize ${tone}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}
