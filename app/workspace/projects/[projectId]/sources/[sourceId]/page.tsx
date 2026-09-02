/**
 * Source detail — the document reading surface.
 *
 * The text is rendered as a text node inside a `pre-wrap` block. Not markdown, not
 * HTML, not a sanitised subset: React escapes it and CSS preserves it, so what is on
 * screen is character-for-character what is in the column. That is a requirement, not
 * a style choice — Phase 4 will highlight `rawText.substring(start, end)` on this very
 * element, and any transform applied here would silently move every offset.
 *
 * `getSource` filters on the route's project id as well as the source id, so a real
 * source id under the wrong project is a miss, exactly like a source id belonging to
 * another tenant. Both render the same not-found page.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/app/_components/icon";
import { T } from "@/app/_components/t";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/lib/projects/queries";
import { getSource } from "@/lib/sources/queries";
import { listAnalysisRuns } from "@/lib/analysis/queries";
import { providerLabel } from "@/lib/providers/labels";
import {
  LockBadge,
  RevisionBadge,
  SourceKindBadge,
  formatDate,
} from "../../../../_components/badges";

export const metadata = { title: "Source — ReqWise AI" };

function runStatusLabel(status: string) {
  switch (status) {
    case "valid":
      return <T en="Completed" th="เสร็จสมบูรณ์" />;
    case "invalid":
      return <T en="Invalid output" th="ผลลัพธ์ไม่ถูกต้อง" />;
    case "provider_error":
      return <T en="Provider error" th="ข้อผิดพลาดจากผู้ให้บริการ" />;
    default:
      return status;
  }
}

export default async function SourceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string; sourceId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { projectId, sourceId } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const [project, source] = await Promise.all([
    getProject(supabase, projectId),
    getSource(supabase, projectId, sourceId),
  ]);
  if (!project || !source) notFound();

  const runs = await listAnalysisRuns(supabase, projectId, sourceId);

  const archived = project.status === "archived";
  const base = `/workspace/projects/${projectId}/sources`;
  const canWrite = !archived;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-[var(--space-shell-gap)] px-[var(--space-shell-x)] py-[var(--space-shell-y)] sm:px-[var(--space-shell-x-lg)] sm:py-[var(--space-shell-y-lg)]">
      <header className="flex flex-col gap-3">
        <Link
          href={base}
          className="inline-flex min-h-11 w-fit items-center gap-1 text-xs text-text-faint transition-colors hover:text-text-muted lg:min-h-0"
        >
          <Icon name="arrow-left" size={13} /> <T en="Sources" th="เอกสารต้นฉบับ" />
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">
            {source.title}
          </h1>
          <div className="flex flex-wrap items-center gap-1.5">
            <RevisionBadge revision={source.revisionNumber} />
            <LockBadge locked={source.locked} />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <SourceKindBadge kind={source.kind} />
          <span className="font-mono text-[11px] text-text-faint">
            <T
              en={`${source.characterCount.toLocaleString()} characters`}
              th={`${source.characterCount.toLocaleString()} ตัวอักษร`}
            />
          </span>
        </div>
      </header>

      {/* The intake screen saved the project and this text, but the analysis did not
          complete. The text is safe; "Analyze requirements" below re-runs it. */}
      {error === "analysis" ? (
        <p
          role="alert"
          className="rounded-[var(--radius-card)] border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          <T
            en="The source was saved, but the analysis did not complete. Nothing was lost — run it again below."
            th="บันทึกเอกสารต้นฉบับแล้ว แต่การวิเคราะห์ไม่สำเร็จ ไม่มีอะไรสูญหาย — รันใหม่อีกครั้งด้านล่าง"
          />
        </p>
      ) : null}

      {archived ? (
        <p
          role="status"
          className="rounded-[var(--radius-card)] border border-warn-border bg-warn-soft px-4 py-3 text-sm text-warn"
        >
          <T
            en="This project is archived — this document is read-only. Restore the project to edit it."
            th="โปรเจกต์นี้ถูกเก็บเข้าคลังแล้ว — เอกสารนี้อ่านได้อย่างเดียว กู้คืนโปรเจกต์เพื่อแก้ไข"
          />
        </p>
      ) : source.locked ? (
        <section
          role="status"
          className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-signal-border bg-signal-soft px-4 py-3"
        >
          <p className="text-sm font-semibold text-signal">
            <T
              en={`Revision ${source.revisionNumber} has been analysed and is now permanent`}
              th={`ฉบับที่ ${source.revisionNumber} ได้รับการวิเคราะห์แล้วและกลายเป็นข้อมูลถาวร`}
            />
          </p>
          <p className="text-xs leading-relaxed text-text-muted">
            <T
              en={`${source.analysisRunCount} analysis ${source.analysisRunCount === 1 ? "run cites" : "runs cite"} this exact text, so it can no longer change — a requirement that points at it must keep pointing at what it actually said. Edits are saved as revision ${source.revisionNumber + 1}.`}
              th={`มีการวิเคราะห์ ${source.analysisRunCount} ครั้งอ้างอิงข้อความนี้อยู่ จึงไม่สามารถแก้ไขได้อีก — ข้อกำหนดที่อ้างอิงมันต้องชี้ไปยังสิ่งที่มันเคยระบุไว้จริง การแก้ไขจะถูกบันทึกเป็นฉบับที่ ${source.revisionNumber + 1}`}
            />
          </p>
        </section>
      ) : null}

      {source.supersededById ? (
        <p className="rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-4 py-3 text-sm text-text-muted">
          <T en="A newer revision of this document exists." th="เอกสารนี้มีฉบับใหม่กว่าอยู่" />{" "}
          <Link
            href={`${base}/${source.supersededById}`}
            className="font-medium text-accent underline underline-offset-2"
          >
            <T
              en={`Open revision ${source.supersededByRevision}`}
              th={`เปิดฉบับที่ ${source.supersededByRevision}`}
            />
          </Link>
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        {/* The document itself */}
        <article className="flex flex-col rounded-[var(--radius-panel)] border border-border-soft bg-surface">
          <h2 className="border-b border-border-soft px-5 py-3 text-sm font-semibold text-text">
            <T en="Source text" th="ข้อความต้นฉบับ" />
          </h2>
          {/*
            whitespace-pre-wrap keeps every space, tab and blank line; break-words stops a
            pasted URL from widening the page. The value is a child text node — nothing on
            this page ever sets innerHTML, so a source containing markup is displayed as
            markup, never executed as it.
          */}
          <pre className="overflow-x-auto whitespace-pre-wrap break-words px-5 py-4 font-mono text-[13.5px] leading-[1.75] text-text selection:bg-accent-soft">
            {source.rawText}
          </pre>
        </article>

        {/* Inspector — provenance and actions */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
          <section className="rounded-[var(--radius-panel)] border border-border-soft bg-surface p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-faint">
              <T en="Details" th="รายละเอียด" />
            </h2>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <Meta label={<T en="Revision" th="ฉบับ" />} value={String(source.revisionNumber)} />
              <Meta
                label={<T en="State" th="สถานะ" />}
                value={source.locked ? <T en="Locked" th="ล็อกแล้ว" /> : <T en="Editable" th="แก้ไขได้" />}
              />
              <Meta
                label={<T en="Source date" th="วันที่ของเอกสาร" />}
                value={source.metadata.sourceDate ? formatDate(source.metadata.sourceDate) : "—"}
              />
              <Meta label={<T en="Stakeholder" th="ผู้ให้ข้อมูล" />} value={source.metadata.stakeholder ?? "—"} />
              <Meta label={<T en="Added" th="เพิ่มเมื่อ" />} value={formatDate(source.createdAt)} />
              {source.updatedAt !== source.createdAt ? (
                <Meta label={<T en="Edited" th="แก้ไขเมื่อ" />} value={formatDate(source.updatedAt)} />
              ) : null}
              <Meta label={<T en="Analysis runs" th="รอบการวิเคราะห์" />} value={String(source.analysisRunCount)} />
            </dl>

            {source.metadata.notes ? (
              <p className="mt-3 border-t border-border-soft pt-3 text-xs leading-relaxed text-text-muted">
                {source.metadata.notes}
              </p>
            ) : null}
          </section>

          {source.supersedesId ? (
            <section className="rounded-[var(--radius-panel)] border border-border-soft bg-surface p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-text-faint">
                <T en="Revision history" th="ประวัติฉบับ" />
              </h2>
              <p className="mt-2 text-xs leading-relaxed text-text-muted">
                <T
                  en={`This revision replaces revision ${source.revisionNumber - 1}, which stays exactly as it was analysed.`}
                  th={`ฉบับนี้แทนที่ฉบับที่ ${source.revisionNumber - 1} ซึ่งยังคงอยู่ตามที่เคยถูกวิเคราะห์ไว้ทุกประการ`}
                />
              </p>
              <Link
                href={`${base}/${source.supersedesId}`}
                className="mt-2 inline-flex text-xs font-medium text-accent underline underline-offset-2"
              >
                <T
                  en={`Open revision ${source.revisionNumber - 1}`}
                  th={`เปิดฉบับที่ ${source.revisionNumber - 1}`}
                />
              </Link>
            </section>
          ) : null}

          {canWrite ? (
            <section className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-accent-border bg-accent-soft p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-accent">
                <T en="Analysis" th="การวิเคราะห์" />
              </h2>
              <p className="text-xs leading-relaxed text-text-muted">
                {source.locked ? (
                  <T
                    en="You can run this again — each run is kept separately."
                    th="คุณสามารถรันการวิเคราะห์นี้อีกครั้งได้ — แต่ละรอบจะถูกเก็บแยกจากกัน"
                  />
                ) : (
                  <T
                    en={`This will lock revision ${source.revisionNumber} once the run is created.`}
                    th={`การดำเนินการนี้จะล็อกฉบับที่ ${source.revisionNumber} ทันทีที่สร้างรอบการวิเคราะห์`}
                  />
                )}
              </p>
              <Link
                href={`${base}/${source.id}/analyze`}
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-card)] bg-accent px-4 text-sm
                           font-semibold text-on-accent transition-colors hover:bg-accent-hover"
              >
                <T en="Analyze requirements" th="วิเคราะห์ข้อกำหนด" />
              </Link>
            </section>
          ) : null}

          {runs.length > 0 ? (
            <section className="flex flex-col gap-2 rounded-[var(--radius-panel)] border border-border-soft bg-surface p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-text-faint">
                <T en="Analysis history" th="ประวัติการวิเคราะห์" />
              </h2>
              <ul className="flex flex-col gap-2">
                {runs.map((run) => (
                  <li key={run.id}>
                    <Link
                      href={`/workspace/projects/${projectId}/analyses/${run.id}`}
                      className="flex flex-col gap-0.5 rounded-[var(--radius-card)] border border-border-soft px-3 py-2 text-xs
                                 transition-colors hover:border-accent-border hover:bg-accent-soft"
                    >
                      <span className="flex items-center justify-between gap-2 font-medium text-text">
                        {runStatusLabel(run.validationStatus)}
                        <span className="font-mono text-[11px] text-text-muted">
                          <T
                            en={`${run.itemCount} item${run.itemCount === 1 ? "" : "s"}`}
                            th={`${run.itemCount} รายการ`}
                          />
                        </span>
                      </span>
                      <span className="flex items-center justify-between gap-2 text-text-muted">
                        <span>{providerLabel(run.provider)}</span>
                        <span>{formatDate(run.createdAt)}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          {canWrite ? (
            <section className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-border-soft bg-surface p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-text-faint">
                {source.locked ? (
                  <T en="Create a revision" th="สร้างฉบับใหม่" />
                ) : (
                  <T en="Edit source" th="แก้ไขเอกสารต้นฉบับ" />
                )}
              </h2>
              <p className="text-xs leading-relaxed text-text-muted">
                {source.locked ? (
                  <T
                    en="The analysed text stays as it is. Your changes become the next revision."
                    th="ข้อความที่วิเคราะห์แล้วจะคงอยู่ตามเดิม การเปลี่ยนแปลงของคุณจะกลายเป็นฉบับถัดไป"
                  />
                ) : (
                  <T
                    en="Nothing has been analysed yet, so this document can still be corrected in place."
                    th="ยังไม่มีการวิเคราะห์ จึงยังสามารถแก้ไขเอกสารนี้ได้โดยตรง"
                  />
                )}
              </p>
              <Link
                href={`${base}/${source.id}/edit`}
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-card)] bg-accent px-4 text-sm
                           font-semibold text-on-accent transition-colors hover:bg-accent-hover"
              >
                {source.locked ? (
                  <T
                    en={`Create revision ${source.revisionNumber + 1}`}
                    th={`สร้างฉบับที่ ${source.revisionNumber + 1}`}
                  />
                ) : (
                  <T en="Edit this source" th="แก้ไขเอกสารนี้" />
                )}
              </Link>
            </section>
          ) : null}
        </aside>
      </div>
    </main>
  );
}

function Meta({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-xs text-text-faint">{label}</dt>
      <dd className="truncate text-right text-sm text-text">{value}</dd>
    </div>
  );
}
