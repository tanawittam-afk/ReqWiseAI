"use client";

/**
 * The traceability inspector — one selected item, its edges, and its gaps.
 *
 * Read-only, deliberately. Slice 6B ships traceability *reading*; there is no relation
 * editor, and inventing a disabled one would advertise a feature that has not been
 * designed. The one action offered is the one that already exists: open this item in
 * the Analysis Workspace, where editing and review live.
 *
 * Incoming relations are read with the inverse label, so "US-001 is validated by
 * AC-001" and "AC-001 validates US-001" are the same row seen from either end. A
 * single label reused in both directions would make the map say the opposite of what
 * the database holds for half its edges.
 */

import Link from "next/link";
import { T } from "@/app/_components/t";
import { pick, useLocale } from "@/lib/i18n";
import type { CoverageReport } from "@/lib/traceability/coverage";
import type { RelationEnd } from "@/lib/traceability/graph";
import type { TraceItem } from "@/lib/traceability/types";
import { LEGACY_BADGE, LEGACY_EXPLANATION, relationPhrase } from "./labels";
import { TYPE_LABEL } from "@/app/workspace/_components/item-labels";

export function TraceInspector({
  item,
  outgoing,
  incoming,
  coverage,
  workspaceHref,
  archived,
  onSelect,
}: {
  item: TraceItem | null;
  outgoing: RelationEnd[];
  incoming: RelationEnd[];
  coverage: CoverageReport;
  workspaceHref: string | null;
  archived: boolean;
  onSelect: (itemId: string) => void;
}) {
  const locale = useLocale();
  if (item === null) {
    return (
      <div className="rounded-[var(--radius-panel)] border border-border-soft bg-surface p-4">
        <p className="text-sm text-text-muted">
          <T
            en="Select an item in the matrix or the map to see what it traces to."
            th="เลือกรายการในตารางหรือแผนที่เพื่อดูสิ่งที่รายการนั้นเชื่อมโยงถึง"
          />
        </p>
      </div>
    );
  }

  // Which coverage rules flagged *this* item. Derived from the same report the summary
  // row shows, so the inspector and the row can never disagree.
  const flags = Object.values(coverage.findings).filter((finding) =>
    finding.itemIds.includes(item.id),
  );

  return (
    <div className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-border-soft bg-surface p-4">
      <header className="flex flex-col gap-1">
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-xs font-semibold text-text-muted">{item.displayId}</span>
          <span className="rounded-[var(--radius-card)] border border-border-soft px-1.5 py-px text-[10px] text-text-faint">
            {TYPE_LABEL[item.type] ?? item.type}
          </span>
        </span>
        <h2 className="text-sm font-semibold leading-snug text-text">{item.title}</h2>
        <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          <Meta label={pick(locale, "Status", "สถานะ")} value={item.status.replace(/_/g, " ")} />
          <Meta label={pick(locale, "Priority", "ลำดับความสำคัญ")} value={item.priority} />
          {item.workflowState ? (
            <Meta
              label={pick(locale, "Workflow", "ขั้นตอนการทำงาน")}
              value={item.workflowState.replace(/_/g, " ")}
            />
          ) : null}
          <Meta
            label={pick(locale, "Evidence", "หลักฐาน")}
            value={
              item.hasSourceEvidence
                ? pick(locale, "Cited in the source", "อ้างอิงในต้นฉบับ")
                : pick(locale, "No citation", "ไม่มีการอ้างอิง")
            }
          />
        </dl>
      </header>

      {flags.length > 0 ? (
        <section aria-labelledby="insp-gaps" className="flex flex-col gap-1">
          <h3 id="insp-gaps" className="text-xs font-semibold uppercase tracking-wide text-warn">
            <T en="Missing links" th="การเชื่อมโยงที่ขาดหาย" />
          </h3>
          <ul className="flex flex-col gap-1 text-xs leading-relaxed text-text-muted">
            {flags.map((flag) => (
              <li key={flag.key}>{flag.meaning}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <RelationList
        heading={{ en: "Relations out", th: "ความสัมพันธ์ขาออก" }}
        empty={{ en: "Nothing leads from this item.", th: "ไม่มีสิ่งใดเชื่อมโยงออกจากรายการนี้" }}
        ends={outgoing}
        direction="out"
        onSelect={onSelect}
      />
      <RelationList
        heading={{ en: "Relations in", th: "ความสัมพันธ์ขาเข้า" }}
        empty={{ en: "Nothing leads to this item.", th: "ไม่มีสิ่งใดเชื่อมโยงเข้าสู่รายการนี้" }}
        ends={incoming}
        direction="in"
        onSelect={onSelect}
      />

      {workspaceHref ? (
        <Link
          href={workspaceHref}
          className="mt-1 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-card)] border border-border-soft
                     px-3 text-sm font-medium text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
        >
          <T en="Open in Analysis Workspace" th="เปิดในพื้นที่วิเคราะห์" />
        </Link>
      ) : null}

      {archived ? (
        <p className="text-xs leading-relaxed text-text-faint">
          <T
            en="This project is archived. Traceability, review history and evidence are all readable; nothing can be changed."
            th="โปรเจกต์นี้ถูกเก็บเข้าคลัง การเชื่อมโยง ประวัติการตรวจสอบ และหลักฐานทั้งหมดยังคงอ่านได้ แต่ไม่สามารถเปลี่ยนแปลงได้"
          />
        </p>
      ) : null}
    </div>
  );
}

function RelationList({
  heading,
  empty,
  ends,
  direction,
  onSelect,
}: {
  heading: { en: string; th: string };
  empty: { en: string; th: string };
  ends: RelationEnd[];
  direction: "out" | "in";
  onSelect: (itemId: string) => void;
}) {
  return (
    <section className="flex flex-col gap-1">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-faint">
        <T en={heading.en} th={heading.th} /> ({ends.length})
      </h3>
      {ends.length === 0 ? (
        <p className="text-xs text-text-faint">
          <T en={empty.en} th={empty.th} />
        </p>
      ) : (
        <ul className="flex flex-col gap-1">
          {ends.map(({ relation, other }) => {
            const key = `${relation.fromItemId}-${relation.toItemId}-${relation.type}`;
            return (
              <li key={key}>
                {other === null ? (
                  <span className="block px-2 py-1.5 text-xs text-text-faint">
                    {relationPhrase(relation.type, direction)}{" "}
                    <T en="an item outside the current filter" th="รายการที่อยู่นอกตัวกรองปัจจุบัน" />
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelect(other.id)}
                    className="flex min-h-11 w-full flex-col gap-0.5 rounded-[var(--radius-card)] border
                               border-border-soft px-2 py-1.5 text-left transition-colors hover:bg-surface-hover"
                  >
                    <span className="flex flex-wrap items-center gap-1.5 text-[11px] text-text-muted">
                      <span>{relationPhrase(relation.type, direction)}</span>
                      <span className="font-mono font-semibold text-text">{other.displayId}</span>
                      {relation.legacy ? (
                        <span
                          title={LEGACY_EXPLANATION}
                          className="rounded-[var(--radius-card)] border border-border-strong px-1 text-[10px] text-text-faint"
                        >
                          {LEGACY_BADGE}
                        </span>
                      ) : null}
                    </span>
                    <span className="line-clamp-2 text-xs leading-snug text-text">
                      {other.title}
                    </span>
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-text-faint">{label}</dt>
      <dd className="capitalize text-text">{value}</dd>
    </div>
  );
}
