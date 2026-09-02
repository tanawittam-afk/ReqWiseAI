/**
 * Project list — the workspace's home.
 *
 * Projects read as documents, not as rows in an admin table or cards in a shop: a
 * title, the two facts that decide what to do next (domain and state), and when it
 * last moved. RLS scopes the query, so this page never filters by owner itself.
 */

import Link from "next/link";
import { T } from "@/app/_components/t";
import { EmptyState } from "@/app/_components/ui/empty-state";
import { createClient } from "@/lib/supabase/server";
import { PROJECT_FILTERS, type ProjectFilter } from "@/lib/contracts/project";
import { countProjects, listProjects } from "@/lib/projects/queries";
import { DomainBadge, LangBadge, StatusBadge, formatDate } from "../_components/badges";
import { TryExampleButton } from "./example-button";

export const metadata = { title: "Projects — ReqWise AI" };

function parseFilter(value: string | undefined): ProjectFilter {
  return (PROJECT_FILTERS as readonly string[]).includes(value ?? "")
    ? (value as ProjectFilter)
    : "active";
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string; error?: string }>;
}) {
  const { filter: filterParam, error } = await searchParams;
  const filter = parseFilter(filterParam);
  const supabase = await createClient();

  const [projects, counts] = await Promise.all([
    listProjects(supabase, filter),
    countProjects(supabase),
  ]);

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-[var(--space-shell-gap)] px-[var(--space-shell-x)] py-[var(--space-shell-y)] sm:px-[var(--space-shell-x-lg)] sm:py-[var(--space-shell-y-lg)]">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">
            <T en="Projects" th="โปรเจกต์" />
          </h1>
          <p className="text-sm text-text-muted">
            <T en={`${counts.active} active`} th={`ใช้งานอยู่ ${counts.active}`} />
            <span aria-hidden="true" className="px-1.5 text-text-faint">
              ·
            </span>
            <T en={`${counts.archived} archived`} th={`เก็บเข้าคลัง ${counts.archived}`} />
          </p>
        </div>

        <Link
          href="/workspace/projects/new"
          className="inline-flex min-h-11 items-center rounded-[var(--radius-card)] bg-accent px-4 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover lg:min-h-10"
        >
          <T en="New project" th="โปรเจกต์ใหม่" />
        </Link>
      </header>

      {error === "example" ? (
        <p
          role="alert"
          className="rounded-[var(--radius-card)] border border-danger-border bg-danger-soft px-4 py-3 text-sm text-danger"
        >
          <T
            en="The example project could not be created. Nothing was saved — try again, or start a project of your own."
            th="สร้างโปรเจกต์ตัวอย่างไม่สำเร็จ ไม่มีการบันทึกใดๆ — ลองใหม่ หรือเริ่มโปรเจกต์ของคุณเอง"
          />
        </p>
      ) : null}

      {/* Segmented control rather than tabs — a filter is a view of one list. */}
      <div
        role="group"
        aria-label="Filter projects"
        className="inline-flex w-fit gap-0.5 rounded-[var(--radius-panel)] border border-border-soft bg-chrome p-0.5"
      >
        {PROJECT_FILTERS.map((value) => {
          const active = value === filter;
          return (
            <Link
              key={value}
              href={`/workspace/projects?filter=${value}`}
              aria-current={active ? "true" : undefined}
              className={`flex min-h-11 items-center rounded-[var(--radius-card)] px-3.5 py-1.5 text-sm capitalize transition-colors lg:min-h-9 ${
                active
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-text-muted hover:text-text"
              }`}
            >
              {value === "active" ? (
                <T en="active" th="ใช้งานอยู่" />
              ) : value === "archived" ? (
                <T en="archived" th="เก็บเข้าคลัง" />
              ) : (
                <T en="all" th="ทั้งหมด" />
              )}
            </Link>
          );
        })}
      </div>

      {projects.length === 0 ? (
        <ProjectsEmptyState filter={filter} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/workspace/projects/${project.id}`}
                className="group flex h-full flex-col gap-3 rounded-[var(--radius-card)] border border-border-soft bg-surface p-4
                           transition-colors duration-150
                           hover:border-border-strong"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-[15px] font-semibold leading-snug text-text group-hover:text-accent">
                    {project.name}
                  </h2>
                  <LangBadge lang={project.outputLang} />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {project.domain ? <DomainBadge name={project.domain.name} /> : null}
                  <StatusBadge status={project.status} />
                </div>

                <dl className="mt-auto grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border-soft pt-3 text-xs">
                  <div className="flex items-center justify-between">
                    <dt className="text-text-faint">
                      <T en="Sources" th="เอกสารต้นฉบับ" />
                    </dt>
                    <dd className="font-medium text-text-muted">{project.sourceDocumentCount}</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-text-faint">
                      <T en="Requirements" th="ข้อกำหนด" />
                    </dt>
                    <dd className="font-medium text-text-muted">{project.analysisItemCount}</dd>
                  </div>
                  <div className="col-span-2 pt-1 text-text-faint">
                    {project.status === "archived" && project.archivedAt ? (
                      <T
                        en={`Archived ${formatDate(project.archivedAt)}`}
                        th={`เก็บเข้าคลังเมื่อ ${formatDate(project.archivedAt)}`}
                      />
                    ) : (
                      <T
                        en={`Updated ${formatDate(project.updatedAt)}`}
                        th={`อัปเดตเมื่อ ${formatDate(project.updatedAt)}`}
                      />
                    )}
                  </div>
                </dl>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function ProjectsEmptyState({ filter }: { filter: ProjectFilter }) {
  if (filter === "archived") {
    return (
      <EmptyState
        title={<T en="Nothing archived" th="ยังไม่มีอะไรถูกเก็บเข้าคลัง" />}
        body={
          <T
            en="Archived projects stay here in full — sources, runs and review history included. Nothing is ever deleted."
            th="โปรเจกต์ที่เก็บเข้าคลังยังคงอยู่ครบถ้วน — รวมถึงเอกสารต้นฉบับ รอบการวิเคราะห์ และประวัติการรีวิว ไม่มีอะไรถูกลบ"
          />
        }
        action={
          <Link
            href="/workspace/projects?filter=active"
            className="inline-flex min-h-11 items-center rounded-[var(--radius-card)] border border-border-soft bg-surface px-4 text-sm font-medium text-text transition-colors hover:bg-surface-hover"
          >
            <T en="Back to active projects" th="กลับไปที่โปรเจกต์ที่ใช้งานอยู่" />
          </Link>
        }
      />
    );
  }

  return (
    <EmptyState
      icon="projects"
      title={<T en="Start with the messy version" th="เริ่มจากข้อมูลที่ยังไม่เป็นระเบียบ" />}
      body={
        <T
          en="A project holds one piece of business reality — meeting notes, an interview, a client message — and turns it into requirements you can trace back to the sentence they came from."
          th="โปรเจกต์หนึ่งเก็บข้อมูลจริงทางธุรกิจหนึ่งชิ้น — บันทึกการประชุม บทสัมภาษณ์ หรือข้อความจากลูกค้า — แล้วแปลงเป็นข้อกำหนดที่สามารถอ้างอิงกลับไปยังประโยคต้นทางได้"
        />
      }
      action={
        <Link
          href="/workspace/projects/new"
          className="inline-flex min-h-11 items-center rounded-[var(--radius-card)] bg-accent px-4 text-sm font-semibold text-on-accent transition-colors hover:bg-accent-hover"
        >
          <T en="Create your first project" th="สร้างโปรเจกต์แรกของคุณ" />
        </Link>
      }
      // The zero-typing way in. Runs on the deterministic mock provider, always.
      secondary={<TryExampleButton />}
    />
  );
}
