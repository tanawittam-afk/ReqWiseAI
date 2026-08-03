import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col justify-center gap-6 p-6">
      <div className="flex flex-col gap-3">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-text">ReqWise AI</h1>
        <p className="max-w-prose text-sm leading-relaxed text-text-muted">
          Turns unstructured business input into validated, traceable, human-reviewable
          software requirements. Every requirement carries its evidence, and nothing is
          approved without a person.
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        {/*
         * "See the demo" is the primary action regardless of session state — it is
         * the fastest way for anyone (a returning user or a first-time visitor) to
         * see the product actually work, no sign-up required. This page gets a full
         * introduction of its own in Phase 3 of the 2026-08-03 UX/UI plan; this is
         * the minimum needed to make the Phase 2 demo reachable the day it ships.
         */}
        <Link
          href="/demo"
          className="min-h-11 rounded-[var(--radius-card)] bg-accent px-4 py-2 text-sm font-medium text-on-accent
                     transition-colors hover:bg-accent-hover"
        >
          See the demo
        </Link>
        {user ? (
          <Link
            href="/workspace"
            className="min-h-11 rounded-[var(--radius-card)] border border-border-soft px-4 py-2 text-sm font-medium
                       text-text transition-colors hover:bg-surface-hover"
          >
            Open workspace
          </Link>
        ) : (
          <>
            <Link
              href="/sign-in"
              className="min-h-11 rounded-[var(--radius-card)] border border-border-soft px-4 py-2 text-sm font-medium
                         text-text transition-colors hover:bg-surface-hover"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="min-h-11 rounded-[var(--radius-card)] border border-border-soft px-4 py-2 text-sm font-medium
                         text-text transition-colors hover:bg-surface-hover"
            >
              Create an account
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
