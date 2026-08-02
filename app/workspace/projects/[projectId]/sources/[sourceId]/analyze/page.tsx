/**
 * Analyze confirmation — the gate before a source revision is locked.
 *
 * Guards mirror the server action's own checks (archived project, missing source) so
 * a user is told the real reason before submitting, not after. The action re-checks
 * everything itself regardless — this page's guards are a courtesy, not the boundary.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/lib/projects/queries";
import { getSource } from "@/lib/sources/queries";
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
  const [project, source] = await Promise.all([
    getProject(supabase, projectId),
    getSource(supabase, projectId, sourceId),
  ]);
  if (!project || !source) notFound();

  const base = `/workspace/projects/${projectId}/sources/${sourceId}`;

  if (project.status === "archived") {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 py-8 sm:px-8">
        <Link href={base} className="w-fit text-xs text-text-faint hover:text-text-muted">
          ← Back to source
        </Link>
        <p
          role="alert"
          className="rounded-[var(--radius-card)] border border-warn-border bg-warn-soft px-4 py-3 text-sm text-warn"
        >
          This project is archived and read-only. Restore it before running an analysis.
        </p>
      </main>
    );
  }

  const environment = readServerEnvironment();
  const providerOptions = toProviderOptions(environment);
  const defaultProvider = availableDefaultProvider(environment);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 px-4 py-8 sm:px-8">
      <div className="flex flex-col gap-2">
        <Link href={base} className="w-fit text-xs text-text-faint hover:text-text-muted">
          ← Back to source
        </Link>
        <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-text">
          Analyze &ldquo;{source.title}&rdquo;
        </h1>
      </div>

      <AnalyzeConfirmForm
        projectId={projectId}
        sourceId={sourceId}
        revisionNumber={source.revisionNumber}
        alreadyLocked={source.locked}
        providerOptions={providerOptions}
        defaultProvider={defaultProvider}
      />
    </main>
  );
}
