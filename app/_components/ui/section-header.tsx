/**
 * A panel's header band: icon, title, optional count, optional action.
 *
 * Extracted from the shape already repeated across the app — `exports/page.tsx`'s
 * "Download" heading, the analysis workspace's three panel headers
 * (`_components/panel.tsx`'s `PanelHeader`/`PanelTitle`), the source detail inspector's
 * "Details"/"Analysis history" sections — which all wrote the same uppercase-label row
 * by hand, with or without a background, with or without an icon.
 *
 * The tinted band is the point. The owner's complaint was that the app read as
 * undifferentiated text ("มีแต่ Text ไม่รู้อะไรเป็นอะไร"); a filled header with an icon
 * gives every panel a visible lid, so the eye can find where one group ends and the
 * next begins without reading a word.
 *
 * No `"use client"` — every consumer so far is a server component.
 */

import { Icon, type IconName } from "../icon";

export function SectionHeader({
  icon,
  title,
  count,
  action,
}: {
  icon?: IconName;
  /** Already-localized content — a `<T>` element, or a `pick()`ed string. */
  title: React.ReactNode;
  /** A bare number reads as data, so it renders in the mono face like every other count. */
  count?: number;
  /** Trailing control: an `ActionLink`, a `Button`, or a filter chip row. */
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border-soft bg-surface-muted px-4 py-2.5">
      {icon ? <Icon name={icon} size={15} className="shrink-0 text-text-muted" /> : null}
      <h2 className="font-display text-[13px] font-semibold text-text">{title}</h2>
      {typeof count === "number" ? (
        <span className="rounded-[var(--radius-card)] border border-border-soft bg-surface px-1.5 font-mono text-[11px] text-text-faint">
          {count}
        </span>
      ) : null}
      {action ? (
        <>
          <div className="grow" />
          {action}
        </>
      ) : null}
    </div>
  );
}

/**
 * The panel this header caps. `border` + `--radius-panel` + the light-mode-only
 * `--shadow-panel` in one place, so a screen never hand-writes the combination and
 * drifts from it.
 */
export function Panel({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`overflow-hidden rounded-[var(--radius-panel)] border border-border-soft bg-surface shadow-[var(--shadow-panel)] ${className}`}
    >
      {children}
    </section>
  );
}
