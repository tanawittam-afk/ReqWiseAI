import { T } from "@/app/_components/t";

/** Skeleton for a document — a page-shaped block, not a spinner. */
export default function SourceLoading() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-[var(--space-shell-gap)] px-[var(--space-shell-x)] py-[var(--space-shell-y)] sm:px-[var(--space-shell-x-lg)] sm:py-[var(--space-shell-y-lg)]">
      <p className="sr-only" role="status">
        <T en="Loading source document" th="กำลังโหลดเอกสารต้นฉบับ" />
      </p>
      <div aria-hidden="true" className="flex flex-col gap-5">
        <div className="h-7 w-64 rounded-[var(--radius-card)] bg-surface" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
          <div className="h-[60vh] rounded-[var(--radius-panel)] border border-border-soft bg-surface" />
          <div className="h-56 rounded-[var(--radius-panel)] border border-border-soft bg-surface" />
        </div>
      </div>
    </main>
  );
}
