/**
 * Which navigation entry is current.
 *
 * Pure and DB-free so the rule is testable without rendering a client component — and
 * this rule earned a test. The old one was `pathname.startsWith(item.href)`, which lit
 * **Projects** up on every page in the application below `/workspace/projects`,
 * including every analysis workspace, source and export screen, while the entry the
 * reader was actually under looked inactive.
 *
 * The default is now an exact match. An entry that genuinely owns a subtree opts in
 * with `ownsSubtree`, and the prefix test appends a `/` so `/workspace/projects` can
 * never claim a sibling like `/workspace/projects-archive`.
 */

export type NavTarget = {
  href: string;
  /** Other paths that count as this entry, matched **exactly** — never as prefixes. */
  aliases?: readonly string[];
  /** True when every path below `href` belongs to this entry. */
  ownsSubtree?: boolean;
};

export function isActiveNav(pathname: string, target: NavTarget): boolean {
  if (pathname === target.href) return true;
  if (target.aliases?.includes(pathname)) return true;
  return target.ownsSubtree === true && pathname.startsWith(`${target.href}/`);
}
