"use client";

/**
 * Picks the demo run that matches the visitor's current UI language and renders it
 * through the real `AnalysisWorkspace` — unmodified, `canReview={false}`.
 *
 * Binding the analysis *content* language to the chrome locale toggle is a demo-only
 * exception to CLAUDE.md's "UI language and output language are two separate
 * controls" rule: inside the real, authenticated app that separation still holds
 * (a project's `outputLang` is its own field, set once at creation, independent of
 * whichever language a reviewer's browser chrome happens to be in). Here there is no
 * project and no reviewer decision to preserve — only a visitor choosing which
 * language to read a demonstration in — so following the same toggle they already
 * used for the header is the more legible behaviour, not a violation of the rule's
 * intent.
 */

import type { OutputLang } from "@/lib/contracts/analysis-input";
import type { AnalysisWorkspaceRun } from "@/lib/analysis/workspace-view";
import type { SourceDetail } from "@/lib/sources/types";
import type { ItemHistory } from "@/lib/review/history";
import { useLocale } from "@/lib/i18n";
import { T } from "@/app/_components/t";
import { AnalysisWorkspace } from "@/app/workspace/projects/[projectId]/analyses/[runId]/workspace";
import { Tour } from "./tour";

export type DemoDataset = {
  run: AnalysisWorkspaceRun;
  source: SourceDetail;
  history: Record<string, ItemHistory>;
};

// UI locale ("en" | "th") and analysis output language (OutputLang) happen to share
// the same two values today, but are conceptually distinct — this is the one seam
// where the demo deliberately maps one onto the other (see the file comment above).
function toOutputLang(locale: "en" | "th"): OutputLang {
  return locale;
}

export function DemoWorkspace({
  th,
  en,
  initialDisplayId,
}: {
  th: DemoDataset;
  en: DemoDataset;
  /** `?item=` from the URL — a display id (`Q-001`), resolved below. */
  initialDisplayId: string | null;
}) {
  const locale = useLocale();
  const dataset = toOutputLang(locale) === "th" ? th : en;

  // Resolved per-dataset rather than passed straight through: the two languages'
  // items do not share ids, only the same display-id allocation order, so this must
  // be recomputed against whichever dataset is actually active.
  const initialItemId = initialDisplayId
    ? (dataset.run.items.find((item) => item.displayId === initialDisplayId)?.id ?? null)
    : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <div
        role="status"
        className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-accent-border bg-accent-soft px-4 py-2 text-[12.5px] text-accent"
      >
        <span className="font-semibold">
          <T en="Read-only demo." th="เดโมแบบอ่านอย่างเดียว" />
        </span>
        <span>
          <T
            en="Generated live by the deterministic analysis engine — no account, no database."
            th="สร้างขึ้นสด ๆ โดยเอนจินวิเคราะห์แบบกำหนดผลลัพธ์ตายตัว — ไม่ต้องมีบัญชี ไม่แตะฐานข้อมูล"
          />
        </span>
      </div>

      <AnalysisWorkspace
        key={locale}
        source={dataset.source}
        run={dataset.run}
        history={dataset.history}
        canReview={false}
        currentUserId={null}
        initialItemId={initialItemId}
      />

      <Tour />
    </div>
  );
}
