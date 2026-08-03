import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  ClipboardList,
  ExternalLink,
  FolderOpen,
  Home,
  Languages,
  LayoutDashboard,
  ListChecks,
  Network,
  Plus,
  Quote,
  Search,
  Settings,
  Sparkles,
  TriangleAlert,
  UserCheck,
  X,
  type LucideIcon,
} from "lucide-react";

/**
 * One mapping from semantic name to icon, so every call site references a name — never
 * a `lucide-react` import directly — and a future icon-set swap stays a one-file change.
 *
 * Kept to what the app actually needs, grown as later phases touch call sites (the plan's
 * trap #11: do not mass-migrate). Names loosely follow the nine sidebar destinations
 * (docs/design/INTERFACE.md §7) plus the toolbar's search/command-palette placeholders.
 */
const ICONS = {
  workspace: Home,
  dashboard: LayoutDashboard,
  projects: FolderOpen,
  requirements: ListChecks,
  reviews: CircleCheck,
  traceability: Network,
  domain: Network,
  settings: Settings,
  search: Search,
  close: X,
  "chevron-right": ChevronRight,
  "chevron-down": ChevronDown,
  check: Check,
  warning: TriangleAlert,
  external: ExternalLink,
  language: Languages,
  plus: Plus,
  "arrow-right": ArrowRight,
  paste: ClipboardList,
  analyze: Sparkles,
  review: UserCheck,
  quote: Quote,
} as const satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof ICONS;

/**
 * Plain geometry, `stroke-width` 1.5 to sit quietly next to text at this app's sizes —
 * never a copy of a macOS or Apple application icon (INTERFACE.md §7). `aria-hidden` by
 * default: an icon paired with a visible label (the app's convention — status is never
 * colour- or glyph-only) carries no accessible name of its own. Pass `label` for the
 * rare icon-only control.
 */
export function Icon({
  name,
  size = 18,
  className,
  label,
}: {
  name: IconName;
  size?: number;
  className?: string;
  label?: string;
}) {
  const Component = ICONS[name];
  return (
    <Component
      size={size}
      strokeWidth={1.5}
      className={className}
      aria-hidden={label ? undefined : "true"}
      aria-label={label}
    />
  );
}
