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
        <h1 className="text-2xl font-semibold tracking-tight">ReqWise AI</h1>
        <p className="max-w-prose text-sm leading-relaxed opacity-75">
          Turns unstructured business input into validated, traceable, human-reviewable
          software requirements. Every requirement carries its evidence, and nothing is
          approved without a person.
        </p>
      </div>

      <div className="flex gap-3">
        {user ? (
          <Link
            href="/workspace"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background
                       transition-opacity hover:opacity-90"
          >
            Open workspace
          </Link>
        ) : (
          <>
            <Link
              href="/sign-in"
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background
                         transition-opacity hover:opacity-90"
            >
              Sign in
            </Link>
            <Link
              href="/sign-up"
              className="rounded-md border border-black/15 px-4 py-2 text-sm font-medium
                         transition-colors hover:bg-black/5 dark:border-white/20 dark:hover:bg-white/10"
            >
              Create an account
            </Link>
          </>
        )}
      </div>
    </main>
  );
}
