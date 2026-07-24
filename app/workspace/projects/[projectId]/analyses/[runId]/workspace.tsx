"use client";

/**
 * The analysis result workspace — the product's signature split view (AGENTS.md
 * "Design direction"): source on the left, structured requirements on the right,
 * selecting one highlights the exact span of the other it came from.
 *
 * Desktop keeps both panes side by side always. Below the `lg` breakpoint there is
 * exactly one primary pane at a time, switched with a segmented control — a portrait
 * tablet does not have room to show a full document and a full requirements list at
 * once without both becoming unreadable strips.
 */

import { useMemo, useRef, useState } from "react";
import type { AnalysisRunDetail, AnalysisItemView } from "@/lib/analysis/queries";
import { computeHighlightRanges } from "@/lib/analysis/highlight";
import type { SourceDetail } from "@/lib/sources/types";
import { ITEM_TYPES, type ItemType } from "@/lib/contracts/item-types";

const TYPE_LABEL: Record<ItemType, string> = {
  problem_statement: "Problem statement",
  business_objective: "Business objective",
  stakeholder: "Stakeholder",
  business_requirement: "Business requirement",
  functional_requirement: "Functional requirement",
  non_functional_requirement: "Non-functional requirement",
  user_story: "User story",
  acceptance_criterion: "Acceptance criterion",
  business_rule: "Business rule",
  assumption: "Assumption",
  risk: "Risk",
  constraint: "Constraint",
  open_question: "Open question",
  quality_finding: "Quality finding",
};

const EVIDENCE_LABEL: Record<string, string> = {
  stated: "Stated",
  inferred: "Inferred",
  assumed: "Assumed",
};

export function AnalysisWorkspace({
  source,
  run,
}: {
  source: SourceDetail;
  run: AnalysisRunDetail;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(run.items[0]?.id ?? null);
  const [pane, setPane] = useState<"source" | "requirements">("requirements");
  const sourceRef = useRef<HTMLPreElement>(null);

  const selected = run.items.find((item) => item.id === selectedId) ?? null;

  const grouped = useMemo(() => {
    const byType = new Map<ItemType, AnalysisItemView[]>();
    for (const type of ITEM_TYPES) byType.set(type, []);
    for (const item of run.items) byType.get(item.type)?.push(item);
    return ITEM_TYPES.map((type) => ({ type, items: byType.get(type) ?? [] })).filter(
      (group) => group.items.length > 0,
    );
  }, [run.items]);

  function selectItem(id: string) {
    setSelectedId(id);
    setPane("source");
    requestAnimationFrame(() => {
      const el = sourceRef.current?.querySelector<HTMLElement>("mark[data-active='true']");
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <SummaryBar run={run} />

      {/* Segmented switcher — hidden at lg and up, where both panes show together */}
      <div className="mx-auto flex w-full max-w-[1400px] gap-1 px-4 pt-3 sm:px-8 lg:hidden">
        <SegmentButton active={pane === "source"} onClick={() => setPane("source")}>
          Source
        </SegmentButton>
        <SegmentButton active={pane === "requirements"} onClick={() => setPane("requirements")}>
          Requirements
        </SegmentButton>
      </div>

      <div className="mx-auto grid w-full max-w-[1400px] flex-1 gap-4 px-4 py-4 sm:px-8 lg:grid-cols-2 lg:items-start">
        <section
          className={`${pane === "source" ? "flex" : "hidden"} flex-col rounded-[var(--radius-panel)]
                      border border-border-soft bg-surface lg:flex lg:sticky lg:top-20 lg:max-h-[calc(100vh-11rem)]`}
        >
          <h2 className="border-b border-border-soft px-5 py-3 text-sm font-semibold text-text">
            {source.title}
          </h2>
          <pre
            ref={sourceRef}
            className="overflow-auto whitespace-pre-wrap break-words px-5 py-4 font-mono text-[13.5px]
                       leading-[1.75] text-text selection:bg-accent-soft"
          >
            <SourceWithHighlight text={source.rawText} item={selected} />
          </pre>
        </section>

        <section className={`${pane === "requirements" ? "flex" : "hidden"} flex-col gap-3 lg:flex`}>
          {grouped.map((group) => (
            <div key={group.type} className="flex flex-col gap-2">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-text-faint">
                {TYPE_LABEL[group.type]}{" "}
                <span className="font-mono normal-case text-text-faint">({group.items.length})</span>
              </h3>
              <ul className="flex flex-col gap-2">
                {group.items.map((item) => (
                  <li key={item.id}>
                    <ItemCard item={item} active={item.id === selectedId} onSelect={() => selectItem(item.id)} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}

function SummaryBar({ run }: { run: AnalysisRunDetail }) {
  const entries = Object.entries(run.summary.byType) as Array<[ItemType, number]>;
  return (
    <div className="border-y border-border-soft bg-surface-muted">
      <div className="mx-auto flex w-full max-w-[1400px] flex-wrap gap-x-4 gap-y-1.5 px-4 py-2.5 sm:px-8">
        <span className="text-xs font-medium text-text">
          {run.summary.itemCount} item{run.summary.itemCount === 1 ? "" : "s"}
        </span>
        {entries.map(([type, count]) => (
          <span key={type} className="text-xs text-text-faint">
            {TYPE_LABEL[type]}: <span className="font-medium text-text-muted">{count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function ItemCard({
  item,
  active,
  onSelect,
}: {
  item: AnalysisItemView;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`flex w-full min-h-11 flex-col gap-1.5 rounded-[var(--radius-card)] border px-4 py-3 text-left
                  transition-colors ${
                    active
                      ? "border-accent-border bg-accent-soft"
                      : "border-border-soft bg-surface hover:border-accent-border hover:bg-accent-soft/40"
                  }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] font-medium text-text-faint">{item.displayId}</span>
        <EvidenceBadge evidenceClass={item.evidenceClass} confidence={item.confidence} />
      </div>
      <p className="text-sm font-medium text-text">{item.title}</p>
      {item.relatedDisplayIds.length > 0 ? (
        <p className="text-[11px] text-text-faint">
          Related: {item.relatedDisplayIds.join(", ")}
        </p>
      ) : null}
    </button>
  );
}

function EvidenceBadge({ evidenceClass, confidence }: { evidenceClass: string; confidence: number }) {
  const tone =
    evidenceClass === "stated"
      ? "border-ok-border bg-ok-soft text-ok"
      : evidenceClass === "inferred"
        ? "border-signal-border bg-signal-soft text-signal"
        : "border-warn-border bg-warn-soft text-warn";
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${tone}`}>
      {EVIDENCE_LABEL[evidenceClass] ?? evidenceClass} · {Math.round(confidence * 100)}%
    </span>
  );
}

function SegmentButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`min-h-11 flex-1 rounded-lg border px-4 text-sm font-medium transition-colors ${
        active
          ? "border-accent-border bg-accent-soft text-accent"
          : "border-border-soft bg-surface text-text-muted hover:bg-surface-hover"
      }`}
    >
      {children}
    </button>
  );
}

function SourceWithHighlight({ text, item }: { text: string; item: AnalysisItemView | null }) {
  const ranges = computeHighlightRanges(item);

  if (ranges.length === 0) return <>{text}</>;

  const nodes: React.ReactNode[] = [];
  let cursor = 0;
  ranges.forEach(([start, end], index) => {
    if (start < cursor) return; // overlapping references: skip rather than mis-render
    nodes.push(text.slice(cursor, start));
    nodes.push(
      <mark
        key={index}
        data-active="true"
        className="rounded-sm bg-signal-soft px-0.5 text-signal ring-1 ring-signal-border"
      >
        {text.slice(start, end)}
      </mark>,
    );
    cursor = end;
  });
  nodes.push(text.slice(cursor));

  return <>{nodes}</>;
}
