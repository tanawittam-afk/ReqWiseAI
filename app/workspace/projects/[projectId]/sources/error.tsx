"use client";

/**
 * The database-error state for everything under /sources. The thrown error is logged,
 * never rendered — a Postgres message carries table and policy names that are nobody's
 * business on screen.
 */

import { useEffect } from "react";

export default function SourcesError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[sources] render failed", error.digest ?? "");
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-start gap-4 px-6 py-16">
      <h1 className="text-lg font-semibold text-text">Sources could not be loaded</h1>
      <p className="max-w-md text-sm text-text-muted">
        Something went wrong reading this project&rsquo;s documents. Nothing was changed —
        this is a display problem, not a data one.
      </p>
      <button
        type="button"
        onClick={reset}
        className="rounded-md border border-border-soft px-3 py-1.5 text-sm text-text-muted transition-colors hover:bg-surface-hover hover:text-text"
      >
        Try again
      </button>
    </main>
  );
}
