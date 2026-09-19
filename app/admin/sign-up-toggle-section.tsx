"use client";

/**
 * The sign-up on/off switch (Phase 1, Slice 4). A client island for the same reason
 * `GeminiKeySection` is one: `useActionState` needs a client component.
 *
 * `enabled` comes from the server page's own `sign_up_is_enabled()` read — the fresh
 * value after a toggle arrives by `revalidatePath` re-rendering the parent server page,
 * not by this component tracking its own copy. The submit button's hidden `enabled`
 * field is always the OPPOSITE of the current value, computed here on every render —
 * "toggle" needs no client-side state of its own to know what it means.
 */

import { useActionState } from "react";
import { T } from "@/app/_components/t";
import { Notice } from "@/app/_components/ui/notice";
import { SubmitButton } from "@/app/_components/ui/button";
import { toggleSignUpAction } from "./actions";
import { emptyToggleSignUpFormState } from "./form-state";

export function SignUpToggleSection({ enabled }: { enabled: boolean }) {
  const [state, formAction, pending] = useActionState(toggleSignUpAction, emptyToggleSignUpFormState);

  return (
    <section aria-labelledby="sign-up-toggle-heading" className="flex flex-col gap-3">
      <h2 id="sign-up-toggle-heading" className="text-sm font-semibold text-text">
        <T en="Sign-up" th="การสมัครสมาชิก" />
      </h2>

      <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-panel)] border border-border-soft bg-surface p-4">
        <span
          role="status"
          className={`rounded-[var(--radius-card)] border px-1.5 py-0.5 text-[11px] font-medium ${
            enabled
              ? "border-ok-border bg-ok-soft text-ok"
              : "border-danger-border bg-danger-soft text-danger"
          }`}
        >
          {enabled ? <T en="Open" th="เปิดรับสมัคร" /> : <T en="Closed" th="ปิดรับสมัคร" />}
        </span>
        <p className="text-sm text-text-muted">
          {enabled ? (
            <T
              en="Anyone can currently create an account."
              th="ตอนนี้ใครก็สามารถสร้างบัญชีได้"
            />
          ) : (
            <T
              en="New sign-ups are blocked. Existing accounts are unaffected."
              th="การสมัครสมาชิกใหม่ถูกปิดกั้น บัญชีเดิมไม่ได้รับผลกระทบ"
            />
          )}
        </p>

        <form action={formAction} aria-busy={pending} className="ml-auto">
          <input type="hidden" name="enabled" value={enabled ? "false" : "true"} />
          <SubmitButton variant={enabled ? "danger" : "primary"} pendingLabel="Working…">
            {enabled ? (
              <T en="Close sign-ups" th="ปิดการสมัครสมาชิก" />
            ) : (
              <T en="Open sign-ups" th="เปิดการสมัครสมาชิก" />
            )}
          </SubmitButton>
        </form>
      </div>

      {state.error ? <Notice tone="danger">{state.error}</Notice> : null}
      {state.success ? <Notice tone="success">{state.success}</Notice> : null}
    </section>
  );
}
