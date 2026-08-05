"use client";

/**
 * What happened to this requirement, and who did it.
 *
 * Two lists, deliberately separate rather than merged into one stream: a **version**
 * is a change to what the requirement says, an **activity** is a change to what the
 * team has decided about it. Interleaving them reads well right up to the moment
 * somebody needs to answer "which text did I approve", which is the question this tab
 * exists for.
 *
 * "Changed fields" is a field-level comparison of three named fields, computed in
 * `lib/review/history.ts`. There is no diff library in this slice on purpose: word-
 * level highlighting is a real feature with a real dependency, and it is not what
 * answers "did somebody change the priority behind my back".
 */

import { T } from "@/app/_components/t";
import { pick, useLocale, type Locale } from "@/lib/i18n";
import type { ItemHistory } from "@/lib/review/history";
import { activityLabel } from "@/lib/review/history";
import { FieldLabel } from "./panel";
import { PRIORITY_LABEL, STATUS_LABEL, labelFor } from "@/app/workspace/_components/item-labels";

const FIELD_LABEL: Record<string, { en: string; th: string }> = {
  title: { en: "Statement", th: "ข้อความ" },
  description: { en: "Description", th: "คำอธิบาย" },
  priority: { en: "Priority", th: "ลำดับความสำคัญ" },
};

function when(timestamp: string): string {
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

/**
 * Actor names are not shown for other people: `profiles` is readable only by its own
 * user (RLS policy `profiles_select_self`), so rendering a name for somebody else
 * would mean widening who can read whose profile — a tenancy decision, not a detail
 * of this panel.
 */
function actor(id: string | null, currentUserId: string | null, locale: Locale): string {
  if (id === null) return pick(locale, "Unknown", "ไม่ทราบ");
  return id === currentUserId
    ? pick(locale, "You", "คุณ")
    : pick(locale, "Another workspace member", "สมาชิกคนอื่นในทีม");
}

export function HistoryPanel({
  history,
  current,
  currentUserId,
}: {
  history: ItemHistory;
  current: { versionNo: number; title: string; priority: string; status: string };
  currentUserId: string | null;
}) {
  const locale = useLocale();
  return (
    <div className="flex flex-col gap-5">
      <section className="flex flex-col gap-2">
        <FieldLabel>
          <T en="Version history" th="ประวัติเวอร์ชัน" />
        </FieldLabel>

        <ol className="flex flex-col gap-2">
          <li className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-accent-border bg-accent-soft p-2.5">
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[11px] font-semibold text-accent">
                v{current.versionNo}
              </span>
              <span className="text-[11px] font-medium text-accent">
                <T en="Current" th="ปัจจุบัน" />
              </span>
              <span className="ml-auto text-[11px] text-text-faint">
                {labelFor(STATUS_LABEL, current.status)}
              </span>
            </div>
            <p className="text-[12.5px] leading-snug text-text">{current.title}</p>
          </li>

          {history.versions.map((version) => (
            <li
              key={version.versionNo}
              className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-border-soft bg-surface-muted p-2.5"
            >
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <span className="font-mono text-[11px] font-semibold text-text-faint">
                  v{version.versionNo}
                </span>
                <span className="text-[11px] text-text-muted">
                  {actor(version.changedBy, currentUserId, locale)}
                </span>
                <span className="ml-auto text-[11px] tabular-nums text-text-faint">
                  {when(version.createdAt)}
                </span>
              </div>

              <p className="text-[12.5px] leading-snug text-text-muted">{version.title}</p>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-text-faint">
                <span>{labelFor(PRIORITY_LABEL, version.priority)}</span>
                {version.status ? (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>
                      {labelFor(STATUS_LABEL, version.status)} <T en="at the time" th="ในขณะนั้น" />
                    </span>
                  </>
                ) : null}
              </div>

              {version.changedFields.length > 0 ? (
                <p className="text-[11px] text-text-faint">
                  <T en="Changed next:" th="เปลี่ยนแปลงต่อไปนี้:" />{" "}
                  <span className="text-text-muted">
                    {version.changedFields
                      .map((field) => pick(locale, FIELD_LABEL[field]?.en ?? field, FIELD_LABEL[field]?.th ?? field))
                      .join(pick(locale, ", ", ", "))}
                  </span>
                </p>
              ) : null}

              {version.changeReason ? (
                <p className="text-[11px] leading-relaxed text-text-muted">
                  <span className="text-text-faint">
                    <T en="Reason:" th="เหตุผล:" />{" "}
                  </span>
                  {version.changeReason}
                </p>
              ) : null}
            </li>
          ))}
        </ol>

        {history.versions.length === 0 ? (
          <p className="text-[11px] leading-relaxed text-text-faint">
            <T
              en="This is the requirement exactly as the analysis produced it. Nobody has edited it yet, so there is no earlier version to compare against."
              th="นี่คือข้อกำหนดตามที่การวิเคราะห์ผลิตออกมาเป๊ะ ๆ ยังไม่มีใครแก้ไข จึงไม่มีเวอร์ชันก่อนหน้าให้เปรียบเทียบ"
            />
          </p>
        ) : null}
      </section>

      <section className="flex flex-col gap-2">
        <FieldLabel>
          <T en="Review activity" th="กิจกรรมการตรวจสอบ" />
        </FieldLabel>

        {history.activities.length === 0 ? (
          <p className="text-sm text-text-muted">
            <T en="No review activity yet." th="ยังไม่มีกิจกรรมการตรวจสอบ" />
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {history.activities.map((activity) => (
              <li
                key={activity.id}
                className="flex flex-col gap-1 border-l-2 border-border-soft pl-2.5"
              >
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-[12.5px] font-medium text-text">
                    {activityLabel(activity)}
                  </span>
                  <span className="ml-auto text-[11px] tabular-nums text-text-faint">
                    {when(activity.createdAt)}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-x-2 text-[11px] text-text-faint">
                  <span>{actor(activity.actorId, currentUserId, locale)}</span>
                  {activity.fromStatus && activity.toStatus ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>
                        {labelFor(STATUS_LABEL, activity.fromStatus)} →{" "}
                        {labelFor(STATUS_LABEL, activity.toStatus)}
                      </span>
                    </>
                  ) : null}
                </div>
                {activity.comment ? (
                  <p className="whitespace-pre-wrap text-[12px] leading-relaxed text-text-muted">
                    {activity.comment}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
