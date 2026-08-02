import Link from "next/link";

/**
 * One page for "no such run", "not in this project" and "not yours". Distinguishing
 * them would confirm that another tenant's run exists.
 */
export default function AnalysisRunNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start gap-4 px-6 py-16">
      <h1 className="text-lg font-semibold text-text">Analysis not found</h1>
      <p className="max-w-md text-sm text-text-muted">
        This analysis run does not exist, or it is not part of this project.
      </p>
      <Link
        href="/workspace/projects"
        className="rounded-[var(--radius-card)] border border-border-soft px-3 py-1.5 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
      >
        Back to projects
      </Link>
    </main>
  );
}
