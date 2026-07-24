/**
 * Add a source.
 *
 * The archived check happens here as well as in the service and the database. This one
 * exists so an archived project shows an explanation instead of a form that would be
 * refused on submit — a wasted paste of a long document is a real cost.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/lib/projects/queries";
import { SourceForm } from "../source-form";
import { createSourceAction } from "../actions";

export const metadata = { title: "Add source — ReqWise AI" };

export default async function NewSourcePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const supabase = await createClient();
  const project = await getProject(supabase, projectId);
  if (!project) notFound();

  if (project.status === "archived") {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start gap-4 px-6 py-16">
        <h1 className="text-lg font-semibold text-text">This project is archived</h1>
        <p className="max-w-md text-sm leading-relaxed text-text-muted">
          Archived projects are read-only. Restore {project.name} to add source documents
          to it again.
        </p>
        <Link
          href={`/workspace/projects/${projectId}`}
          className="inline-flex min-h-11 items-center rounded-lg border border-border-soft px-4 text-sm
                     text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
        >
          Back to the project
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6 sm:px-8 sm:py-8">
      <Link
        href={`/workspace/projects/${projectId}/sources`}
        className="w-fit text-xs text-text-faint transition-colors hover:text-text-muted"
      >
        ← Sources
      </Link>
      <SourceForm
        mode="create"
        projectId={projectId}
        revisionNumber={1}
        action={createSourceAction}
        cancelHref={`/workspace/projects/${projectId}/sources`}
      />
    </main>
  );
}
