/**
 * Project overview.
 *
 * Two columns on desktop, mirroring the create screen: the project's own content on
 * the left, its metadata and lifecycle in a right-hand inspector — the same seam the
 * analysis workspace will use for requirement metadata, so the shape is established
 * once rather than invented twice.
 *
 * `getProject` returns null both for a project that does not exist and for one that
 * belongs to somebody else — RLS makes those indistinguishable — and both render the
 * same not-found page. Nothing here confirms another tenant's project exists.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/app/_components/icon";
import { T } from "@/app/_components/t";
import { ActionLink } from "@/app/_components/ui/action-link";
import { Panel, SectionHeader } from "@/app/_components/ui/section-header";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/lib/projects/queries";
import { listSources } from "@/lib/sources/queries";
import type { SourceSummary } from "@/lib/sources/types";
import {
  DomainBadge,
  LangBadge,
  LockBadge,
  RevisionBadge,
  StatusBadge,
  formatDate,
} from "../../_components/badges";
import { ArchiveControls } from "./archive-controls";
import { ProjectNav } from "./_components/project-nav";

export const metadata = { title: "Project — ReqWise AI" };

export default async function ProjectOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { projectId } = await params;
  const { error } = await searchParams;

  const supabase = await createClient();
  const project = await getProject(supabase, projectId);
  if (!project) notFound();

  // The five most recent documents, so the overview shows the work rather than
  // describing it. The full set lives one click away.
  const recentSources = await listSources(supabase, projectId, { limit: 5 });
  const archived = project.status === "archived";

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-[var(--space-shell-gap)] px-[var(--space-shell-x)] py-[var(--space-shell-y)] sm:px-[var(--space-shell-x-lg)] sm:py-[var(--space-shell-y-lg)]">
      <header className="flex flex-col gap-2">
        <Link
          href="/workspace/projects"
          className="inline-flex min-h-11 w-fit items-center gap-1 text-xs text-text-faint transition-colors hover:text-text-muted lg:min-h-0"
        >
          <Icon name="arrow-left" size={13} /> <T en="Projects" th="โปรเจกต์" />
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">
            {project.name}
          </h1>
          <StatusBadge status={project.status} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {project.domain ? <DomainBadge name={project.domain.name} /> : null}
          <LangBadge lang={project.outputLang} />
        </div>
      </header>

      <ProjectNav projectId={projectId} hasItems={project.analysisItemCount > 0} />

      {error ? (
        <p
          role="alert"
          className="rounded-[var(--radius-card)] border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          {error === "archive" ? (
            <T en="The project could not be archived." th="ไม่สามารถเก็บโปรเจกต์เข้าคลังได้" />
          ) : error === "source" ? (
            // The intake screen created this project but could not attach the text.
            // Nothing was lost and nothing was duplicated — the project is here, and
            // the source can be added below.
            <T
              en="The project was created, but the source text could not be saved. Add it below and analyse from there."
              th="สร้างโปรเจกต์แล้ว แต่บันทึกข้อความต้นฉบับไม่สำเร็จ เพิ่มด้านล่างแล้ววิเคราะห์จากตรงนั้น"
            />
          ) : (
            <T
              en="The project could not be restored. Only a workspace owner can restore."
              th="ไม่สามารถกู้คืนโปรเจกต์ได้ เจ้าของพื้นที่ทำงานเท่านั้นที่กู้คืนได้"
            />
          )}
        </p>
      ) : null}

      {archived ? (
        <section
          role="status"
          className="flex flex-col gap-1 rounded-[var(--radius-card)] border border-warn-border bg-warn-soft px-4 py-3"
        >
          <p className="text-sm font-semibold text-warn">
            <T en="This project is archived — read-only" th="โปรเจกต์นี้ถูกเก็บเข้าคลังแล้ว — อ่านได้อย่างเดียว" />
          </p>
          <p className="text-xs leading-relaxed text-text-muted">
            <T
              en={
                <>
                  Nothing was deleted: sources, analysis runs and review history are all
                  intact. Restore the project to work on it again.
                  {project.archiveReason ? ` Reason given: “${project.archiveReason}”.` : ""}
                </>
              }
              th={
                <>
                  ไม่มีอะไรถูกลบ: เอกสารต้นฉบับ รอบการวิเคราะห์ และประวัติการรีวิวยังคงอยู่ครบถ้วน
                  กู้คืนโปรเจกต์เพื่อทำงานต่อได้อีกครั้ง
                  {project.archiveReason ? ` เหตุผลที่ระบุ: “${project.archiveReason}”` : ""}
                </>
              }
            />
          </p>
        </section>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex flex-col gap-4">
          <section className="grid gap-3 sm:grid-cols-3">
            <Stat label={<T en="Source documents" th="เอกสารต้นฉบับ" />} value={project.sourceDocumentCount} />
            <Stat label={<T en="Analysis runs" th="รอบการวิเคราะห์" />} value={project.analysisRunCount} />
            <Stat label={<T en="Requirements" th="ข้อกำหนด" />} value={project.analysisItemCount} />
          </section>

          {/*
           * Traceability spans runs, so it belongs to the project rather than to any
           * one analysis. Offered only once there is something to trace — a link to an
           * empty matrix teaches a reader that the feature is empty, not that their
           * project is.
           */}
          {project.analysisItemCount > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <ProjectLink
                href={`/workspace/projects/${projectId}/traceability`}
                title={<T en="Traceability" th="การเชื่อมโยง" />}
                detail={
                  <T
                    en="Objectives → requirements → stories → acceptance criteria, and what is missing"
                    th="วัตถุประสงค์ → ข้อกำหนด → เรื่องราวผู้ใช้ → เกณฑ์การยอมรับ และสิ่งที่ยังขาด"
                  />
                }
              />
              {/*
               * Export is offered on the same terms and for the same reason: it reads what
               * the analysis and the review produced, so it is worth offering exactly when
               * there is something to read. An archived project keeps it — an export writes
               * nothing, so there is no action for the archive to refuse.
               */}
              <ProjectLink
                href={`/workspace/projects/${projectId}/exports`}
                title={<T en="Export" th="ส่งออก" />}
                detail={
                  <T
                    en="Markdown, JSON, CSV or a printable document for handoff"
                    th="Markdown, JSON, CSV หรือเอกสารสำหรับพิมพ์เพื่อส่งมอบ"
                  />
                }
              />
            </div>
          ) : null}

          <Panel>
            <SectionHeader icon="paste" title={<T en="Project brief" th="ข้อมูลสรุปโปรเจกต์" />} />
            <div className="flex flex-col gap-2 p-3">
              <Row label={<T en="Description" th="รายละเอียด" />} value={project.description} />
              <Row
                label={<T en="Business objective" th="วัตถุประสงค์ทางธุรกิจ" />}
                value={project.businessObjective}
              />
              <Row
                label={<T en="Known stakeholders" th="ผู้มีส่วนได้ส่วนเสียที่ทราบ" />}
                value={
                  project.knownStakeholders.length > 0
                    ? project.knownStakeholders.join(" · ")
                    : null
                }
              />
            </div>
          </Panel>

          {recentSources.length === 0 ? (
            archived ? (
              <section className="rounded-[var(--radius-panel)] border border-border-soft bg-surface-muted px-5 py-4">
                <h2 className="text-sm font-semibold text-text">
                  <T en="No source documents" th="ยังไม่มีเอกสารต้นฉบับ" />
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">
                  <T
                    en="This project was archived before any source information was added."
                    th="โปรเจกต์นี้ถูกเก็บเข้าคลังก่อนที่จะมีการเพิ่มข้อมูลต้นฉบับใดๆ"
                  />
                </p>
              </section>
            ) : (
              <section className="rounded-[var(--radius-panel)] border border-accent-border bg-accent-soft px-5 py-4">
                <h2 className="text-sm font-semibold text-text">
                  <T en="Next step — add source information" th="ขั้นตอนถัดไป — เพิ่มข้อมูลต้นฉบับ" />
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-text-muted">
                  <T
                    en="Paste the meeting notes, interview or client message this project is about. Requirements are only ever generated from text you supply."
                    th="วางบันทึกการประชุม บทสัมภาษณ์ หรือข้อความจากลูกค้าที่เกี่ยวกับโปรเจกต์นี้ ข้อกำหนดจะถูกสร้างจากข้อความที่คุณให้มาเท่านั้น"
                  />
                </p>
                <Link
                  href={`/workspace/projects/${projectId}/sources/new`}
                  className="mt-3 inline-flex min-h-11 items-center justify-center rounded-[var(--radius-card)] bg-accent px-4
                             text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover"
                >
                  <T en="Add source information" th="เพิ่มข้อมูลต้นฉบับ" />
                </Link>
              </section>
            )
          ) : (
            <section className="rounded-[var(--radius-panel)] border border-border-soft bg-surface shadow-[var(--shadow-panel)]">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-soft px-5 py-3">
                <h2 className="text-sm font-semibold text-text">
                  <T en="Recent sources" th="เอกสารต้นฉบับล่าสุด" />
                </h2>
                <div className="flex items-center gap-3">
                  <ActionLink
                    href={`/workspace/projects/${projectId}/sources`}
                    variant="ghost"
                    size="sm"
                  >
                    <T
                      en={`View all ${project.sourceDocumentCount}`}
                      th={`ดูทั้งหมด ${project.sourceDocumentCount}`}
                    />
                  </ActionLink>
                  {archived ? null : (
                    <Link
                      href={`/workspace/projects/${projectId}/sources/new`}
                      className="inline-flex min-h-11 items-center rounded-[var(--radius-card)] border border-border-soft px-2.5 text-xs font-medium
                                 text-text-muted transition-colors hover:bg-surface-hover hover:text-text lg:min-h-9"
                    >
                      <T en="Add source" th="เพิ่มเอกสารต้นฉบับ" />
                    </Link>
                  )}
                </div>
              </div>
              <ul className="flex flex-col divide-y divide-[var(--border)]">
                {recentSources.map((source) => (
                  <SourceRow key={source.id} projectId={projectId} source={source} />
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Inspector — metadata and lifecycle, kept out of the reading column. */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20">
          <section className="rounded-[var(--radius-panel)] border border-border-soft bg-surface shadow-[var(--shadow-panel)] p-4">
            <h2 className="text-xs font-semibold uppercase tracking-wide text-text-faint">
              <T en="Details" th="รายละเอียด" />
            </h2>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <Meta label={<T en="Domain" th="โดเมน" />} value={project.domain?.name ?? "—"} />
              <Meta
                label={<T en="Output" th="ผลลัพธ์" />}
                value={project.outputLang === "th" ? <T en="Thai" th="ไทย" /> : <T en="English" th="อังกฤษ" />}
              />
              <Meta
                label={<T en="Status" th="สถานะ" />}
                value={archived ? <T en="Archived" th="เก็บเข้าคลัง" /> : <T en="Active" th="ใช้งานอยู่" />}
              />
              <Meta label={<T en="Created" th="สร้างเมื่อ" />} value={formatDate(project.createdAt)} />
              <Meta label={<T en="Updated" th="อัปเดตเมื่อ" />} value={formatDate(project.updatedAt)} />
              {archived && project.archivedAt ? (
                <Meta label={<T en="Archived" th="เก็บเข้าคลังเมื่อ" />} value={formatDate(project.archivedAt)} />
              ) : null}
            </dl>
          </section>

          <ArchiveControls projectId={project.id} archived={archived} />
        </aside>
      </div>
    </main>
  );
}

/** One line per document: what it is, which revision, and whether it can still move. */
function SourceRow({
  projectId,
  source,
}: {
  projectId: string;
  source: SourceSummary;
}) {
  return (
    <li>
      <Link
        href={`/workspace/projects/${projectId}/sources/${source.id}`}
        className="flex min-h-11 flex-col gap-1.5 px-5 py-3 transition-colors hover:bg-surface-hover
                   sm:flex-row sm:items-center sm:justify-between sm:gap-4"
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate text-sm font-medium text-text">{source.title}</span>
          <span className="truncate text-xs text-text-faint">{source.preview}</span>
        </span>
        <span className="flex shrink-0 flex-wrap items-center gap-1.5">
          <RevisionBadge revision={source.revisionNumber} />
          <LockBadge locked={source.locked} />
        </span>
      </Link>
    </li>
  );
}

/** One card-shaped destination beneath the project's numbers. */
function ProjectLink({
  href,
  title,
  detail,
}: {
  href: string;
  title: React.ReactNode;
  detail: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center justify-between gap-3 rounded-[var(--radius-card)]
                 border border-border-soft bg-surface px-4 py-3 transition-colors hover:bg-surface-hover"
    >
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-text">{title}</span>
        <span className="text-xs text-text-faint">{detail}</span>
      </span>
      <span aria-hidden="true" className="text-text-faint">
        →
      </span>
    </Link>
  );
}

function Stat({ label, value }: { label: React.ReactNode; value: number }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-border-soft bg-surface px-4 py-3">
      <p className="text-xl font-semibold text-text">{value}</p>
      <p className="text-xs text-text-faint">{label}</p>
    </div>
  );
}

/**
 * A labelled field, boxed rather than divider-separated. The audit that drove this
 * redesign found this exact shape — a `divide-y` list of label/value text — as one of
 * the "มีแต่ Text ไม่มีกรอบ" spots: a hairline between rows reads as one continuous
 * block, not as distinct facts. The label keeps its own muted cell so it never blurs
 * into the value next to it.
 */
function Row({ label, value }: { label: React.ReactNode; value: string | null }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-[var(--radius-card)] border border-border-soft sm:flex-row sm:items-stretch">
      <span className="shrink-0 rounded-t-[var(--radius-card)] border-b border-border-soft bg-surface-muted px-2.5 py-1.5 text-xs font-medium uppercase tracking-wide text-text-faint sm:w-40 sm:rounded-l-[var(--radius-card)] sm:rounded-tr-none sm:border-r sm:border-b-0">
        {label}
      </span>
      <span
        className={`flex-1 px-2.5 py-1.5 text-sm leading-relaxed ${value ? "text-text" : "text-text-faint"}`}
      >
        {value ?? <T en="Not provided" th="ไม่มีข้อมูล" />}
      </span>
    </div>
  );
}

/** The same boxed treatment, for the tighter key:value pairs in the Details inspector. */
function Meta({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-2.5 py-1.5">
      <dt className="text-xs text-text-faint">{label}</dt>
      <dd className="truncate text-right text-sm font-medium text-text">{value}</dd>
    </div>
  );
}
