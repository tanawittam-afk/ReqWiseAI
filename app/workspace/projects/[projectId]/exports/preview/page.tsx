/**
 * The full-width preview.
 *
 * The same `ExportDocument` the export screen embeds and the printable route renders, given
 * the whole width — for reading the document rather than deciding its scope. Kept as its own
 * route so the reading view is linkable and refresh-safe, with the scope in the URL exactly
 * as everywhere else.
 *
 * Same authorization as the export screen: RLS decides, `null` renders not-found, and an
 * archived project reads normally.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildExportPackage } from "@/lib/export/build";
import { loadExportInput } from "@/lib/export/load";
import { assessReadiness, READINESS_LABEL } from "@/lib/export/readiness";
import { needsVersionHistory, parseScope, scopeQuery } from "@/lib/export/url";
import { ExportDocument } from "../_components/document";

export const metadata = { title: "Export preview — ReqWise AI" };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value.join(",") : value;
}

export default async function ExportPreviewPage({
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

  const { scope } = parseScope({
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

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-soft bg-chrome px-4 py-2 sm:px-5">
        <Link
          href={`/workspace/projects/${projectId}/exports?${serialised}`}
          className="text-xs text-text-muted transition-colors hover:text-text"
        >
          ← Export scope
        </Link>
        <span className="text-xs text-text-faint">{READINESS_LABEL[readiness.level]}</span>
        <Link
          href={`/workspace/projects/${projectId}/exports/print?${serialised}`}
          target="_blank"
          rel="noopener"
          className="ml-auto text-xs font-medium text-accent underline underline-offset-2"
        >
          Printable version ↗
        </Link>
      </div>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6 sm:px-8 sm:py-8">
        <ExportDocument pkg={pkg} />
      </main>
    </div>
  );
}
