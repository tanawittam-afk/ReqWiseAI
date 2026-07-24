/** Skeleton for the source list — same rhythm as the real cards, so nothing jumps. */
export default function SourcesLoading() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-8">
      <p className="sr-only" role="status">
        Loading sources
      </p>
      <div aria-hidden="true" className="flex flex-col gap-6">
        <div className="flex flex-col gap-2">
          <div className="h-7 w-32 rounded-md bg-surface" />
          <div className="h-4 w-44 rounded-md bg-surface" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-[168px] rounded-[var(--radius-card)] border border-border-soft bg-surface"
            />
          ))}
        </div>
      </div>
    </main>
  );
}
