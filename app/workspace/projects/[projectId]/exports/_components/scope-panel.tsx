"use client";

/**
 * The scope selector.
 *
 * Every change is a **navigation**, not local state: the scope lives in the URL
 * (`lib/export/url.ts`), so refreshing keeps it, a link shares it, and the back button
 * undoes a toggle. That also means the document below is server-rendered against the same
 * scope the downloads use — there is no second copy of the rules on the client that could
 * drift from the one the route handler applies.
 *
 * `useTransition` gives the honest pending state: the panel says it is recomputing while
 * the server rebuilds the package, rather than looking finished before it is.
 */

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { T } from "@/app/_components/t";
import {
  EXPORT_PRESETS,
  EXPORT_PRESET_LABEL,
  EXPORT_PRESET_MEANING,
  EXPORT_SECTION_LABEL,
  EXPORT_STATUS_SCOPES,
  EXPORT_STATUS_SCOPE_LABEL,
  EXPORT_STATUS_SCOPE_MEANING,
  type ExportPreset,
  type ExportScope,
  type ExportSection,
  type ExportStatusScope,
} from "@/lib/contracts/export";
import { scopeQuery } from "@/lib/export/url";

/**
 * Sections grouped the way a person decides about them, not the way they are stored.
 * "Requirement types" is a dozen checkboxes nobody reads one at a time; the other two
 * groups are the decisions that actually change what the document is for.
 */
const REQUIREMENT_SECTIONS: readonly ExportSection[] = [
  "problem_statement",
  "business_objectives",
  "stakeholders",
  "business_requirements",
  "functional_requirements",
  "non_functional_requirements",
  "user_stories",
  "acceptance_criteria",
  "business_rules",
  "assumptions",
  "risks",
  "constraints",
];

const OBSERVATION_SECTIONS: readonly ExportSection[] = ["open_questions", "quality_findings"];

const CROSS_CUTTING_SECTIONS: readonly ExportSection[] = [
  "source_evidence",
  "traceability",
  "coverage",
  "version_summary",
  "review_activity",
];

export function ScopePanel({
  projectId,
  scope,
  preset,
}: {
  projectId: string;
  scope: ExportScope;
  preset: ExportPreset | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const base = `/workspace/projects/${projectId}/exports`;

  const go = (next: ExportScope) => {
    startTransition(() => {
      router.replace(`${base}?${scopeQuery(next)}`, { scroll: false });
    });
  };

  const applyPreset = (value: ExportPreset) => {
    startTransition(() => {
      // The preset is sent as itself, so the server resolves it from the one table in
      // `lib/contracts/export.ts`. The client never expands a preset — a second expansion
      // is a second place for the mapping to be wrong.
      router.replace(`${base}?preset=${value}`, { scroll: false });
    });
  };

  const setStatus = (status: ExportStatusScope) => go({ ...scope, status });

  const toggleSection = (section: ExportSection) =>
    go({ ...scope, sections: { ...scope.sections, [section]: !scope.sections[section] } });

  const setAll = (list: readonly ExportSection[], value: boolean) => {
    const sections = { ...scope.sections };
    for (const section of list) sections[section] = value;
    go({ ...scope, sections });
  };

  return (
    <div className="flex flex-col gap-5" aria-busy={pending}>
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-faint">
            <T en="Preset" th="ค่าเริ่มต้น" />
          </h2>
          {pending ? (
            <span role="status" className="text-xs text-text-faint">
              <T en="Recomputing…" th="กำลังคำนวณใหม่…" />
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          {EXPORT_PRESETS.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => applyPreset(value)}
              disabled={pending}
              aria-pressed={preset === value}
              className={`flex min-h-11 flex-col items-start gap-0.5 rounded-[var(--radius-card)] border px-3 py-2 text-left transition-colors
                ${
                  preset === value
                    ? "border-accent-border bg-accent-soft"
                    : "border-border-soft bg-surface hover:bg-surface-hover"
                } disabled:opacity-60`}
            >
              <span className="text-sm font-medium text-text">{EXPORT_PRESET_LABEL[value]}</span>
              <span className="text-xs leading-relaxed text-text-faint">
                {EXPORT_PRESET_MEANING[value]}
              </span>
            </button>
          ))}
        </div>
        <p className="text-xs leading-relaxed text-text-faint">
          <T
            en="A preset only fills in the choices below. Change any of them and the document follows the choices, not the preset name."
            th="ค่าเริ่มต้นเป็นเพียงการเติมตัวเลือกด้านล่างให้เท่านั้น หากเปลี่ยนตัวเลือกใด เอกสารจะทำตามตัวเลือกนั้น ไม่ใช่ตามชื่อค่าเริ่มต้น"
          />
        </p>
      </section>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-text-faint">
          <T en="Requirement status" th="สถานะข้อกำหนด" />
        </legend>
        {EXPORT_STATUS_SCOPES.map((value) => (
          <label
            key={value}
            className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-[var(--radius-card)] px-2 py-2 hover:bg-surface-hover"
          >
            <input
              type="radio"
              name="status"
              value={value}
              checked={scope.status === value}
              onChange={() => setStatus(value)}
              disabled={pending}
              className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
            />
            <span className="flex flex-col gap-0.5">
              <span className="text-sm text-text">{EXPORT_STATUS_SCOPE_LABEL[value]}</span>
              <span className="text-xs leading-relaxed text-text-faint">
                {EXPORT_STATUS_SCOPE_MEANING[value]}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <SectionGroup
        title={<T en="Requirement types" th="ประเภทข้อกำหนด" />}
        sections={REQUIREMENT_SECTIONS}
        scope={scope}
        pending={pending}
        onToggle={toggleSection}
        onAll={(value) => setAll(REQUIREMENT_SECTIONS, value)}
      />

      <SectionGroup
        title={<T en="Observations" th="ข้อสังเกต" />}
        sections={OBSERVATION_SECTIONS}
        scope={scope}
        pending={pending}
        onToggle={toggleSection}
      />

      <SectionGroup
        title={<T en="Evidence, traceability and history" th="หลักฐาน การเชื่อมโยง และประวัติ" />}
        sections={CROSS_CUTTING_SECTIONS}
        scope={scope}
        pending={pending}
        onToggle={toggleSection}
      />

      <label className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-[var(--radius-card)] px-2 py-2 hover:bg-surface-hover">
        <input
          type="checkbox"
          checked={scope.includeConfidence}
          onChange={() => go({ ...scope, includeConfidence: !scope.includeConfidence })}
          disabled={pending}
          className="mt-0.5 size-4 shrink-0 accent-[var(--accent)]"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-sm text-text">
            <T en="Show confidence" th="แสดงความมั่นใจ" />
          </span>
          <span className="text-xs leading-relaxed text-text-faint">
            <T
              en="The model's own estimate. Some readers take it for a measurement, so it is a choice rather than a constant."
              th="เป็นค่าประมาณของโมเดลเอง ผู้อ่านบางคนอาจเข้าใจผิดว่าเป็นการวัดจริง จึงทำให้เป็นตัวเลือกแทนที่จะบังคับแสดงเสมอ"
            />
          </span>
        </span>
      </label>
    </div>
  );
}

function SectionGroup({
  title,
  sections,
  scope,
  pending,
  onToggle,
  onAll,
}: {
  title: React.ReactNode;
  sections: readonly ExportSection[];
  scope: ExportScope;
  pending: boolean;
  onToggle: (section: ExportSection) => void;
  onAll?: (value: boolean) => void;
}) {
  const allOn = sections.every((section) => scope.sections[section]);

  return (
    <fieldset className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <legend className="text-xs font-semibold uppercase tracking-wide text-text-faint">
          {title}
        </legend>
        {onAll ? (
          <button
            type="button"
            onClick={() => onAll(!allOn)}
            disabled={pending}
            className="text-xs font-medium text-accent underline underline-offset-2 disabled:opacity-60"
          >
            {allOn ? <T en="Clear all" th="ล้างทั้งหมด" /> : <T en="Select all" th="เลือกทั้งหมด" />}
          </button>
        ) : null}
      </div>
      {sections.map((section) => (
        <label
          key={section}
          className="flex min-h-11 cursor-pointer items-center gap-2.5 rounded-[var(--radius-card)] px-2 py-1.5 hover:bg-surface-hover"
        >
          <input
            type="checkbox"
            checked={scope.sections[section]}
            onChange={() => onToggle(section)}
            disabled={pending}
            className="size-4 shrink-0 accent-[var(--accent)]"
          />
          <span className="text-sm text-text">{EXPORT_SECTION_LABEL[section]}</span>
        </label>
      ))}
    </fieldset>
  );
}
