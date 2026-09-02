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
import { actionClass, type ActionSize, type ActionVariant } from "./action-styles";

type Variant = ActionVariant;

export function Button({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: ActionSize;
}) {
  return (
    <button
      type={props.type ?? "button"}
      {...props}
      className={actionClass(variant, size, className)}
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
