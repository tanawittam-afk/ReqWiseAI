# Final Interface Direction — Three-Panel Requirements Workspace

**Status:** authoritative. Supplied by the owner on 2026-07-25 together with the rendered
reference `preview-2.png`, and reproduced here verbatim.

**This supersedes** the earlier "dark graphite or deep navy foundation" wording that stood
in `CLAUDE.md` → *Design direction* until 2026-07-25. Where the two disagree, this file
wins; `CLAUDE.md` now carries the condensed version and points here.

**Reference image:** [`preview-2.png`](./preview-2.png) — Preview 2, the final structural
reference. Note that the render contains elements the product has no data for (quality
score, per-group coverage percentages, sparklines, notifications, a ⌘K command bar). They
are **not** part of the direction and are not to be reproduced by inventing a metric; see
`ARCHITECTURE.md` §A.4, where the quality-score panel is explicitly deferred.

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

* Use a subtle violet or blue background
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

Do not copy macOS Finder or Apple application icons directly.

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

Use a modern, premium, Apple-inspired productivity style without directly copying macOS or iPadOS.

Primary visual direction:

* Soft off-white application background
* White or lightly tinted workspace panels
* Subtle cool-gray borders
* Light violet selection surfaces
* Indigo or violet primary accent
* Cyan secondary analytical accent
* Controlled green, amber, and red status colors
* Soft shadows used sparingly
* Restrained corner radii
* Clear typography hierarchy
* High information density without feeling crowded

Avoid:

* Heavy dark dashboard styling
* Neon visual effects
* Permanent glowing relationship lines
* Excessive glassmorphism
* Large gradients behind content
* Floating decorative orbs
* Oversized KPI cards
* Marketing-style hero sections
* Chat bubbles as the primary interface
* Strong shadows around every panel

The interface should feel futuristic because of its interaction quality and information architecture, not because of excessive visual effects.

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
* The interface looks like a coherent productivity application
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
| §9 tokens | Already defined in `app/globals.css` — do not introduce new colour literals in components |
| §10 motion | 120–220ms; `prefers-reduced-motion` is neutralised globally in `app/globals.css` |
