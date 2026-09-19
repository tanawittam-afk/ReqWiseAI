/**
 * Today's per-user usage (Phase 1, Slice 4). Server-renderable — no client state of its
 * own. This table IS the "which user to reset" UI: no separate search, each row's own
 * reset button carries that row's `userId` in a hidden field, mirroring
 * `deleteGeminiKeyAction`'s void-action-no-bound-state shape — the revalidated table
 * after a reset is the confirmation, not a returned message.
 */

import { T } from "@/app/_components/t";
import { Button } from "@/app/_components/ui/button";
import { DAILY_ANALYSIS_LIMIT } from "@/lib/config/limits";
import type { DailyUsageRow } from "@/lib/admin/usage";
import { resetUsageAction } from "./actions";

export function UsageTable({ rows }: { rows: DailyUsageRow[] }) {
  return (
    <section aria-labelledby="usage-heading" className="flex flex-col gap-3">
      <h2 id="usage-heading" className="text-sm font-semibold text-text">
        <T en="Today's usage" th="การใช้งานวันนี้" />
      </h2>

      {rows.length === 0 ? (
        <p className="rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-3 py-2 text-[12px] leading-relaxed text-text-muted">
          <T en="No analyses run today yet." th="ยังไม่มีการวิเคราะห์เกิดขึ้นในวันนี้" />
        </p>
      ) : (
        <ul className="flex flex-col gap-px overflow-hidden rounded-[var(--radius-panel)] border border-border-soft bg-border-soft">
          {rows.map((row) => (
            <li
              key={row.userId}
              className="flex flex-wrap items-center gap-3 bg-surface px-4 py-3"
            >
              <span className="text-sm text-text">{row.email}</span>
              <span className="font-mono text-[11px] text-text-faint">
                {row.analysesCount} <T en="of" th="จาก" /> {DAILY_ANALYSIS_LIMIT}
              </span>
              <span className="ml-auto">
                <form action={resetUsageAction}>
                  <input type="hidden" name="targetUserId" value={row.userId} />
                  <Button type="submit" variant="secondary" size="sm">
                    <T en="Reset today's count" th="รีเซ็ตยอดใช้งานวันนี้" />
                  </Button>
                </form>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
