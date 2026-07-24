"use client";

/**
 * One form for both sign-in and sign-up — the fields differ, the mechanics do not.
 * State comes from the Server Action via `useActionState`; there is no client-side
 * auth logic to get wrong.
 */

import { useActionState } from "react";
import { emptyAuthState, type AuthState } from "./state";

type Props = {
  action: (state: AuthState, formData: FormData) => Promise<AuthState>;
  submitLabel: string;
  withDisplayName?: boolean;
  next?: string;
};

const fieldClass =
  "w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm outline-none " +
  "focus:border-black/40 dark:border-white/20 dark:bg-black/20 dark:focus:border-white/50";

export function AuthForm({ action, submitLabel, withDisplayName = false, next }: Props) {
  const [state, formAction, pending] = useActionState(action, emptyAuthState);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {withDisplayName ? (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">Display name</span>
          <input name="display_name" type="text" autoComplete="name" className={fieldClass} />
          <span className="text-xs opacity-60">Names your personal workspace.</span>
        </label>
      ) : null}

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Email</span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">Password</span>
        <input
          name="password"
          type="password"
          required
          minLength={8}
          autoComplete={withDisplayName ? "new-password" : "current-password"}
          className={fieldClass}
        />
      </label>

      {state.error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p role="status" className="text-sm text-emerald-700 dark:text-emerald-400">
          {state.notice}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background
                   transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {pending ? "Working…" : submitLabel}
      </button>
    </form>
  );
}
