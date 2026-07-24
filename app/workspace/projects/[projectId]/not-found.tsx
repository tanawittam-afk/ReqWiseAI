import Link from "next/link";

/**
 * One page for "no such project" and "not yours". Saying anything more precise would
 * confirm the existence of another tenant's project.
 */
export default function ProjectNotFound() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-start gap-4 px-6 py-16">
      <h1 className="text-lg font-semibold text-text">Project not found</h1>
      <p className="max-w-md text-sm text-text-muted">
        This project does not exist, or it is not part of your workspace.
      </p>
      <Link
        href="/workspace/projects"
        className="rounded-md border border-border-soft px-3 py-1.5 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
      >
        Back to projects
      </Link>
    </main>
  );
}
