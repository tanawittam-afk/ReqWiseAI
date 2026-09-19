# Final Interface Direction — Three-Panel Requirements Workspace

**Status:** authoritative. The structural direction (§1, §3–8, §10–15) was supplied by the
owner on 2026-07-25 together with the rendered reference `preview-2.png` and held for the
"Requirements Intelligence Workspace" visual language. On 2026-08-02 the owner asked for a
whole-app "tech" visual redesign (dark-mode-first, light+dark toggle, hairline borders over
soft shadows) — shipped across 7 phases, `HANDOFF.md` has the commit-by-commit record. This
document now describes that shipped state: the three-panel **structure** below is unchanged
from 2026-07-25, but **§2's highlight-colour line and all of §9 (Visual Style) are rewritten**
to match what actually shipped, replacing the old off-white/indigo/violet direction.

**This supersedes** the earlier "dark graphite or deep navy foundation" wording that stood
in `CLAUDE.md` → *Design direction* before 2026-07-25, and the 2026-07-25 "off-white,
Apple-inspired productivity" visual language that stood here before 2026-08-02. Where this
file and `CLAUDE.md` disagree, this file wins; `CLAUDE.md` carries the condensed version and
points here.

**Reference image:** [`preview-2.png`](./preview-2.png) — Preview 2, the structural
reference the three-panel layout below was built from. Note that the render contains
elements the product still has no data for (per-group coverage percentages, sparklines,
notifications, a ⌘K command bar) **and shows the superseded off-white/indigo colour
scheme, not the shipped one.** Use it for panel proportions and layout only — for colour,
radius, and type, follow §9 below and `app/globals.css`. Those still-invented-metric
elements are not part of the direction and are not to be reproduced; see `ARCHITECTURE.md`
§A.4. **The one exception, shipped in Phase 2 of the 2026-09-17 "Usable Product" plan: a
real quality score**, on the analysis workspace's own Quality tab (not the render's
group-header placement) — a fixed, documented formula over real `quality_finding` data,
never a number the render merely implies exists.

---

Use Preview 2 as the final structural reference for the ReqWise AI application.

The final product must prioritize usability, information density, long-form reading, and analytical work over decorative visual effects.

The primary Analysis Workspace must use a stable three-panel layout:

1. Source Document
2. Requirements List
3. Requirement Inspector

This structure is the default desktop experience and the main visual identity of ReqWise AI.

---

### 1. Primary Desktop Layout

Use the following information architecture:

```text
Application Sidebar
│
├── Source Document Panel
├── Requirements Panel
└── Requirement Inspector
```

Recommended proportions on large desktop screens:

* Application sidebar: 220–260px
* Source document panel: approximately 28–32%
* Requirements panel: approximately 38–44%
* Inspector panel: approximately 28–32%

The Requirements panel should receive the largest flexible area because it is the primary working surface.

Panels may be resizable if implementation remains reliable and accessible.

Do not require panel resizing for basic use.

---

### 2. Source Document Panel

The left workspace panel displays the original source material.

It must support:

* Source title
* Revision number
* Lock status
* Source type
* Search within source
* Line or paragraph structure where useful
* Exact source highlighting
* Current highlighted excerpt count
* Previous and next highlight navigation
* Easy text selection and copying
* Preserved whitespace
* Long-line wrapping

When a requirement is selected, highlight its related source excerpt.

The highlight must:

* Use the signal accent (`--signal-soft` background, `--signal-border` outline — a green
  reserved for citation and liveness only, never a generic decoration; see §9)
* Preserve text readability
* Avoid excessive glow
* Scroll into view when practical
* Remain distinguishable in high-contrast conditions

Do not display decorative connecting lines permanently.

A subtle temporary relationship indicator may appear only when the selected requirement and source reference are both visible.

---

### 3. Requirements Panel

The center panel is the primary analysis workspace.

**Revised 2026-09-02** — originally "use a compact structured list rather than large
category cards." An owner audit found the flush, divider-separated row too easy to read
as one continuous block rather than distinct items ("มองยากมาก ไม่รู้อะไรเป็นอะไร ·
มีแต่ Text"). Each row is now a small **bordered card** — its own border, `--radius-card`
and a light-mode-only `shadow-[var(--shadow-card)]` — laid out with a gap between rows
instead of a hairline divider. The accepted trade-off: fewer rows fit on one screen than
the original flush list, in exchange for a row a reader can actually tell apart from its
neighbours. This is still a small card, not the "large category card" the original text
warned against — see the row anatomy below, unchanged in substance.

The panel should include:

* Requirements tab
* Issues or quality findings tab where available
* Search
* Filter
* Grouping
* View options
* Item count
* Requirement categories
* Compact requirement rows

Each requirement row should display:

* Display ID
* Requirement title
* Requirement type
* Priority
* Confidence
* Review status
* Short source excerpt or rationale
* Source-reference indicator
* Relationship indicator when applicable

The list must allow users to scan many requirements quickly.

Avoid oversized cards that show only a few requirements at once — the 2026-09-02 bordered
card is deliberately compact (padding in the 9–12px range, not a large card's 20px+) for
exactly this reason.

Selected requirement:

* Uses a clear left accent or border
* Has a slightly tinted background
* Does not rely on glow alone
* Remains readable in both pointer and touch interaction

---

### 4. Requirement Grouping

Allow grouping by:

* Requirement Type
* Source Order
* Review Status
* Priority

Default grouping:

`Requirement Type`

Groups may include:

* Problem Statements
* Business Objectives
* Stakeholders
* Business Requirements
* Functional Requirements
* Non-functional Requirements
* User Stories
* Acceptance Criteria
* Business Rules
* Assumptions
* Risks
* Constraints
* Open Questions
* Quality Findings

Groups should be collapsible.

Group headers should remain compact and may show:

* Item count
* Average confidence
* Review progress
* Source coverage

Do not use large illustrated category blocks as the default interface.

---

### 5. Requirement Inspector

The right panel displays detailed information for the selected item.

Use a stable inspector instead of opening a modal for normal review work.

The inspector should include:

* Requirement ID
* Requirement type
* Review status
* Priority
* Confidence
* Title
* Description
* Evidence class
* Origin
* Rationale
* Source references
* Related requirements
* Version information
* Review activity
* Notes when available

Organize information into compact sections or tabs such as:

* Details
* Evidence
* Relations
* History
* Notes

Important information must remain visible without excessive scrolling.

The inspector must be collapsible.

When collapsed, the Requirements panel should expand automatically.

---

### 6. Compact Analysis Summary

Use a compact summary area in the toolbar or directly above the workspace.

It may show:

* Analysis status
* Total requirements
* Open questions
* Risks
* Quality findings
* Source count

The summary must not become a large dashboard header.

Keep it to one compact row on desktop.

Do not place large KPI cards above the workspace if they reduce the vertical reading area.

---

### 7. Application Sidebar

Use a compact desktop-style sidebar.

**Every entry links to a route that exists.** This section previously listed nine
destinations and said that unbuilt ones should be *rendered disabled rather than
hidden*, so the shape of the finished product would be legible early. That convention
was retired in Phase 5 of the 2026-08-03 UX/UI plan, after an audit found seven of the
nine did nothing: a menu of dead entries stops describing a plan and starts describing a
broken application. If a destination is not built, it is not in the sidebar.

The five entries, in order:

* **Dashboard** — `/workspace/dashboard`. The post-sign-in destination. `/workspace`
  redirects here.
* **Projects** — `/workspace/projects`.
* **Requirements** — `/workspace/requirements`. Every item across every visible project.
* **Reviews** — `/workspace/reviews`. The outstanding-work queue.
* **Settings** — `/workspace/settings`. Read-only: account, provider configuration, and
  what each domain profile contributes.

Three entries from the old list are deliberately **absent**, not deferred:

* **Workspace** — it was a redirect wearing a menu entry. Dashboard is the destination.
* **Analysis Runs** — a run is reached through its project and its source, the only
  context in which "run 3 of 4" means anything. Requirements answers the cross-project
  question a global run list was standing in for.
* **Traceability** — per-project by design, at
  `/workspace/projects/:id/traceability`. A matrix spanning unrelated projects would
  draw lines between requirements that have nothing to do with each other.
* **Domain Profiles** — absorbed into Settings. A profile is data to read about, not a
  place to work.

The sidebar should:

* Support collapse
* Show clear current location — **exact-match by default.** An entry lights up on its
  own path only, unless it genuinely owns a subtree and says so
  (`lib/workspace/nav.ts` → `isActiveNav`). Projects is the one such entry: an analysis
  run, a source and an export are all reached through a project and have no entry of
  their own. A bare `startsWith` is the bug this rule replaced — it lit Projects up on
  every page in the application.
* Use icons with text labels
* Keep touch targets at least 44px
* Avoid deeply nested navigation
* Preserve the current project context — via the **project sub-nav**
  (`projects/[projectId]/_components/project-nav.tsx`): Overview · Sources ·
  Requirements · Traceability · Export, on the same active-state rule. Rendered by the
  project browsing pages rather than by a `layout.tsx`, so it never appears above the
  full-height analysis workspace or inside a printable export document.

Icons are plain geometry — never a copy of a macOS or Apple application icon.

---

### 8. Top Toolbar

Use a compact toolbar containing only contextual actions.

Possible actions:

* Breadcrumb
* Current project
* Analysis status
* Search
* Re-run analysis
* Export
* User account
* Inspector toggle

Avoid oversized website headers.

The toolbar should remain visually stable when switching between source, analysis, and review screens.

---

### 9. Visual Style

Use a precise, technical style — a "tech" workspace built for long review sessions, not a
cyberpunk marketing page. The reference point (`neoconda.com`, dark-mode-first, neon-green
accent, sharp geometric grid) was adapted, not copied: the geometric precision and hairline
structure carried over; the neon saturation and pure-black-only palette did not, because a
tool read for hours a day needs a light mode too and needs contrast that survives WCAG AA
in both directions.

Shipped in two mandatory modes, switchable at runtime — not a "prepared but unshipped"
placeholder. `data-theme` is set on `<html>` before first paint (an inline script in
`app/layout.tsx`, reading `localStorage` and falling back to `prefers-color-scheme` only on
a first visit), and the toggle in the sidebar/toolbar (`app/workspace/_components/
theme-toggle.tsx`) changes it at runtime. Every colour is a CSS custom property under
`:root` (light) and `[data-theme="dark"]` (dark) in `app/globals.css` — a component never
hardcodes a colour literal or reaches for Tailwind's `dark:` variant; both react to the same
attribute the toggle writes, or they silently stop following it (this broke once — see
`HANDOFF.md`, the `auth-form.tsx` incident).

Primary visual direction:

* Depth comes from hairline borders and background-shade shifts, **plus a soft shadow on
  resting cards and panels in light mode only** (`--shadow-card`/`--shadow-panel` in
  `app/globals.css`, added 2026-09-02 — see the revision note right below; both resolve to
  `none` under `[data-theme="dark"]`, where a shadow on a near-black ground is invisible
  and the surface/border step still does the separating)
* One saturated primary accent (`--accent`, electric blue) for interactive/selection state
* One separate accent (`--signal`, green) reserved exclusively for citation and liveness
  indicators — never a generic decoration, never interchangeable with `--accent`
* Soft per-item-type tints — `--tint-context`/`-requirement`/`-spec`/`-caveat` (added
  2026-09-02) — for the four content families a reviewer scans for (problem/objective/
  stakeholder · the three requirement kinds plus business rule · user story/acceptance
  criterion · assumption/constraint). Fourteen item types collapsed into four tints, not
  fourteen colours, to stay signal rather than noise; risk, open question and quality
  finding keep the existing `--warn`/`--danger` tokens because they are states needing
  attention, not a content category. Every tint is paired with the item type's own text
  label — never colour alone
* Controlled `--ok` / `--warn` / `--danger` status colours, always paired with a word, never
  colour alone
* Sharp, small corner radii — `--radius-card: 4px` for controls/inputs/buttons/badges,
  `--radius-panel: 6px` for panel/card containers — not Tailwind's default `rounded-lg`/
  `rounded-md`/`rounded-xl`
* Selection/active state is flat: `bg-accent-soft` background with `text-accent`/
  `border-accent-border`, plus the shared `--shadow-card` any resting card already carries
  — never an extra shadow or ring layered on top for selection alone
* Mono type (`font-mono`, JetBrains Mono) for anything that is data — display IDs
  (`BR-001`), counts, badges, breadcrumbs; a geometric display face (`font-display`, Space
  Grotesk) for headings and nav labels; Inter for body copy
* High information density without feeling crowded
* **Every interactive action is visibly framed, in three tiers** (added 2026-09-02):
  primary = filled `--accent`; secondary = `--surface` fill with a `--border-strong`
  border; tertiary/ghost = transparent with a hairline `--border` border. An owner audit
  found 13 actions rendered as bare underlined accent text and sidebar items with no frame
  at rest — both read as prose, not controls ("หาปุ่มไม่เจอ"). No tier is ever bare text.
  One shared definition: `app/_components/ui/action-styles.ts`, consumed by the client
  `Button` and the server-renderable `ActionLink`/`ActionAnchor`.

**Revised 2026-09-02 — the no-shadow rule.** Originally: *"depth comes from hairline
borders and background-shade shifts, never from a shadow around a resting panel,"* with
exactly two named transient-overlay exceptions (below). The owner reversed this after
finding the interface hard to parse at a glance ("มองยากมาก ไม่รู้อะไรเป็นอะไร"): a soft
shadow is what lets one card read as separate from the one behind it, faster than a
border alone does. The reversal is deliberately narrow — `--shadow-card`/`--shadow-panel`
are shallow (`0 1px 2–3px rgba(11,14,20,0.06)`), light-mode-only, and every resting
card/panel gets the *same* one token; this is still not the floating, deep-shadow "card
UI" look the original rule was written to rule out, and dark mode is untouched — it still
separates by hairline and surface-shade alone, exactly as originally specified.

Two exceptions from the original rule still carry a *deeper* box-shadow than the new
baseline, because both are transient overlays floating above the surrounding content
rather than panels resting in the layout: the inspector drawer at the `lg` breakpoint
(`analyses/[runId]/workspace.tsx`, dropped again at `xl` once it becomes a static grid
column) and the account-menu dropdown in `app/workspace/layout.tsx`. Every other surface
now uses at most the shallow `--shadow-card`/`--shadow-panel` baseline, in light mode only.

Avoid:

* Neon saturation as a resting-state colour — reserve high saturation for `--signal`
  citation moments only, not the whole palette
* Permanent glowing relationship lines
* Excessive glassmorphism
* Large gradients behind content
* Floating decorative orbs
* Oversized KPI cards or an invented metric to fill a layout (`--` see §6)
* Marketing-style hero sections **inside the app** — the public landing page at `/` sits
  outside the workspace shell and is a separate, already-established exception
* Chat bubbles as the primary interface
* A shadow anywhere in dark mode, or deeper than `--shadow-card`/`--shadow-panel` in light
  mode, outside the two named transient-overlay exceptions above
* An action rendered as bare underlined text with no border, at any of the three tiers
* A shadow around a panel that is not one of the two named exceptions above
* Tailwind's `dark:` variant on any component — theming goes through the `[data-theme]`
  tokens, never a parallel dark-mode class set

The interface should feel technical because of its precision, density, and interaction
quality, not because of decorative effects.

---

### 10. Motion and Feedback

Use subtle motion only for:

* Panel collapse and expansion
* Inspector opening
* Requirement selection
* Source highlight navigation
* Group expand and collapse
* Loading and completion states

Motion duration should generally remain between 120ms and 220ms.

Respect reduced-motion preferences.

Do not use:

* Continuous animation
* Pulsing glow
* Large bounce effects
* Long page transitions
* Decorative background movement

---

### 11. Tablet Landscape

On tablet landscape:

* Sidebar becomes collapsible
* Source and Requirements remain side by side
* Inspector opens as a right drawer
* Toolbar actions remain touch-friendly
* Requirement rows remain compact
* Critical actions must not rely on hover

Recommended default:

```text
Source Document | Requirements
                     +
             Inspector Drawer
```

---

### 12. Tablet Portrait

On tablet portrait, do not force all three panels onto the screen.

Use a segmented control:

* Source
* Requirements
* Inspector

Only one primary panel should be visible at a time.

Preserve the selected requirement while switching panels.

When moving from Requirements to Source:

* Keep the selected requirement
* Scroll to the related excerpt
* Highlight the correct source text

When moving to Inspector:

* Show the same selected requirement

---

### 13. Mobile

Mobile is supported but not the primary target.

Use:

* Stacked navigation
* Source / Requirements / Inspector tabs
* Full-width requirement rows
* Bottom sheet for filters
* Full-screen inspector where necessary

Do not shrink the desktop three-panel layout into an unreadable mobile view.

---

### 14. Implementation Reality

The design must be realistically implementable using:

* Next.js
* TypeScript
* Tailwind CSS
* CSS Grid
* Flexbox
* Existing project components

Do not introduce a heavy UI framework solely to reproduce the mockup.

Do not use Canvas, WebGL, or complex animation libraries for the primary workspace.

Prefer standard accessible HTML and CSS.

Use client-side JavaScript only where interaction requires it.

---

### 15. Final Design Acceptance Criteria

The Analysis Workspace is complete when:

* Source, Requirements, and Inspector have clear responsibilities
* Users can scan many requirements without excessive scrolling
* Selecting a requirement reveals its source evidence
* Source highlighting remains exact and readable
* Inspector details are available without opening a modal
* The interface works with mouse, keyboard, trackpad, and touch
* Tablet portrait uses a single-panel switcher
* No critical action depends only on hover
* The interface looks like a coherent, precise technical workspace
* Visual effects never distract from requirement analysis
* The implementation remains maintainable with standard web technologies

When a design decision conflicts with decoration, prioritize usability and readability.

---

## Implementation notes for this repository

Where the direction leaves room, these are the choices this codebase has already made.

| Direction | This repository |
|---|---|
| §1 proportions | CSS grid, ~30 / 42 / 28 at `xl`; no resizable dividers (§1 says resizing must not be required for basic use) |
| §2 highlight colour | `--signal-soft` / `--signal-border` — the cyan analytical accent, reserved for evidence and never for state |
| §3 review status | Read-only until slice 5. The row and inspector *display* status; nothing changes it yet |
| §4 group headers | Item count, average confidence, cited share. **No coverage percentage** — no such metric is defined |
| §5 tabs | Details · Evidence · Relations. History and Notes arrive with slice 5, when `item_versions` and `review_activities` first hold rows |
| §6 summary | Run status, items, open questions, risks, quality findings, source count. **Still no quality score here** — it moved to its own tab (see below), not the one-row summary, on purpose |
| §7 sidebar | Five entries, all of them working routes — Dashboard · Projects · Requirements · Reviews · Settings (`app/workspace/_components/sidebar.tsx`). The disabled-entry convention was retired in Phase 5; see §7 for what was cut and why. Active state is `isActiveNav` (`lib/workspace/nav.ts`), exact-match unless an entry declares `ownsSubtree` |
| §7 project sub-nav | `projects/[projectId]/_components/project-nav.tsx` — Overview · Sources · Requirements · Traceability · Export, rendered by the four project browsing pages rather than by a layout, so it never sits above the full-height analysis workspace or inside a printable export |
| §9 tokens | `--accent` (electric blue, interactive/selection), `--signal` (green, citation/liveness only), `--radius-card: 4px`, `--radius-panel: 6px`, `--border`/`--border-strong`, `--text`/`--text-muted`/`--text-faint` — all in `app/globals.css` under `:root` and `[data-theme="dark"]`; do not introduce a new colour literal or a Tailwind `dark:` class in a component |
| §10 motion | 120–220ms; `prefers-reduced-motion` is neutralised globally in `app/globals.css` |
| §13 mobile | Sidebar becomes a stacked nav behind a "Menu" button below `md` (768px), replacing the old horizontal-scroll strip (`app/workspace/_components/sidebar.tsx`, `id="workspace-nav-items"`); theme/lang toggles moved into its footer at full size. Touch targets are **44px until `lg`** (1024px), not `md` — a 768px tablet is touch-operated too — with density (36px) only from `lg` up, via the `min-h-11 lg:min-h-9` (or `size-11 lg:size-9`) pair applied consistently across every interactive control app-wide. Wide content (the traceability matrix `<table>`, export document tables) scrolls inside its own `overflow-x-auto`/`overflow-auto` container; the page body never scrolls sideways. The analysis workspace's `<lg` segmented control (Source/Requirements/Inspector) predates this phase and needed no rebuild — panes are hidden via CSS, not unmounted, so an in-progress edit survives switching |
| Icons (Phase 7) | Rollout is complete — every unicode glyph that stood in for an icon (sidebar collapse/menu, theme toggle, inspector close/verified marks, requirement-row citation/relation/pending/follow-up marks, badges, chips, search glyphs, citation prev/next chevrons, group expand/collapse chevrons, all "← Back" links, "↗ external" marks, traceability/confirm-form marks) now renders through `app/_components/icon.tsx`'s single `<Icon name="…">` mapping. What's left is deliberately not an icon: JSDoc-comment arrows, and the toolbar's "⌘K" — a textual keyboard-shortcut convention, not a UI icon |
| Spacing scale (Phase 7) | `app/globals.css`'s `--space-shell-*` tokens (same plain-custom-property convention as `--radius-*`), scoped to the outer page wrapper only — two tiers (a wide list/dashboard shell and a narrower single-column detail shell), not a general 1–12 ramp. Everything inside a page keeps using Tailwind's own spacing scale |
| Tab-pattern decision (Phase 7) | Every `aria-pressed` toggle group in the app (workspace panel switcher, inspector's own Details/Evidence/… strip, project/traceability filters and view switches) stays `aria-pressed`/`aria-current`, not `role="tablist"` — see the code comment at `workspace.tsx`'s `Segment` component for the full reasoning: a real tablist's roving-tabindex contract would only be honest below `lg`, where the same three views stop being mutually exclusive |
| Accessibility (Phase 7) | Skip link (`app/_components/skip-link.tsx`) targets `#main-content` everywhere — a `<div id="main-content">` in `app/workspace/layout.tsx` (pages under it already render their own `<main>`), a real `<main id="main-content">` in `app/page.tsx` and `app/demo/layout.tsx`. The `lg`-breakpoint inspector drawer (§9's shadow exception) carries `role="dialog"`/`aria-modal="true"` and an Escape handler only while it is actually rendered as that floating overlay (tracked via `useSyncExternalStore` + `matchMedia`, not a `useEffect`+`setState` pair) |
| Quality tab (Phase 2, 2026-09-17 plan) | A 4th workspace tab, `quality-panel.tsx`, additive to §5's Details·Evidence·Relations set — score (`qualityScore()`, `lib/analysis/workspace-view.ts`) + per-kind breakdown + the run's open findings, each linking back into the Findings tab. No single item maps to this tab (`tabForType()` stays exhaustive over the other three), so `?item=` deep links never target it. Coverage-gap lists ("discussed but not written", "weakly supported") are a stated placeholder — that machinery is Phase 3 |
| Output-language settings (Phase 2, 2026-09-17 plan) | The project overview page's inspector column (`app/workspace/projects/[projectId]/page.tsx`) gained a boxed `OutputLanguageControl` section, same visual contract as the existing `ArchiveControls` beside it — a select (Thai / English / Match source) plus an explicit Save button, disabled until the value actually changes. Read-only, with an explanatory line, on an archived project (the RPC would refuse it anyway). The static "Output" row this replaced in the Details `<dl>` is gone — the editable control is now the one place this value is shown |
| ERP-clarity pass (2026-09-02) | Owner-driven redesign after an audit found the app hard to parse. Shadows: `--shadow-card`/`--shadow-panel` in `app/globals.css`, light-mode only (`none` under `[data-theme="dark"]`) — §9's original no-shadow rule reversed, narrowly. Type tints: `--tint-context`/`-requirement`/`-spec`/`-caveat`, four families not fourteen colours, each measured against its own soft background before commit (5.22–9.44:1, all clearing WCAG AA). Actions: `app/_components/ui/action-styles.ts` is the one definition of the 3-tier button look, drawn on by `button.tsx` (client) and `action-link.tsx` (server-renderable `ActionLink`/`ActionAnchor`) — replaced 13 bare-text actions app-wide and the sidebar's rest-state (`app/workspace/_components/sidebar.tsx`). Requirement rows: §3's "compact rows, not cards" narrowed to "compact **bordered** cards" — `requirement-row.tsx` + `requirements-panel.tsx`'s list wrapper (gap-separated, not `divide-y`). `SectionHeader`/`Panel` primitives in `app/_components/ui/section-header.tsx` give every panel an icon+title header band; rolled out to `projects/[projectId]/page.tsx`'s `Row`/`Meta` first (a `divide-y` label/value list becoming individually bordered fields), the rest of the app to follow incrementally as later phases touch those files (§7's own "convert opportunistically" precedent) |
