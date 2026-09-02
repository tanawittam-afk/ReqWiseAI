/**
 * A link that reads as a button.
 *
 * Replaces the bare `text-accent underline` anchors an audit found doing a button's job
 * in 13 places ("View all 12", "Back to source", "Open full-width preview", …). No
 * `"use client"`: these sit on server-rendered pages, and the styles come from
 * `action-styles.ts` precisely so importing them costs no client bundle.
 *
 * `Link` is Next's, so prefetching and client-side navigation behave exactly as before —
 * this changes how the action looks, never how it works.
 */

import Link from "next/link";
import type { ComponentProps } from "react";
import { actionClass, type ActionSize, type ActionVariant } from "./action-styles";

export function ActionLink({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: ActionVariant; size?: ActionSize }) {
  return <Link {...props} className={actionClass(variant, size, className)} />;
}

/**
 * The same treatment for a real anchor — downloads and `target="_blank"` links, which
 * `next/link` has no reason to own.
 */
export function ActionAnchor({
  variant = "secondary",
  size = "md",
  className = "",
  ...props
}: React.AnchorHTMLAttributes<HTMLAnchorElement> & {
  variant?: ActionVariant;
  size?: ActionSize;
}) {
  return <a {...props} className={actionClass(variant, size, className)} />;
}
