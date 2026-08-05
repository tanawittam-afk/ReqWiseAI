"use client";

/**
 * Extracted from `analyses/[runId]/_components/requirements-panel.tsx`, the only place
 * a facet/group selector existed before this pass. `FacetSelect` adds the "All" option
 * and the label every facet filter in that panel repeats.
 */
export function Select({
  value,
  onChange,
  children,
}: {
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      // 44px until `lg` — a facet filter is tapped as often as anything on the screen,
      // and a 36px select is a miss on a phone or a tablet. The dense toolbar row this
      // was built for only exists from `lg` up.
      className="min-h-11 rounded-[var(--radius-card)] border border-border-soft bg-surface px-2 text-xs font-medium text-text
                 transition-colors duration-150 hover:bg-surface-hover lg:min-h-9"
    >
      {children}
    </select>
  );
}

export function FacetSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center gap-1.5 text-xs text-text-faint">
      <span>{label}</span>
      <Select value={value} onChange={onChange}>
        <option value="all">All</option>
        {children}
      </Select>
    </label>
  );
}
