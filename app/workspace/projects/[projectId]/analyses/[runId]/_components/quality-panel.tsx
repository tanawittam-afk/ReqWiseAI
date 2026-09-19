"use client";

/**
 * The Quality tab (Phase 2, Slice 2 of the "Usable Product" master plan) — the score
 * `lib/analysis/workspace-view.ts`'s `qualityScore()` computes, its breakdown by
 * finding kind, and the run's open findings, each linking back into the Findings tab.
 *
 * "Weakly supported" (Phase 3, Slice 1) is real data — `weaklySupportedItems()`
 * (`lib/analysis/workspace-view.ts`), a requirement with no source citation or one
 * whose `evidence_strength` is under 0.5. "Discussed but not written" (Phase 3,
 * Slices 2–6) is real data too — `coverage_gap` items the code-locate → segment →
 * AI-filter pipeline (`lib/analysis/coverage-gaps.ts`) found and persisted in the same
 * transaction as the run itself; only the *open* ones show here, the same convention
 * "Open findings" already uses. Dismissing or resolving one is the same workflow a
 * quality finding gets, one level down in the inspector (Resolution tab) — clicking a
 * row selects it there. "Add requirement from this" (Phase 2, Slice 5) opens the
 * manual "Add requirement" form on the Requirements tab, pre-filled with that item's
 * own excerpt — it never writes anything itself.
 */

import type { AnalysisItemView } from "@/lib/analysis/queries";
import type { QualityScoreBreakdown } from "@/lib/analysis/workspace-view";
import { QUALITY_FINDING_KINDS, type QualityFindingKind } from "@/lib/contracts/item-types";
import { FINDING_KIND_LABEL } from "@/app/workspace/_components/item-labels";
import { T } from "@/app/_components/t";
import { Button } from "@/app/_components/ui/button";
import { pick, useLocale } from "@/lib/i18n";

function scoreTone(score: number): { className: string; en: string; th: string } {
  if (score >= 80) return { className: "border-ok-border bg-ok-soft text-ok", en: "Good", th: "ดี" };
  if (score >= 50) {
    return { className: "border-warn-border bg-warn-soft text-warn", en: "Needs work", th: "ต้องปรับปรุง" };
  }
  return { className: "border-danger-border bg-danger-soft text-danger", en: "At risk", th: "มีความเสี่ยง" };
}

export function QualityPanel({
  breakdown,
  findings,
  weaklySupported,
  gaps,
  onSelectDisplayId,
  onAddFromFinding,
}: {
  breakdown: QualityScoreBreakdown;
  findings: AnalysisItemView[];
  weaklySupported: AnalysisItemView[];
  gaps: AnalysisItemView[];
  onSelectDisplayId: (displayId: string) => void;
  /** Opens the manual "Add requirement" form (Slice 5), pre-filled with this finding's
   * own excerpt — "this" in "Add requirement from this". */
  onAddFromFinding: (excerpt: string) => void;
}) {
  const locale = useLocale();
  const tone = scoreTone(breakdown.score);
  const openFindings = findings.filter((item) => item.workflowState === "open");
  const openGaps = gaps.filter((item) => item.workflowState === "open");

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
      <section aria-labelledby="quality-score-heading" className="flex flex-col gap-3">
        <h3 id="quality-score-heading" className="text-sm font-semibold text-text">
          <T en="Quality score" th="คะแนนคุณภาพ" />
        </h3>
        <div className="flex items-center gap-3 rounded-[var(--radius-panel)] border border-border-soft bg-surface p-4">
          <span className="font-mono text-3xl font-semibold text-text tabular-nums">
            {breakdown.score}
          </span>
          <span
            className={`rounded-[var(--radius-card)] border px-1.5 py-0.5 text-[11px] font-medium ${tone.className}`}
          >
            <T en={tone.en} th={tone.th} />
          </span>
          <span className="ml-auto text-xs text-text-faint">
            <T
              en={`−${breakdown.totalDeduction} from ${openFindings.length} open finding${openFindings.length === 1 ? "" : "s"}`}
              th={`−${breakdown.totalDeduction} จาก ${openFindings.length} ข้อค้นพบที่เปิดอยู่`}
            />
          </span>
        </div>

        <ul className="flex flex-col gap-px overflow-hidden rounded-[var(--radius-panel)] border border-border-soft bg-border-soft">
          {QUALITY_FINDING_KINDS.map((kind) => {
            const entry = breakdown.deductions[kind];
            return (
              <li
                key={kind}
                className="flex items-center gap-2 bg-surface px-3 py-2 text-sm"
              >
                <span className={entry.count === 0 ? "text-text-faint" : "text-text"}>
                  {FINDING_KIND_LABEL[kind]}
                </span>
                <span className="ml-auto font-mono text-xs tabular-nums text-text-faint">
                  {entry.count}
                </span>
                <span className="w-14 text-right font-mono text-xs tabular-nums text-text-faint">
                  {entry.points > 0 ? `−${entry.points}` : "—"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="quality-open-findings-heading" className="flex flex-col gap-2">
        <h3 id="quality-open-findings-heading" className="text-sm font-semibold text-text">
          <T en="Open findings" th="ข้อค้นพบที่เปิดอยู่" />
        </h3>
        {openFindings.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-3 py-2 text-[12px] leading-relaxed text-text-muted">
            <T en="No open findings — nothing is subtracting right now." th="ไม่มีข้อค้นพบที่เปิดอยู่ — ไม่มีอะไรถูกหักคะแนนตอนนี้" />
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {openFindings.map((item) => {
              const kindValue = item.attributes?.finding;
              const kind =
                typeof kindValue === "string" && kindValue in FINDING_KIND_LABEL
                  ? FINDING_KIND_LABEL[kindValue as QualityFindingKind]
                  : null;
              return (
                <li
                  key={item.id}
                  className="flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 py-2"
                >
                  <button
                    type="button"
                    onClick={() => onSelectDisplayId(item.displayId)}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    <span className="font-mono text-xs text-text-faint">{item.displayId}</span>
                    <span className="truncate text-sm text-text">{item.title}</span>
                    {kind ? (
                      <span className="shrink-0 rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-1.5 py-0.5 text-[11px] text-text-muted">
                        {kind}
                      </span>
                    ) : null}
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => onAddFromFinding(item.sourceReferences[0]?.excerpt ?? "")}
                    title={pick(
                      locale,
                      "Opens the Add requirement form, pre-filled with this finding's excerpt",
                      "เปิดฟอร์มเพิ่มข้อกำหนด พร้อมข้อความอ้างอิงจากข้อค้นพบนี้",
                    )}
                  >
                    <T en="Add requirement from this" th="เพิ่มข้อกำหนดจากข้อนี้" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="quality-weak-heading" className="flex flex-col gap-2">
        <h3 id="quality-weak-heading" className="text-sm font-semibold text-text">
          <T en="Weakly supported" th="มีหลักฐานอ่อน" />
        </h3>
        {weaklySupported.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-3 py-2 text-[12px] leading-relaxed text-text-muted">
            <T
              en="Every requirement has a citation with reasonable confidence."
              th="ข้อกำหนดทุกข้อมีการอ้างอิงที่มั่นใจได้ในระดับหนึ่ง"
            />
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {weaklySupported.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => onSelectDisplayId(item.displayId)}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <span className="font-mono text-xs text-text-faint">{item.displayId}</span>
                  <span className="truncate text-sm text-text">{item.title}</span>
                  <span className="shrink-0 rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-1.5 py-0.5 text-[11px] text-text-muted">
                    {item.sourceReferences.length === 0 ? (
                      <T en="No citation" th="ไม่มีการอ้างอิง" />
                    ) : (
                      <T en="Low evidence" th="หลักฐานต่ำ" />
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="quality-gaps-heading" className="flex flex-col gap-2">
        <h3 id="quality-gaps-heading" className="text-sm font-semibold text-text">
          <T en="Discussed but not written" th="พูดถึงแต่ยังไม่เขียน" />
        </h3>
        {openGaps.length === 0 ? (
          <p className="rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-3 py-2 text-[12px] leading-relaxed text-text-muted">
            <T
              en="No open gaps — nothing the source discusses is currently uncovered."
              th="ไม่มีช่องว่างที่เปิดอยู่ — ไม่มีสิ่งที่ต้นฉบับพูดถึงแล้วยังไม่มีข้อกำหนดครอบคลุมตอนนี้"
            />
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {openGaps.map((item) => (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-2 rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 py-2"
              >
                <button
                  type="button"
                  onClick={() => onSelectDisplayId(item.displayId)}
                  className="flex flex-1 items-center gap-2 text-left"
                >
                  <span className="font-mono text-xs text-text-faint">{item.displayId}</span>
                  <span className="truncate text-sm text-text">{item.title}</span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onAddFromFinding(item.sourceReferences[0]?.excerpt ?? "")}
                  title={pick(
                    locale,
                    "Opens the Add requirement form, pre-filled with this gap's excerpt",
                    "เปิดฟอร์มเพิ่มข้อกำหนด พร้อมข้อความอ้างอิงจากช่องว่างนี้",
                  )}
                >
                  <T en="Add requirement from this" th="เพิ่มข้อกำหนดจากข้อนี้" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
