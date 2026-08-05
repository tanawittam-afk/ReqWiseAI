"use client";

/**
 * One form for both sign-in and sign-up — the fields differ, the mechanics do not.
 * State comes from the Server Action via `useActionState`; there is no client-side
 * auth logic to get wrong.
 */

import { useActionState } from "react";
import { emptyAuthState, type AuthState } from "./state";
import { T } from "../_components/t";
import { useLocale, pick } from "@/lib/i18n";

type Props = {
  action: (state: AuthState, formData: FormData) => Promise<AuthState>;
  /** Which submit copy to show — kept as a small enum (not a free string) so both languages
   * always exist together instead of the caller supplying an English-only label. */
  submitLabel: "sign-in" | "create-account";
  withDisplayName?: boolean;
  next?: string;
};

const SUBMIT_LABEL: Record<Props["submitLabel"], { en: string; th: string }> = {
  "sign-in": { en: "Sign in", th: "เข้าสู่ระบบ" },
  "create-account": { en: "Create account", th: "สร้างบัญชี" },
};

const fieldClass =
  "w-full rounded-[var(--radius-card)] border border-border-soft bg-surface px-3 py-2 text-sm text-text outline-none " +
  "transition-colors hover:border-border-strong focus:border-accent";

export function AuthForm({ action, submitLabel, withDisplayName = false, next }: Props) {
  const [state, formAction, pending] = useActionState(action, emptyAuthState);
  const locale = useLocale();

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {next ? <input type="hidden" name="next" value={next} /> : null}

      {withDisplayName ? (
        <label className="flex flex-col gap-1.5 text-sm">
          <span className="font-medium">
            <T en="Display name" th="ชื่อที่แสดง" />
          </span>
          <input
            name="display_name"
            type="text"
            autoComplete="name"
            className={fieldClass}
            placeholder={pick(locale, "Display name", "ชื่อที่แสดง")}
          />
          <span className="text-xs text-text-faint">
            <T en="Names your personal workspace." th="ใช้ตั้งชื่อพื้นที่ทำงานส่วนตัวของคุณ" />
          </span>
        </label>
      ) : null}

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">
          <T en="Email" th="อีเมล" />
        </span>
        <input
          name="email"
          type="email"
          required
          autoComplete="email"
          className={fieldClass}
        />
      </label>

      <label className="flex flex-col gap-1.5 text-sm">
        <span className="font-medium">
          <T en="Password" th="รหัสผ่าน" />
        </span>
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
        <p role="alert" className="text-sm text-danger">
          {state.error}
        </p>
      ) : null}
      {state.notice ? (
        <p role="status" className="text-sm text-ok">
          {state.notice}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="min-h-11 rounded-[var(--radius-card)] bg-accent px-4 text-sm font-medium text-on-accent
                   transition-colors hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending
          ? pick(locale, "Working…", "กำลังดำเนินการ…")
          : pick(locale, SUBMIT_LABEL[submitLabel].en, SUBMIT_LABEL[submitLabel].th)}
      </button>
    </form>
  );
}
