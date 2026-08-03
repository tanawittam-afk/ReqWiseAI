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
      className="min-h-9 rounded-[var(--radius-card)] border border-border-soft bg-surface px-2 text-xs font-medium text-text
                 transition-colors duration-150 hover:bg-surface-hover"
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
