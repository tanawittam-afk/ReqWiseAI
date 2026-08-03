"use client";

/**
 * Extracted from `analyses/[runId]/_components/review-actions.tsx`'s local
 * `ConfirmButton` (primary/danger, submit-only, `useFormStatus`-driven) and the
 * secondary/ghost button classes repeated across that file and
 * `item-edit-form.tsx`. `Button` covers the plain case; `SubmitButton` adds the
 * pending-state wiring for a `<form action={...}>` button, exactly as `ConfirmButton`
 * did, generalized to any variant instead of only primary/danger.
 */

import { useFormStatus } from "react-dom";

const VARIANT_CLASS: Record<"primary" | "secondary" | "danger" | "ghost", string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover",
  secondary: "border border-border-soft bg-surface text-text transition-colors hover:bg-surface-hover",
  danger: "border border-danger-border bg-danger-soft text-danger hover:border-danger",
  ghost: "text-text-muted transition-colors hover:text-text",
};

type Variant = keyof typeof VARIANT_CLASS;

export function Button({
  variant = "secondary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type={props.type ?? "button"}
      {...props}
      className={`min-h-11 rounded-[var(--radius-card)] px-3.5 text-[13px] font-medium transition-colors duration-150
                  disabled:cursor-not-allowed disabled:opacity-60 ${VARIANT_CLASS[variant]} ${className}`}
    />
  );
}

/** A submit button inside a `<form action={...}>` that shows its own pending state. */
export function SubmitButton({
  variant = "primary",
  pendingLabel = "Working…",
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; pendingLabel?: string }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} aria-busy={pending} {...props}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
