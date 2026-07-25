/**
 * The two pieces every workspace panel shares.
 *
 * Kept here so the three panels line up to the pixel: one header height, one title
 * size, one border. Depth in this application comes from borders and background
 * shifts, never from a shadow around every panel (docs/design/INTERFACE.md §9).
 */

export function PanelHeader({ children }: { children: React.ReactNode }) {
  return (
    <header className="flex min-h-[52px] items-center gap-2 border-b border-border-soft px-4 py-2.5">
      {children}
    </header>
  );
}

export function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="truncate text-sm font-semibold tracking-[-0.005em] text-text">{children}</h2>
  );
}

/** A label above a block of detail. Small, quiet, and never competing with its value. */
export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <dt className="text-[11px] font-medium uppercase tracking-[0.04em] text-text-faint">
      {children}
    </dt>
  );
}

export function FieldValue({ children }: { children: React.ReactNode }) {
  return <dd className="text-sm leading-relaxed text-text">{children}</dd>;
}
