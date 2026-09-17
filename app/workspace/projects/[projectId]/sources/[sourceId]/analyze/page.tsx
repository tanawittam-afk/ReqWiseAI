/**
 * Analyze an existing source — the re-run screen.
 *
 * Since the combined intake screen (`/workspace/projects/new`) creates a project, its
 * source and its first analysis in one submission, this page is no longer on the path
 * to a first result. It is where an *existing* source is analysed again — a later
 * revision, a retry after a failure, or a deliberate run on a different provider.
 * That is also why the provider choice still lives here and nowhere else: an
 * intentional re-run is exactly the moment the choice is worth making.
 *
 * Guards mirror the server action's own checks (archived project, missing source) so
 * a user is told the real reason before submitting, not after. The action re-checks
 * everything itself regardless — this page's guards are a courtesy, not the boundary.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/app/_components/icon";
import { T } from "@/app/_components/t";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/lib/projects/queries";
import { getSource } from "@/lib/sources/queries";
import { getDailyUsageToday } from "@/lib/analysis/daily-usage";
import { DAILY_ANALYSIS_LIMIT } from "@/lib/config/limits";
import {
  availableDefaultProvider,
  readServerEnvironment,
  toProviderOptions,
} from "@/lib/config/env";
import { AnalyzeConfirmForm } from "./confirm-form";

export const metadata = { title: "Analyze source — ReqWise AI" };

export default async function AnalyzeSourcePage({
  params,
}: {
  params: Promise<{ projectId: string; sourceId: string }>;
}) {
  const { projectId, sourceId } = await params;

  const supabase = await createClient();
  const [project, source, dailyUsage] = await Promise.all([
    getProject(supabase, projectId),
    getSource(supabase, projectId, sourceId),
    getDailyUsageToday(supabase, DAILY_ANALYSIS_LIMIT),
  ]);
  if (!project || !source) notFound();

  const base = `/workspace/projects/${projectId}/sources/${sourceId}`;

  if (project.status === "archived") {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-[var(--space-shell-x)] py-[var(--space-shell-y-tight)] sm:px-[var(--space-shell-x-lg)]">
        <Link
          href={base}
          className="inline-flex w-fit items-center gap-1 text-xs text-text-faint hover:text-text-muted"
        >
          <Icon name="arrow-left" size={13} /> <T en="Back to source" th="กลับไปที่เอกสารต้นฉบับ" />
        </Link>
        <p
          role="alert"
          className="rounded-[var(--radius-card)] border border-warn-border bg-warn-soft px-4 py-3 text-sm text-warn"
        >
          <T
            en="This project is archived and read-only. Restore it before running an analysis."
            th="โปรเจกต์นี้ถูกเก็บเข้าคลังแล้วและอ่านได้อย่างเดียว กู้คืนก่อนรันการวิเคราะห์"
          />
        </p>
      </main>
    );
  }

  const environment = readServerEnvironment();
  const providerOptions = toProviderOptions(environment);
  const defaultProvider = availableDefaultProvider(environment);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-[var(--space-shell-x)] py-[var(--space-shell-y-tight)] sm:px-[var(--space-shell-x-lg)]">
      <div className="flex flex-col gap-2">
        <Link
          href={base}
          className="inline-flex w-fit items-center gap-1 text-xs text-text-faint hover:text-text-muted"
        >
          <Icon name="arrow-left" size={13} /> <T en="Back to source" th="กลับไปที่เอกสารต้นฉบับ" />
        </Link>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">
          <T
            en={<>Analyze &ldquo;{source.title}&rdquo;</>}
            th={<>วิเคราะห์ &ldquo;{source.title}&rdquo;</>}
          />
        </h1>
        <p className="text-sm text-text-muted">
          <T
            en="Runs the analysis again on this source. Every run is kept — a new one never replaces an earlier one."
            th="รันการวิเคราะห์นี้อีกครั้งบนเอกสารต้นฉบับนี้ ทุกรอบจะถูกเก็บไว้ — รอบใหม่จะไม่แทนที่รอบก่อนหน้า"
          />
        </p>
      </div>

      <AnalyzeConfirmForm
        projectId={projectId}
        sourceId={sourceId}
        revisionNumber={source.revisionNumber}
        alreadyLocked={source.locked}
        providerOptions={providerOptions}
        defaultProvider={defaultProvider}
        dailyUsage={dailyUsage}
      />
    </main>
  );
}
