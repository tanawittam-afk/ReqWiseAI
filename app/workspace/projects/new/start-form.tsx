"use client";

/**
 * Start a project — one screen, one click.
 *
 * This replaces the three-form hop (create project → add source → confirm analysis)
 * that used to stand between a BA and their first result. Two things are above the
 * fold because two things are genuinely required: a name, and the messy text itself.
 * Everything else was already pre-answered before — domain, output language, source
 * type, the optional intake fields — so it lives in one collapsed disclosure rather
 * than on three screens.
 *
 * Nothing about the rules changed to make this shorter. The text is still stored
 * verbatim, the items still come back as drafts, and the analysis run is still
 * immutable. What was removed is the clicking.
 *
 * A client island for per-field errors, the domain preview, the live summary, the
 * character counter and the derived-title placeholder. The server decides validity —
 * `required` and `maxLength` here are courtesy, not a gate.
 */

import { useActionState, useId, useState } from "react";
import Link from "next/link";
import { T } from "@/app/_components/t";
import { Icon } from "@/app/_components/icon";
import { Notice } from "@/app/_components/ui/notice";
import { pick, useLocale } from "@/lib/i18n";
import type { DailyUsageToday } from "@/lib/analysis/daily-usage";
import {
  PROJECT_NAME_MAX,
  PROJECT_TEXT_MAX,
  PROJECT_STAKEHOLDERS_MAX_COUNT,
} from "@/lib/contracts/project";
import {
  deriveSourceTitle,
  SOURCE_KIND_LABELS,
  SOURCE_KINDS,
  SOURCE_TEXT_MAX,
  SOURCE_TITLE_MAX,
  SOURCE_NOTES_MAX,
  SOURCE_STAKEHOLDER_MAX,
} from "@/lib/contracts/source";
import { startProjectAction } from "../actions";
import { emptyProjectFormState } from "../form-state";

export type DomainOption = {
  id: string;
  key: string;
  name: string;
  description: string;
  supported: boolean;
};

const control =
  "w-full rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 py-2.5 text-sm text-text " +
  "placeholder:text-text-faint transition-colors hover:border-border-strong " +
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/25";

function countStakeholders(value: string): number {
  return value.split(/\r?\n/).filter((line) => line.trim() !== "").length;
}

export function StartProjectForm({
  domains,
  dailyUsage,
}: {
  domains: DomainOption[];
  dailyUsage: DailyUsageToday;
}) {
  const [state, formAction, pending] = useActionState(startProjectAction, emptyProjectFormState);
  const locale = useLocale();
  const firstSupported = domains.find((d) => d.supported);

  const [domainId, setDomainId] = useState(state.values.domainProfileId || firstSupported?.id || "");
  const [name, setName] = useState(state.values.name ?? "");
  const [rawText, setRawText] = useState(state.values.rawText ?? "");
  const [stakeholders, setStakeholders] = useState(state.values.knownStakeholders ?? "");
  const [outputLang, setOutputLang] = useState(state.values.outputLang || "th");

  // Minted once per mount, exactly like the confirmation screen's token: a double
  // submit of the same page reaches the same analysis run instead of a second one.
  const [requestKey] = useState(() => crypto.randomUUID());

  const selected = domains.find((d) => d.id === domainId);
  const ids = useId();
  const errorFor = (field: string) => state.fieldErrors[field];

  const overLimit = rawText.length > SOURCE_TEXT_MAX;
  // Shown, not applied: the server derives the real title from the same function.
  const derivedTitle = rawText.trim() === "" ? "" : deriveSourceTitle(rawText);

  const optionalHasError = [
    "title",
    "kind",
    "sourceDate",
    "stakeholder",
    "notes",
    "domainProfileId",
    "outputLang",
    "description",
    "businessObjective",
    "knownStakeholders",
  ].some((field) => Boolean(errorFor(field)));

  return (
    <form
      action={formAction}
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start"
    >
      <input type="hidden" name="requestKey" value={requestKey} />

      {/* ---------------- left: the two things that are actually required ------------ */}
      <div className="flex flex-col gap-4">
        <Panel
          title={<T en="The work and the words" th="งานและข้อความ" />}
          hint={
            <T
              en="Name it, paste the raw notes, and the analysis runs on submit."
              th="ตั้งชื่อ วางบันทึกดิบ แล้วกดส่ง ระบบจะวิเคราะห์ให้ทันที"
            />
          }
        >
          <Field
            label={<T en="Project name" th="ชื่อโปรเจกต์" />}
            htmlFor={`${ids}-name`}
            error={errorFor("name")}
            required
          >
            <input
              id={`${ids}-name`}
              name="name"
              type="text"
              required
              autoFocus
              maxLength={PROJECT_NAME_MAX}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={pick(
                locale,
                "Smart Space booking — discovery notes",
                "ระบบจองพื้นที่ Smart Space — บันทึกช่วงเก็บความต้องการ",
              )}
              aria-invalid={Boolean(errorFor("name"))}
              className={control}
            />
          </Field>

          <Field
            label={<T en="Source text" th="ข้อความต้นทาง" />}
            htmlFor={`${ids}-rawText`}
            error={errorFor("rawText")}
            required
            hint={
              <T
                en="Meeting notes, an interview, a customer message — paste it exactly as it is. It is stored verbatim, because every citation is an offset into it."
                th="บันทึกการประชุม บทสัมภาษณ์ หรือข้อความจากลูกค้า — วางมาตามจริง ระบบเก็บไว้แบบคำต่อคำ เพราะทุกการอ้างอิงวัดตำแหน่งจากข้อความนี้"
              />
            }
          >
            <textarea
              id={`${ids}-rawText`}
              name="rawText"
              required
              rows={16}
              value={rawText}
              onChange={(event) => setRawText(event.target.value)}
              placeholder={pick(
                locale,
                "Paste the meeting notes here…",
                "วางบันทึกการประชุมที่นี่…",
              )}
              aria-invalid={Boolean(errorFor("rawText"))}
              aria-describedby={`${ids}-count`}
              className={`${control} resize-y font-mono text-[13px] leading-relaxed`}
            />
            <p
              id={`${ids}-count`}
              className={`text-right text-xs tabular-nums ${
                overLimit ? "font-medium text-danger" : "text-text-faint"
              }`}
            >
              {rawText.length.toLocaleString()} / {SOURCE_TEXT_MAX.toLocaleString()}
            </p>
          </Field>

          {/* Native <details>, collapsed. Everything inside was already pre-answered on
              the old three screens, so none of it earns a place above the fold. Kept
              mounted rather than conditionally rendered so a value typed and then
              collapsed by accident survives to submit; opens itself when the server
              returned an error against anything in here. */}
          <details
            className="group flex flex-col gap-4 border-t border-border-soft pt-4"
            open={optionalHasError}
          >
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-text-muted hover:text-text">
              <span aria-hidden="true" className="transition-transform group-open:rotate-90">
                ›
              </span>
              <T en="More options (all pre-answered)" th="ตัวเลือกเพิ่มเติม (ตอบไว้ให้แล้วทั้งหมด)" />
            </summary>

            <Field
              label={<T en="Source title" th="ชื่อข้อความต้นทาง" />}
              htmlFor={`${ids}-title`}
              error={errorFor("title")}
              hint={
                derivedTitle ? (
                  <T
                    en={`Leave blank and it becomes “${derivedTitle}”.`}
                    th={`เว้นว่างไว้ ระบบจะใช้ “${derivedTitle}”`}
                  />
                ) : (
                  <T
                    en="Leave blank and the first line of the text is used."
                    th="เว้นว่างไว้ ระบบจะใช้บรรทัดแรกของข้อความ"
                  />
                )
              }
            >
              <input
                id={`${ids}-title`}
                name="title"
                type="text"
                maxLength={SOURCE_TITLE_MAX}
                defaultValue={state.values.title}
                placeholder={derivedTitle}
                aria-invalid={Boolean(errorFor("title"))}
                className={control}
              />
            </Field>

            <Field
              label={<T en="Source type" th="ประเภทข้อความ" />}
              htmlFor={`${ids}-kind`}
              error={errorFor("kind")}
            >
              <select
                id={`${ids}-kind`}
                name="kind"
                defaultValue={state.values.kind || "meeting_notes"}
                className={control}
              >
                {SOURCE_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {SOURCE_KIND_LABELS[kind]}
                  </option>
                ))}
              </select>
            </Field>

            <Field
              label={<T en="Business domain" th="โดเมนธุรกิจ" />}
              htmlFor={`${ids}-domain`}
              error={errorFor("domainProfileId")}
              hint={
                <T
                  en="Guides the questions the analysis asks. It never becomes evidence."
                  th="ชี้นำคำถามที่การวิเคราะห์จะถาม แต่ไม่เคยกลายเป็นหลักฐาน"
                />
              }
            >
              <fieldset id={`${ids}-domain`} className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <legend className="sr-only">
                  {pick(locale, "Business domain", "โดเมนธุรกิจ")}
                </legend>
                {domains.map((domain) => {
                  const checked = domainId === domain.id;
                  return (
                    <label
                      key={domain.id}
                      className={`flex min-h-11 flex-col gap-1.5 rounded-[var(--radius-card)] border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent has-[:focus-visible]:outline-offset-2 ${
                        checked
                          ? "border-accent bg-accent-soft"
                          : "border-border-soft bg-surface hover:bg-surface-hover"
                      } ${domain.supported ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
                    >
                      <input
                        type="radio"
                        name="domainProfileId"
                        value={domain.id}
                        checked={checked}
                        disabled={!domain.supported}
                        onChange={() => setDomainId(domain.id)}
                        className="sr-only"
                      />
                      <span className={`text-sm font-medium ${checked ? "text-accent" : "text-text"}`}>
                        {domain.name}
                      </span>
                      <span className="text-xs leading-relaxed text-text-faint">
                        {domain.supported
                          ? domain.description
                          : pick(locale, "Coming soon", "เร็ว ๆ นี้")}
                      </span>
                    </label>
                  );
                })}
              </fieldset>
            </Field>

            <Field
              label={<T en="Output language" th="ภาษาของผลลัพธ์" />}
              htmlFor={`${ids}-lang`}
              error={errorFor("outputLang")}
              hint={
                <T
                  en="The language requirements are written in — separate from the interface language."
                  th="ภาษาที่ข้อกำหนดจะถูกเขียน — คนละแกนกับภาษาหน้าจอ"
                />
              }
            >
              <div id={`${ids}-lang`} className="flex flex-wrap gap-2">
                {[
                  { value: "th", label: "ไทย · Thai" },
                  { value: "en", label: "English" },
                ].map((option) => (
                  <label
                    key={option.value}
                    className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-card)] border px-4 text-sm transition-colors ${
                      outputLang === option.value
                        ? "border-accent-border bg-accent-soft font-medium text-text"
                        : "border-border-soft bg-surface text-text-muted hover:bg-surface-hover"
                    }`}
                  >
                    <input
                      type="radio"
                      name="outputLang"
                      value={option.value}
                      checked={outputLang === option.value}
                      onChange={() => setOutputLang(option.value)}
                      className="size-4 accent-[var(--accent)]"
                    />
                    {option.label}
                  </label>
                ))}
              </div>
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label={<T en="Source date" th="วันที่ของข้อความ" />}
                htmlFor={`${ids}-date`}
                error={errorFor("sourceDate")}
              >
                <input
                  id={`${ids}-date`}
                  name="sourceDate"
                  type="date"
                  defaultValue={state.values.sourceDate}
                  aria-invalid={Boolean(errorFor("sourceDate"))}
                  className={control}
                />
              </Field>

              <Field
                label={<T en="Who it came from" th="มาจากใคร" />}
                htmlFor={`${ids}-stakeholder`}
                error={errorFor("stakeholder")}
              >
                <input
                  id={`${ids}-stakeholder`}
                  name="stakeholder"
                  type="text"
                  maxLength={SOURCE_STAKEHOLDER_MAX}
                  defaultValue={state.values.stakeholder}
                  className={control}
                />
              </Field>
            </div>

            <Field
              label={<T en="Notes about this source" th="หมายเหตุของข้อความนี้" />}
              htmlFor={`${ids}-notes`}
              error={errorFor("notes")}
            >
              <textarea
                id={`${ids}-notes`}
                name="notes"
                rows={3}
                maxLength={SOURCE_NOTES_MAX}
                defaultValue={state.values.notes}
                className={`${control} resize-y`}
              />
            </Field>

            <Field
              label={<T en="Project description" th="คำอธิบายโปรเจกต์" />}
              htmlFor={`${ids}-description`}
              error={errorFor("description")}
              hint={<T en="What the work is about, in a sentence or two." th="งานนี้เกี่ยวกับอะไร สั้น ๆ หนึ่งถึงสองประโยค" />}
            >
              <textarea
                id={`${ids}-description`}
                name="description"
                rows={3}
                maxLength={PROJECT_TEXT_MAX}
                defaultValue={state.values.description}
                className={`${control} resize-y`}
              />
            </Field>

            <Field
              label={<T en="Business objective" th="เป้าหมายทางธุรกิจ" />}
              htmlFor={`${ids}-objective`}
              error={errorFor("businessObjective")}
              hint={<T en="What the business is trying to achieve — not the software." th="สิ่งที่ธุรกิจต้องการบรรลุ ไม่ใช่ตัวซอฟต์แวร์" />}
            >
              <textarea
                id={`${ids}-objective`}
                name="businessObjective"
                rows={3}
                maxLength={PROJECT_TEXT_MAX}
                defaultValue={state.values.businessObjective}
                className={`${control} resize-y`}
              />
            </Field>

            <Field
              label={<T en="Known stakeholders" th="ผู้มีส่วนได้ส่วนเสียที่ทราบแล้ว" />}
              htmlFor={`${ids}-stakeholders`}
              error={errorFor("knownStakeholders")}
              hint={
                <T
                  en={`One per line, up to ${PROJECT_STAKEHOLDERS_MAX_COUNT}.`}
                  th={`บรรทัดละหนึ่งคน ไม่เกิน ${PROJECT_STAKEHOLDERS_MAX_COUNT}`}
                />
              }
            >
              <textarea
                id={`${ids}-stakeholders`}
                name="knownStakeholders"
                rows={4}
                value={stakeholders}
                onChange={(event) => setStakeholders(event.target.value)}
                placeholder={"Front Desk Staff\nOperations Manager"}
                className={`${control} resize-y font-mono text-[13px]`}
              />
            </Field>
          </details>
        </Panel>
      </div>

      {/* ---------------- right: what will be created ---------------- */}
      <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
        {selected ? (
          <section className="rounded-[var(--radius-panel)] border border-border-soft bg-surface shadow-[var(--shadow-panel)] p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-faint">
              <T en="Domain preview" th="ตัวอย่างโดเมน" />
            </h2>
            <p className="mt-2 text-sm font-medium text-text">{selected.name}</p>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">{selected.description}</p>
            <p className="mt-3 border-t border-border-soft pt-3 text-xs leading-relaxed text-text-muted">
              <T
                en="Supplies terminology, typical stakeholders and the clarifications worth asking for. It is context, not evidence — every requirement still has to trace back to something you actually wrote down."
                th="ให้คำศัพท์ ผู้เกี่ยวข้องที่พบบ่อย และคำถามที่ควรถาม เป็นบริบท ไม่ใช่หลักฐาน — ทุกข้อกำหนดยังต้องสืบกลับไปยังสิ่งที่คุณเขียนไว้จริง"
              />
            </p>
          </section>
        ) : null}

        <section className="rounded-[var(--radius-panel)] border border-border-soft bg-surface shadow-[var(--shadow-panel)] p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-text-faint">
            <T en="Will be created" th="สิ่งที่จะถูกสร้าง" />
          </h2>
          <dl className="mt-3 flex flex-col gap-2 text-sm">
            <SummaryRow
              label={<T en="Name" th="ชื่อ" />}
              value={name.trim() || pick(locale, "Untitled", "ยังไม่ตั้งชื่อ")}
              muted={!name.trim()}
            />
            <SummaryRow
              label={<T en="Source" th="ข้อความ" />}
              value={
                rawText.trim()
                  ? `${rawText.length.toLocaleString()} ${pick(locale, "characters", "ตัวอักษร")}`
                  : pick(locale, "Nothing pasted yet", "ยังไม่ได้วางข้อความ")
              }
              muted={!rawText.trim()}
            />
            <SummaryRow
              label={<T en="Domain" th="โดเมน" />}
              value={selected?.name ?? pick(locale, "None selected", "ยังไม่ได้เลือก")}
              muted={!selected}
            />
            <SummaryRow
              label={<T en="Output" th="ผลลัพธ์" />}
              value={outputLang === "th" ? "Thai" : "English"}
            />
            <SummaryRow
              label={<T en="Stakeholders" th="ผู้เกี่ยวข้อง" />}
              value={String(countStakeholders(stakeholders))}
              muted={countStakeholders(stakeholders) === 0}
            />
          </dl>

          <p className="mt-3 border-t border-border-soft pt-3 text-xs leading-relaxed text-text-muted">
            <T
              en="Submitting creates the project, stores the text verbatim and runs one analysis. Everything it produces arrives as a draft for you to review."
              th="เมื่อกดส่ง ระบบจะสร้างโปรเจกต์ เก็บข้อความแบบคำต่อคำ และวิเคราะห์หนึ่งรอบ ผลลัพธ์ทั้งหมดมาถึงในสถานะฉบับร่างให้คุณตรวจ"
            />
          </p>

          {state.error ? (
            <p
              role="alert"
              className="mt-3 rounded-[var(--radius-card)] border border-danger-border bg-danger-soft px-3 py-2 text-sm text-danger"
            >
              {state.error}
            </p>
          ) : null}

          <div className="mt-4 flex flex-col gap-2">
            <Notice tone="warn">
              <span className="flex items-start gap-2">
                <Icon name="warning" size={14} className="mt-0.5 shrink-0" />
                <T
                  en="Privacy: Gemini's free tier may use submitted text to improve Google's products. Remove names and confidential details before analysing — for anything truly confidential, use a paid key instead."
                  th="ความเป็นส่วนตัว: Gemini รุ่นฟรีอาจนำข้อความที่ส่งไปใช้พัฒนาโปรดักต์ของ Google ควรลบชื่อบุคคลและรายละเอียดที่เป็นความลับออกก่อนวิเคราะห์ — หากเป็นข้อมูลที่เป็นความลับจริง ควรใช้ API key แบบชำระเงินแทน"
                />
              </span>
            </Notice>
            <button
              type="submit"
              disabled={pending || overLimit}
              aria-busy={pending}
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-card)] bg-accent px-4 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? (
                <T en="Analysing…" th="กำลังวิเคราะห์…" />
              ) : (
                <T en="Create and analyse" th="สร้างและวิเคราะห์" />
              )}
            </button>
            <p
              className={`text-center text-xs ${dailyUsage.remaining === 0 ? "font-medium text-warn" : "text-text-faint"}`}
            >
              <T
                en={`${dailyUsage.remaining} of ${dailyUsage.limit} analyses left today`}
                th={`เหลือ ${dailyUsage.remaining} จาก ${dailyUsage.limit} ครั้งวันนี้`}
              />
            </p>
            <Link
              href="/workspace/projects"
              className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-card)] border border-border-soft px-4 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
            >
              <T en="Cancel" th="ยกเลิก" />
            </Link>
          </div>
        </section>
      </aside>
    </form>
  );
}

function Panel({
  title,
  hint,
  children,
}: {
  title: React.ReactNode;
  hint: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-panel)] border border-border-soft bg-surface shadow-[var(--shadow-panel)] p-5">
      <div className="flex flex-col gap-0.5">
        <h2 className="text-sm font-semibold text-text">{title}</h2>
        <p className="text-xs text-text-muted">{hint}</p>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
}: {
  label: React.ReactNode;
  htmlFor: string;
  error?: string;
  hint?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-text">
        {label}
        {required ? (
          <span className="ml-1 text-accent" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? <p className="text-xs text-text-faint">{hint}</p> : null}
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  muted = false,
}: {
  label: React.ReactNode;
  value: string;
  muted?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-text-faint">{label}</dt>
      <dd className={`truncate text-right text-sm ${muted ? "text-text-faint" : "text-text"}`}>
        {value}
      </dd>
    </div>
  );
}
