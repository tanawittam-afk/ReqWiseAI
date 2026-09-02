/**
 * The export screen: scope on the left, readiness and actions on the right, the document
 * itself in the middle.
 *
 * Authorization is RLS, exactly as on every other project route: `loadExportInput` returns
 * `null` for a project that does not exist *and* for one belonging to another tenant, and
 * both render the same not-found page. Nothing here confirms another tenant's project
 * exists.
 *
 * An archived project exports normally. An export is a *reading*, so there is no write for
 * an archive to refuse — the document carries a notice saying where it came from, and that
 * notice is not optional.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/app/_components/icon";
import { T } from "@/app/_components/t";
import { ActionLink } from "@/app/_components/ui/action-link";
import { EmptyState } from "@/app/_components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import { buildExportPackage } from "@/lib/export/build";
import { loadExportInput } from "@/lib/export/load";
import { assessReadiness, READINESS_LABEL, type ReadinessIssue } from "@/lib/export/readiness";
import { needsVersionHistory, parseScope, scopeQuery } from "@/lib/export/url";
import { EXPORT_SCHEMA_VERSION } from "@/lib/contracts/export";
import { ExportDocument } from "./_components/document";
import { DownloadActions } from "./_components/download-actions";
import { ScopePanel } from "./_components/scope-panel";
import { ProjectNav } from "../_components/project-nav";

export const metadata = { title: "Export — ReqWise AI" };

/** A repeated query parameter arrives as an array; the parser wants one string. */
function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value.join(",");
  return value;
}

export default async function ExportPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{
    preset?: string | string[];
    status?: string | string[];
    sections?: string | string[];
    confidence?: string | string[];
  }>;
}) {
  const { projectId } = await params;
  const query = await searchParams;

  const { scope, preset } = parseScope({
    preset: first(query.preset),
    status: first(query.status),
    sections: first(query.sections),
    confidence: first(query.confidence),
  });

  const supabase = await createClient();
  const input = await loadExportInput(supabase, projectId, {
    includeVersionHistory: needsVersionHistory(scope),
  });
  if (!input) notFound();

  const pkg = buildExportPackage(input, scope, new Date().toISOString());
  const readiness = assessReadiness(input, pkg);
  const serialised = scopeQuery(scope);

  const hasItems = input.items.length > 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border-soft bg-chrome px-4 py-2 sm:px-5">
        <Link
          href={`/workspace/projects/${projectId}`}
          className="inline-flex min-h-11 items-center gap-1 text-xs text-text-muted transition-colors hover:text-text lg:min-h-0"
        >
          <Icon name="arrow-left" size={13} /> {input.project.name}
        </Link>
        {input.project.status === "archived" ? (
          <span className="rounded-[var(--radius-card)] border border-warn-border bg-warn-soft px-1.5 py-px text-[10px] font-medium text-warn">
            <T en="Archived — read-only" th="เก็บเข้าคลัง — อ่านอย่างเดียว" />
          </span>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-3">
          <ProjectNav projectId={projectId} hasItems={hasItems} />
          <span className="text-xs text-text-faint">
            <T en="Export schema" th="สคีมาการส่งออก" /> {EXPORT_SCHEMA_VERSION}
          </span>
        </div>
      </div>

      {!hasItems ? (
        <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-[var(--space-shell-x)] py-[var(--space-shell-y-tight)] sm:px-[var(--space-shell-x-lg)]">
          <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">
            <T en="Export" th="ส่งออก" />
          </h1>
          <EmptyState
            icon="paste"
            title={<T en="Nothing to export yet" th="ยังไม่มีอะไรให้ส่งออก" />}
            body={
              <T
                en="This project has no analysed requirements yet. Add a source document and run an analysis first — an export reads from the run, not from raw text."
                th="โปรเจกต์นี้ยังไม่มีข้อกำหนดที่วิเคราะห์แล้ว เพิ่มเอกสารต้นฉบับและรันการวิเคราะห์ก่อน — การส่งออกอ่านจากรอบการวิเคราะห์ ไม่ใช่จากข้อความดิบ"
              />
            }
            action={
              <Link
                href={`/workspace/projects/${projectId}/sources`}
                className="inline-flex min-h-11 items-center justify-center rounded-[var(--radius-card)] bg-accent px-4 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover"
              >
                <T en="Go to source documents" th="ไปที่เอกสารต้นฉบับ" />
              </Link>
            }
          />
        </main>
      ) : (
        <main className="mx-auto grid w-full max-w-[1400px] flex-1 gap-5 px-4 py-5 sm:px-6
                         lg:grid-cols-[300px_minmax(0,1fr)_320px] lg:items-start">
          {/* Scope */}
          <aside className="flex flex-col gap-4 rounded-[var(--radius-panel)] border border-border-soft bg-surface p-4 lg:sticky lg:top-4">
            <h1 className="text-[17px] font-semibold text-text">
              <T en="Export" th="ส่งออก" />
            </h1>
            <ScopePanel projectId={projectId} scope={scope} preset={preset} />
          </aside>

          {/* Document */}
          <section className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold text-text">
                <T en="Document preview" th="ตัวอย่างเอกสาร" />
              </h2>
              <ActionLink
                href={`/workspace/projects/${projectId}/exports/preview?${serialised}`}
                variant="ghost"
                size="sm"
              >
                <T en="Open full-width preview" th="เปิดตัวอย่างแบบเต็มความกว้าง" />
              </ActionLink>
            </div>
            <div className="min-w-0 rounded-[var(--radius-panel)] border border-border-soft bg-surface px-4 py-5 sm:px-6 sm:py-6">
              <ExportDocument pkg={pkg} />
            </div>
          </section>

          {/* Readiness and actions */}
          <aside className="flex flex-col gap-4 lg:sticky lg:top-4">
            <ReadinessCard readiness={readiness} />
            <section className="flex flex-col gap-2 rounded-[var(--radius-panel)] border border-border-soft bg-surface p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-text-faint">
                <T en="Download" th="ดาวน์โหลด" />
              </h2>
              <DownloadActions
                projectId={projectId}
                slug={pkg.project.slug}
                query={serialised}
                disabled={readiness.level === "cannot_export"}
              />
            </section>
          </aside>
        </main>
      )}
    </div>
  );
}

function ReadinessCard({
  readiness,
}: {
  readiness: ReturnType<typeof assessReadiness>;
}) {
  const tone =
    readiness.level === "cannot_export"
      ? "border-danger-border bg-danger-soft text-danger"
      : readiness.level === "ready_with_warnings"
        ? "border-warn-border bg-warn-soft text-warn"
        : "border-ok-border bg-ok-soft text-ok";

  return (
    <section className="flex flex-col gap-3 rounded-[var(--radius-panel)] border border-border-soft bg-surface p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-text-faint">
        <T en="Export readiness" th="ความพร้อมในการส่งออก" />
      </h2>

      {/* The level is a word, never a colour alone. */}
      <p role="status" className={`rounded-[var(--radius-card)] border px-2.5 py-1.5 text-sm font-semibold ${tone}`}>
        {READINESS_LABEL[readiness.level]}
      </p>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]">
        <Count label={<T en="Requirements" th="ข้อกำหนด" />} value={readiness.counts.requirements} />
        <Count label={<T en="Questions" th="คำถาม" />} value={readiness.counts.openQuestions} />
        <Count label={<T en="Findings" th="ข้อค้นพบ" />} value={readiness.counts.qualityFindings} />
        <Count label={<T en="Relations" th="ความสัมพันธ์" />} value={readiness.counts.relations} />
      </dl>

      {readiness.errors.length > 0 ? (
        <IssueList
          title={<T en="Blocking problems" th="ปัญหาที่ปิดกั้นการส่งออก" />}
          issues={readiness.errors}
          className="text-danger"
        />
      ) : null}

      {readiness.warnings.length > 0 ? (
        <IssueList title={<T en="Warnings" th="คำเตือน" />} issues={readiness.warnings} className="text-text-muted" />
      ) : null}

      {readiness.errors.length === 0 && readiness.warnings.length === 0 ? (
        <p className="text-[13px] leading-relaxed text-text-muted">
          <T
            en="Every citation matches the text it quotes, and nothing in this scope is outstanding."
            th="ทุกการอ้างอิงตรงกับข้อความที่อ้างถึง และไม่มีสิ่งใดในขอบเขตนี้ที่ค้างอยู่"
          />
        </p>
      ) : null}
    </section>
  );
}

function IssueList({
  title,
  issues,
  className,
}: {
  title: React.ReactNode;
  issues: ReadinessIssue[];
  className: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-text-faint">{title}</h3>
      <ul className="flex flex-col gap-2">
        {issues.map((issue) => (
          <li key={issue.key} className="flex flex-col gap-0.5">
            <span className={`text-[13px] leading-relaxed ${className}`}>{issue.message}</span>
            {issue.displayIds.length > 0 ? (
              <span className="font-mono text-xs text-text-faint">
                {issue.displayIds.slice(0, 12).join(", ")}
                {issue.displayIds.length > 12 ? (
                  <>
                    {" "}
                    +{issue.displayIds.length - 12} <T en="more" th="เพิ่มเติม" />
                  </>
                ) : (
                  ""
                )}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Count({ label, value }: { label: React.ReactNode; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-text-faint">{label}</dt>
      <dd className="font-medium text-text">{value}</dd>
    </div>
  );
}
