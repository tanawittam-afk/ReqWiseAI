/** Skeleton for the project list — same rhythm as the real cards, so nothing jumps. */
export default function ProjectsLoading() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-[var(--space-shell-gap)] px-[var(--space-shell-x)] py-[var(--space-shell-y)] sm:px-[var(--space-shell-x-lg)] sm:py-[var(--space-shell-y-lg)]">
      <p className="sr-only" role="status">
        Loading projects
      </p>
      <div aria-hidden="true" className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-40 rounded-[var(--radius-card)] bg-surface" />
          <div className="h-4 w-28 rounded-[var(--radius-card)] bg-surface" />
        </div>
        <div className="h-10 w-56 rounded-[var(--radius-panel)] border border-border-soft bg-chrome" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[150px] rounded-[var(--radius-card)] border border-border-soft bg-surface"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
