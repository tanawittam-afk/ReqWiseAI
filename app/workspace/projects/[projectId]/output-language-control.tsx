"use client";

/**
 * The output-language preference, editable after creation (Phase 2, Slice 7) — the
 * "fixed when the project is created" claim `app/workspace/settings/page.tsx` used to
 * make is no longer true; this is the one place it's actually changed.
 *
 * Same client-island shape as `ArchiveControls`: the decision is entirely server-side,
 * this component only knows the project id and its current value, and disables the
 * button while the action is in flight so a press never looks unpressed.
 */

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { setOutputLanguageAction } from "../actions";
import { T } from "@/app/_components/t";
import { useLocale, pick } from "@/lib/i18n";

export function OutputLanguageControl({
  projectId,
  outputLang,
  outputLangMode,
  archived,
}: {
  projectId: string;
  outputLang: "th" | "en";
  outputLangMode: "fixed" | "match_source";
  archived: boolean;
}) {
  const locale = useLocale();
  const currentValue = outputLangMode === "match_source" ? "match_source" : outputLang;
  const [value, setValue] = useState(currentValue);

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-border-soft bg-surface shadow-[var(--shadow-panel)] p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-text-faint">
        <T en="Output language" th="ภาษาของผลลัพธ์" />
      </h2>
      <p className="text-xs leading-relaxed text-text-muted">
        <T
          en="The language requirements are written in — separate from the interface language. Changing this affects only the next analysis; a past run stays exactly as it was written."
          th="ภาษาที่ข้อกำหนดจะถูกเขียน — คนละแกนกับภาษาหน้าจอ การเปลี่ยนค่านี้มีผลกับการวิเคราะห์ครั้งถัดไปเท่านั้น รอบที่วิเคราะห์ไปแล้วจะคงเดิมตามที่เขียนไว้"
        />
      </p>

      {archived ? (
        <p className="text-sm text-text-faint">
          <T
            en="This project is archived and read-only. Restore it to change this."
            th="โปรเจกต์นี้ถูกเก็บเข้าคลังและอ่านได้อย่างเดียว กู้คืนเพื่อเปลี่ยนค่านี้"
          />
        </p>
      ) : (
        <form action={setOutputLanguageAction} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="projectId" value={projectId} />
          <select
            name="outputLang"
            value={value}
            onChange={(event) => setValue(event.target.value as typeof value)}
            className="min-h-11 flex-1 rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 text-sm
                       text-text focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25"
          >
            <option value="th">{pick(locale, "Thai", "ไทย")}</option>
            <option value="en">{pick(locale, "English", "English")}</option>
            <option value="match_source">{pick(locale, "Match source", "ตามต้นฉบับ")}</option>
          </select>
          <SubmitButton disabled={value === currentValue} />
        </form>
      )}

      {outputLangMode === "match_source" ? (
        <p className="text-[11px] leading-relaxed text-text-faint">
          <T
            en="Each analysis picks Thai or English based on the source's own text — never a guess by the model."
            th="การวิเคราะห์แต่ละครั้งจะเลือกไทยหรืออังกฤษตามเนื้อหาต้นฉบับเอง — ไม่ใช่การเดาโดยโมเดล"
          />
        </p>
      ) : null}
    </section>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={disabled || pending}
      aria-busy={pending}
      className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-card)] bg-accent px-4 text-sm
                 font-semibold text-on-accent transition-colors hover:bg-accent-hover
                 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? <T en="Saving…" th="กำลังบันทึก…" /> : <T en="Save" th="บันทึก" />}
    </button>
  );
}
