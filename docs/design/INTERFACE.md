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
elements the product has no data for (quality score, per-group coverage percentages,
sparklines, notifications, a ⌘K command bar) **and shows the superseded off-white/indigo
colour scheme, not the shipped one.** Use it for panel proportions and layout only — for
colour, radius, and type, follow §9 below and `app/globals.css`. The invented-metric
elements are not part of the direction and are not to be reproduced; see `ARCHITECTURE.md`
§A.4, where the quality-score panel is explicitly deferred.

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

Use a compact structured list rather than large category cards.

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

Avoid oversized cards that show only a few requirements at once.

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

Include:

* Workspace
* Dashboard
* Projects
* Analysis Runs
* Requirements
* Reviews
* Traceability
* Domain Profiles
* Settings

The sidebar should:

* Support collapse
* Show clear current location
* Use icons with text labels
* Keep touch targets at least 44px
* Avoid deeply nested navigation
* Preserve the current project context

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

* Depth comes from hairline borders and background-shade shifts, never from a shadow
  around a resting panel (`--border`, `--border-strong` on hover) — see the two named
  exceptions below
* One saturated primary accent (`--accent`, electric blue) for interactive/selection state
* One separate accent (`--signal`, green) reserved exclusively for citation and liveness
  indicators — never a generic decoration, never interchangeable with `--accent`
* Controlled `--ok` / `--warn` / `--danger` status colours, always paired with a word, never
  colour alone
* Sharp, small corner radii — `--radius-card: 4px` for controls/inputs/buttons/badges,
  `--radius-panel: 6px` for panel/card containers — not Tailwind's default `rounded-lg`/
  `rounded-md`/`rounded-xl`
* Selection/active state is flat: `bg-accent-soft` background with `text-accent`/
  `border-accent-border`, never a shadow or ring
* Mono type (`font-mono`, JetBrains Mono) for anything that is data — display IDs
  (`BR-001`), counts, badges, breadcrumbs; a geometric display face (`font-display`, Space
  Grotesk) for headings and nav labels; Inter for body copy
* High information density without feeling crowded

Two deliberate exceptions carry a real box-shadow, because both are transient overlays
floating above the surrounding content rather than panels resting in the layout: the
inspector drawer at the `lg` breakpoint (`analyses/[runId]/workspace.tsx`, dropped again at
`xl` once it becomes a static grid column) and the account-menu dropdown in
`app/workspace/layout.tsx`. No other surface in the application uses a shadow.

Avoid:

* Neon saturation as a resting-state colour — reserve high saturation for `--signal`
  citation moments only, not the whole palette
* Permanent glowing relationship lines
* Excessive glassmorphism
* Large gradients behind content
* Floating decorative orbs
* Oversized KPI cards or an invented metric to fill a layout (`--` see §6)
* Marketing-style hero sections
* Chat bubbles as the primary interface
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
| §6 summary | Run status, items, open questions, risks, quality findings, source count. **No quality score** |
| §7 sidebar | All nine entries present; unbuilt ones rendered disabled rather than hidden, the convention already in `app/workspace/_components/sidebar.tsx` |
| §9 tokens | `--accent` (electric blue, interactive/selection), `--signal` (green, citation/liveness only), `--radius-card: 4px`, `--radius-panel: 6px`, `--border`/`--border-strong`, `--text`/`--text-muted`/`--text-faint` — all in `app/globals.css` under `:root` and `[data-theme="dark"]`; do not introduce a new colour literal or a Tailwind `dark:` class in a component |
| §10 motion | 120–220ms; `prefers-reduced-motion` is neutralised globally in `app/globals.css` |
