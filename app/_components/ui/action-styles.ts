/**
 * The one definition of what an action looks like, shared by `Button` (a client
 * component, because it wires `useFormStatus`) and `ActionLink` (which must stay
 * server-renderable — most of the actions this replaces are plain `<Link>`s on server
 * pages, and importing them from a `"use client"` module would drag those pages into
 * the client bundle for nothing).
 *
 * Deliberately not a component library: it is a string map, so a call site that needs
 * one extra utility class can still append one.
 */

export type ActionVariant = "primary" | "secondary" | "danger" | "ghost";

/**
 * Three visible tiers, plus `danger`. Every tier carries a border — including `ghost`,
 * which used to be bare underlined text. An audit found 13 accent-coloured text links
 * doing a button's job across the app, and the owner's first complaint was
 * "หาปุ่มไม่เจอ". A ghost action is quieter than a secondary one; it is never invisible.
 *
 * `--shadow-card` resolves to `none` under `[data-theme="dark"]`, so no variant needs a
 * dark-mode branch of its own.
 */
export const ACTION_VARIANT: Record<ActionVariant, string> = {
  primary:
    "border border-accent bg-accent text-on-accent shadow-[var(--shadow-card)] hover:bg-accent-hover hover:border-accent-hover",
  secondary:
    "border border-border-strong bg-surface text-text shadow-[var(--shadow-card)] hover:bg-surface-hover",
  danger: "border border-danger-border bg-danger-soft text-danger hover:border-danger",
  ghost: "border border-border-soft bg-transparent text-text-muted hover:bg-surface-hover hover:text-text",
};

/**
 * Two sizes only. `md` is the standard 44px touch target the mobile phase established
 * (`min-h-11 lg:min-h-9` — full size until a pointer is likely); `sm` is for actions
 * that sit inside a panel header, where 44px would break the header's own rhythm and a
 * neighbouring control already carries the touch target.
 */
export const ACTION_SIZE = {
  md: "min-h-11 px-3.5 text-[13px] lg:min-h-9",
  sm: "min-h-9 px-2.5 text-xs lg:min-h-8",
} as const;

export type ActionSize = keyof typeof ACTION_SIZE;

export function actionClass(
  variant: ActionVariant = "secondary",
  size: ActionSize = "md",
  extra = "",
): string {
  return `inline-flex items-center justify-center gap-1.5 rounded-[var(--radius-card)]
          font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60
          ${ACTION_SIZE[size]} ${ACTION_VARIANT[variant]} ${extra}`;
}
