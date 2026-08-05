/**
 * Edit a source — or supersede it.
 *
 * One route, two outcomes, and the page does not choose between them: it reads the
 * lock from the database and renders what is actually true right now. The action
 * re-reads it at submit time for the same reason, so a revision locked in the seconds
 * between render and save becomes a new revision rather than a refused edit or, worse,
 * an overwrite.
 *
 * A locked revision's text is used to seed the form. That is the point — a revision is
 * usually a correction of the previous one, not a blank page.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/app/_components/icon";
import { createClient } from "@/lib/supabase/server";
import { getProject } from "@/lib/projects/queries";
import { getSource } from "@/lib/sources/queries";
import { SourceForm } from "../../source-form";
import { saveSourceAction } from "../../actions";

export const metadata = { title: "Edit source — ReqWise AI" };

export default async function EditSourcePage({
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

  const detail = `/workspace/projects/${projectId}/sources/${sourceId}`;

  if (project.status === "archived") {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start gap-4 px-6 py-16">
        <h1 className="text-lg font-semibold text-text">This project is archived</h1>
        <p className="max-w-md text-sm leading-relaxed text-text-muted">
          Archived projects are read-only. Restore {project.name} to edit its source
          documents.
        </p>
        <Link
          href={detail}
          className="inline-flex min-h-11 items-center rounded-[var(--radius-card)] border border-border-soft px-4 text-sm
                     text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
        >
          Back to the document
        </Link>
      </main>
    );
  }

  // A revision that already has a successor is history: editing it would fork the
  // chain, and the unique (document_key, revision_number) index would refuse anyway.
  if (source.supersededById) {
    return (
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start gap-4 px-6 py-16">
        <h1 className="text-lg font-semibold text-text">
          Revision {source.revisionNumber} has been superseded
        </h1>
        <p className="max-w-md text-sm leading-relaxed text-text-muted">
          A newer revision of this document already exists. Edit that one instead — this
          revision stays as it was cited.
        </p>
        <Link
          href={`/workspace/projects/${projectId}/sources/${source.supersededById}`}
          className="inline-flex min-h-11 items-center rounded-[var(--radius-card)] bg-accent px-4 text-sm font-semibold
                     text-on-accent transition-colors hover:bg-accent-hover"
        >
          Open revision {source.supersededByRevision}
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 px-4 py-6 sm:px-8 sm:py-8">
      <Link
        href={detail}
        className="inline-flex min-h-11 w-fit items-center gap-1 text-xs text-text-faint transition-colors hover:text-text-muted lg:min-h-0"
      >
        <Icon name="arrow-left" size={13} /> {source.title}
      </Link>
      <SourceForm
        mode={source.locked ? "revise" : "edit"}
        projectId={projectId}
        sourceId={source.id}
        revisionNumber={source.locked ? source.revisionNumber + 1 : source.revisionNumber}
        initial={{
          title: source.title,
          kind: source.kind,
          rawText: source.rawText,
          sourceDate: source.metadata.sourceDate ?? "",
          stakeholder: source.metadata.stakeholder ?? "",
          notes: source.metadata.notes ?? "",
        }}
        action={saveSourceAction}
        cancelHref={detail}
      />
    </main>
  );
}
