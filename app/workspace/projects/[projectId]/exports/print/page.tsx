/**
 * The printable document.
 *
 * Renders the same `ExportDocument` as the preview, wrapped in nothing but the document
 * itself: the toolbar above it is marked `screen-only`, and the print rules in
 * `app/globals.css` hide it along with the application shell, release the shell's
 * one-viewport height clamp so the document can flow onto many pages, and switch the
 * palette to black on white.
 *
 * No server-side PDF. The browser's own *Save as PDF* is the whole feature: it is already
 * installed, it honours the reader's paper size, and adding a headless-Chrome renderer to
 * produce the same bytes would be a build-time dependency for a button that already exists.
 * The `<title>` is what a browser proposes as the PDF's filename, so it carries the project
 * name and the date.
 *
 * A blocked readiness check renders the reasons instead of the document — the same rule the
 * download endpoint applies, because a printed page is the copy nobody can re-check later.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { buildExportPackage } from "@/lib/export/build";
import { loadExportInput } from "@/lib/export/load";
import { assessReadiness } from "@/lib/export/readiness";
import { printFooter } from "@/lib/export/print";
import { needsVersionHistory, parseScope, scopeQuery } from "@/lib/export/url";
import { ExportDocument } from "../_components/document";

type Params = Promise<{ projectId: string }>;
type Query = Promise<{
  preset?: string | string[];
  status?: string | string[];
  sections?: string | string[];
  confidence?: string | string[];
}>;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value.join(",") : value;
}

/**
 * The tab title, and therefore the filename a browser proposes in *Save as PDF*.
 *
 * Resolved from the project rather than hard-coded, and falling back to a generic title if
 * the project is not visible — a title is not a place to confirm that another tenant's
 * project exists.
 */
export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { projectId } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("projects").select("name").eq("id", projectId).maybeSingle();
  const name = (data as { name: string } | null)?.name;
  return { title: name ? `${name} — requirements` : "Export — ReqWise AI" };
}

export default async function ExportPrintPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Query;
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

  if (readiness.level === "cannot_export") {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-3 px-6 py-10">
        <h1 className="text-[20px] font-semibold text-text">This document cannot be produced</h1>
        <ul className="flex flex-col gap-2">
          {readiness.errors.map((issue) => (
            <li key={issue.key} className="text-sm leading-relaxed text-danger">
              {issue.message}
            </li>
          ))}
        </ul>
        <Link
          href={`/workspace/projects/${projectId}/exports?${serialised}`}
          className="w-fit text-sm font-medium text-accent underline underline-offset-2 screen-only"
        >
          ← Back to export scope
        </Link>
      </main>
    );
  }

  return (
    <>
      {/* Screen-only chrome. The print stylesheet removes it, along with the app shell. */}
      <div className="screen-only flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-soft bg-chrome px-4 py-2 sm:px-5">
        <Link
          href={`/workspace/projects/${projectId}/exports?${serialised}`}
          className="text-xs text-text-muted transition-colors hover:text-text"
        >
          ← Export scope
        </Link>
        <p className="text-xs text-text-faint">
          Use your browser&apos;s print dialog to print or save this as a PDF.
        </p>
      </div>

      <main className="mx-auto w-full max-w-[190mm] px-6 py-8 print:max-w-none print:px-0 print:py-0">
        <ExportDocument pkg={pkg} />

        {/* Provenance, on paper only: a printed page has no scope selector to check. */}
        <footer className="print-only mt-8 border-t border-border-strong pt-2 text-[10px] text-text-muted">
          {printFooter(pkg)}
        </footer>
      </main>
    </>
  );
}
