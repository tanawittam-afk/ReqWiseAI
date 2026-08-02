"use client";

/**
 * The left panel: the source document, verbatim.
 *
 * The text is the evidence, so it is rendered exactly as stored — `white-space:
 * pre-wrap`, no normalisation, no re-wrapping of the underlying string — and every
 * highlight is addressed by the offsets that were validated against that same string
 * (HANDOFF.md → "Verbatim text"). The panel adds only ways to *look* at it: find in
 * document, and navigation between the selected requirement's citations.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import type { AnalysisItemView } from "@/lib/analysis/queries";
import {
  buildSourceSegments,
  computeHighlightRanges,
  findMatchRanges,
} from "@/lib/analysis/highlight";
import type { SourceDetail } from "@/lib/sources/types";
import { LockBadge, RevisionBadge, SourceKindBadge } from "@/app/workspace/_components/badges";
import { PanelHeader, PanelTitle } from "./panel";

export function SourcePanel({
  source,
  item,
  scrollSignal = 0,
  className = "",
}: {
  source: SourceDetail;
  item: AnalysisItemView | null;
  /**
   * Bumped when the panel becomes visible again on a single-panel screen. Switching
   * back to Source must re-run the scroll (INTERFACE §12), and neither the item nor
   * the highlight index has changed at that moment.
   */
  scrollSignal?: number;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const bodyRef = useRef<HTMLPreElement>(null);

  const citations = useMemo(() => computeHighlightRanges(item), [item]);
  const matches = useMemo(() => findMatchRanges(source.rawText, query), [source.rawText, query]);
  const segments = useMemo(
    () => buildSourceSegments(source.rawText, citations, matches),
    [source.rawText, citations, matches],
  );

  // A new requirement means a new set of citations; start again at the first one.
  // Adjusted during render rather than in an effect, so the panel never paints the
  // old index against the new item (react.dev — "You Might Not Need an Effect").
  const [lastItemId, setLastItemId] = useState(item?.id ?? null);
  if ((item?.id ?? null) !== lastItemId) {
    setLastItemId(item?.id ?? null);
    setActiveIndex(0);
  }

  // Bring the active citation into view — the whole point of selecting a requirement.
  useEffect(() => {
    if (citations.length === 0) return;
    const target = bodyRef.current?.querySelector<HTMLElement>("mark[data-active='true']");
    target?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [item?.id, activeIndex, citations.length, scrollSignal]);

  const step = (delta: number) => {
    if (citations.length === 0) return;
    setActiveIndex((current) => (current + delta + citations.length) % citations.length);
  };

  return (
    <section
      aria-label="Source document"
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden border-border-soft bg-surface ${className}`}
    >
      <PanelHeader>
        <div className="flex min-w-0 flex-col gap-1.5">
          <PanelTitle>{source.title}</PanelTitle>
          <div className="flex flex-wrap items-center gap-1.5">
            <RevisionBadge revision={source.revisionNumber} />
            <SourceKindBadge kind={source.kind} />
            <LockBadge locked={source.locked} />
          </div>
        </div>
      </PanelHeader>

      <div className="flex flex-wrap items-center gap-2 border-b border-border-soft px-4 py-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-card)] border border-border-soft bg-surface-muted px-2.5 focus-within:border-accent-border">
          <span aria-hidden="true" className="text-text-faint">
            ⌕
          </span>
          <span className="sr-only">Search in document</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search in document"
            className="min-h-9 w-full min-w-0 bg-transparent text-sm text-text outline-none placeholder:text-text-faint"
          />
        </label>
        {query.trim().length > 0 ? (
          <span className="text-xs tabular-nums text-text-faint">
            {matches.length} match{matches.length === 1 ? "" : "es"}
          </span>
        ) : null}
      </div>

      <pre
        ref={bodyRef}
        className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap break-words px-4 py-3.5
                   font-mono text-[13px] leading-[1.8] text-text selection:bg-accent-soft"
      >
        {segments.map((segment, index) => {
          if (segment.kind === "plain") return segment.text;
          const isActiveCitation =
            segment.kind === "citation" && segment.citationIndex === activeIndex;
          return (
            <mark
              key={index}
              data-active={isActiveCitation ? "true" : undefined}
              className={
                segment.kind === "citation"
                  ? isActiveCitation
                    ? "rounded-sm bg-signal-soft px-0.5 text-signal ring-1 ring-signal"
                    : "rounded-sm bg-signal-soft/60 px-0.5 text-signal ring-1 ring-signal-border"
                  : "rounded-sm bg-warn-soft px-0.5 text-warn"
              }
            >
              {segment.text}
            </mark>
          );
        })}
      </pre>

      <footer className="flex items-center gap-2 border-t border-border-soft px-4 py-2">
        <span className="text-xs text-text-muted">
          {citations.length === 0
            ? item
              ? // A domain-profile item is raised BECAUSE the source is silent. Saying
                // where it came from is the honest alternative to highlighting a
                // plausible-looking sentence (product spec §14).
                item.origin === "domain_profile"
                ? "Generated from domain guidance; no direct source evidence."
                : "No exact excerpt for this item"
              : "Nothing selected"
            : `Highlight ${activeIndex + 1} of ${citations.length}`}
        </span>
        <div className="ml-auto flex items-center gap-1">
          <NavButton label="Previous highlight" disabled={citations.length < 2} onClick={() => step(-1)}>
            ↑
          </NavButton>
          <NavButton label="Next highlight" disabled={citations.length < 2} onClick={() => step(1)}>
            ↓
          </NavButton>
        </div>
      </footer>
    </section>
  );
}

function NavButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="grid size-9 place-items-center rounded-[var(--radius-card)] border border-border-soft bg-surface text-text-muted
                 transition-colors duration-150 hover:bg-surface-hover hover:text-text
                 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-surface"
    >
      <span aria-hidden="true">{children}</span>
      <span className="sr-only">{label}</span>
    </button>
  );
}
