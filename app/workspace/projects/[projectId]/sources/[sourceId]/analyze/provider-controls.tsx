import type { ProviderOption } from "@/lib/config/env";
import type { ProviderKey } from "@/lib/providers/types";
import type { DailyUsageToday } from "@/lib/analysis/daily-usage";
import { T } from "@/app/_components/t";
import { Icon } from "@/app/_components/icon";
import { Notice } from "@/app/_components/ui/notice";
import { useLocale, pick } from "@/lib/i18n";

export function AnalysisProviderControls({
  providerOptions,
  defaultProvider,
  pending,
  dailyUsage,
}: {
  providerOptions: ProviderOption[];
  defaultProvider: ProviderKey;
  pending: boolean;
  dailyUsage: DailyUsageToday;
}) {
  const locale = useLocale();
  return (
    <>
      <fieldset disabled={pending} className="flex flex-col gap-3">
        <legend className="text-sm font-semibold text-text">
          <T en="Analysis provider" th="ผู้ให้บริการวิเคราะห์" />
        </legend>
        <div className="mt-1 flex flex-col gap-2">
          {providerOptions.map((option) => {
            const explanationId =
              option.key === "gemini" && !option.available
                ? "gemini-unavailable-explanation"
                : undefined;

            return (
              <label
                key={option.key}
                className={`flex min-h-11 items-start gap-3 rounded-[var(--radius-card)] border px-3 py-2.5 ${
                  option.available
                    ? "border-border-soft bg-surface text-text"
                    : "cursor-not-allowed border-border-soft bg-surface-muted text-text-muted"
                }`}
              >
                <input
                  type="radio"
                  name="provider"
                  value={option.key}
                  defaultChecked={option.key === defaultProvider && option.available}
                  disabled={pending || !option.available}
                  aria-describedby={explanationId}
                  className="mt-0.5 size-4 shrink-0 accent-accent"
                />
                <span className="min-w-0">
                  <span className="block text-sm font-medium">{option.label}</span>
                  {explanationId ? (
                    <span
                      id={explanationId}
                      className="mt-0.5 block text-xs leading-relaxed text-text-muted"
                    >
                      <T
                        en="Gemini is not available in this workspace. Choose Deterministic Mock or try again later."
                        th="ไม่สามารถใช้ Gemini ในพื้นที่ทำงานนี้ได้ เลือก Deterministic Mock หรือลองใหม่ภายหลัง"
                      />
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <Notice tone="warn">
        <span className="flex items-start gap-2">
          <Icon name="warning" size={14} className="mt-0.5 shrink-0" />
          <T
            en="Privacy: Gemini's free tier may use submitted text to improve Google's products. Remove names and confidential details before analysing — for anything truly confidential, use a paid key instead."
            th="ความเป็นส่วนตัว: Gemini รุ่นฟรีอาจนำข้อความที่ส่งไปใช้พัฒนาโปรดักต์ของ Google ควรลบชื่อบุคคลและรายละเอียดที่เป็นความลับออกก่อนวิเคราะห์ — หากเป็นข้อมูลที่เป็นความลับจริง ควรใช้ API key แบบชำระเงินแทน"
          />
        </span>
      </Notice>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-card)] bg-accent px-5 text-sm
                     font-semibold text-on-accent transition-colors hover:bg-accent-hover
                     disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending
            ? pick(locale, "Analysing…", "กำลังวิเคราะห์…")
            : pick(locale, "Analyze requirements", "วิเคราะห์ข้อกำหนด")}
        </button>
        <span
          className={`text-xs ${dailyUsage.remaining === 0 ? "font-medium text-warn" : "text-text-muted"}`}
        >
          <T
            en={`${dailyUsage.remaining} of ${dailyUsage.limit} left today`}
            th={`เหลือ ${dailyUsage.remaining} จาก ${dailyUsage.limit} ครั้งวันนี้`}
          />
        </span>
        <p
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="text-xs text-text-muted"
        >
          {pending ? pick(locale, "Analysis in progress. Keep this page open.", "กำลังวิเคราะห์อยู่ กรุณาอย่าปิดหน้านี้") : ""}
        </p>
      </div>
    </>
  );
}
