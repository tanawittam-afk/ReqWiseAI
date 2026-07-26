/**
 * The download endpoint — one handler for all six artefacts.
 *
 * Authorization is the same rule as every page under `/workspace`: the Supabase client is
 * built from the request's cookies, so RLS decides what exists. `loadExportInput` returns
 * `null` both for a project that is not there and for one belonging to somebody else, and
 * both answer **404** with no body that distinguishes them. There is no service-role
 * client in this file and there must never be one — this is the single endpoint that emits
 * a whole project as one file.
 *
 * A blocked readiness check answers **409**, not a partial file. A download that arrives
 * looking complete is a document somebody will act on; refusing is the safe direction.
 *
 * Nothing here writes. An export leaves no trace in the database, which is why the whole
 * feature needs no migration and why repeating a download changes nothing.
 */

import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { buildExportPackage } from "@/lib/export/build";
import {
  renderFindingsCsv,
  renderQuestionsCsv,
  renderRequirementsCsv,
  renderTraceabilityCsv,
} from "@/lib/export/csv";
import {
  exportContentType,
  exportFilename,
  isExportFormat,
  type ExportFormat,
} from "@/lib/export/filenames";
import { renderJson } from "@/lib/export/json";
import { loadExportInput } from "@/lib/export/load";
import { renderMarkdown } from "@/lib/export/markdown";
import { assessReadiness } from "@/lib/export/readiness";
import { needsVersionHistory, parseScope } from "@/lib/export/url";
import type { ExportPackage } from "@/lib/contracts/export";

function render(format: ExportFormat, pkg: ExportPackage): string {
  switch (format) {
    case "markdown":
      return renderMarkdown(pkg);
    case "json":
      return renderJson(pkg);
    case "requirements-csv":
      return renderRequirementsCsv(pkg);
    case "questions-csv":
      return renderQuestionsCsv(pkg);
    case "findings-csv":
      return renderFindingsCsv(pkg);
    case "traceability-csv":
      return renderTraceabilityCsv(pkg);
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; format: string }> },
) {
  const { projectId, format } = await params;
  if (!isExportFormat(format)) notFound();

  const url = new URL(request.url);
  const { scope } = parseScope({
    preset: url.searchParams.get("preset") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    sections: url.searchParams.get("sections") ?? undefined,
    confidence: url.searchParams.get("confidence") ?? undefined,
  });

  const supabase = await createClient();
  const input = await loadExportInput(supabase, projectId, {
    includeVersionHistory: needsVersionHistory(scope),
  });
  if (!input) notFound();

  const pkg = buildExportPackage(input, scope, new Date().toISOString());
  const readiness = assessReadiness(input, pkg);

  if (readiness.level === "cannot_export") {
    // The keys, not the prose and not the affected text: a 409 body ends up in logs and
    // in bug reports, and neither is a place for source material.
    return Response.json(
      {
        error: "export_not_ready",
        reasons: readiness.errors.map((issue) => issue.key),
      },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }

  const body = render(format, pkg);
  const filename = exportFilename(pkg.project.slug, format);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": exportContentType(format),
      // The slug is ascii by construction (`lib/export/filenames.ts`), so a plain
      // `filename=` is unambiguous and no RFC 5987 encoding is needed.
      "Content-Disposition": `attachment; filename="${filename}"`,
      // A requirements document is private. `no-store` keeps it out of shared caches and
      // out of the browser's disk cache; `nosniff` stops a CSV being re-interpreted as
      // something executable.
      "Cache-Control": "no-store, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
      // Nothing here is meant to be framed or embedded by another origin.
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  });
}
