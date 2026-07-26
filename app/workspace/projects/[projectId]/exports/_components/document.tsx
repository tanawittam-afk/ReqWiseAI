/**
 * The document itself, rendered once and used twice: on screen in the preview, and on
 * paper via the printable route.
 *
 * One component rather than two, because a preview that can differ from the print output
 * is a preview nobody can trust. The *chrome* around it differs — the preview sits inside
 * the application, the printable page does not — but the document does not.
 *
 * Every status, priority and state appears as a **word**. Nothing here encodes meaning in
 * colour alone: the printed page may be photocopied in greyscale, and the same rule holds
 * on screen (CLAUDE.md → Accessibility).
 */

import type {
  ExportEvidence,
  ExportOpenQuestion,
  ExportPackage,
  ExportQualityFinding,
  ExportRelationRef,
  ExportRequirement,
} from "@/lib/contracts/export";
import { EXPORT_STATUS_SCOPE_LABEL } from "@/lib/contracts/export";
import { documentSections } from "@/lib/export/build";
import {
  confidencePercent,
  EVIDENCE_LABEL,
  FINDING_KIND_LABEL,
  labelFor,
  ORIGIN_LABEL,
  PRIORITY_LABEL,
  SOURCE_KIND_LABEL,
} from "@/lib/export/labels";
import { PRINT_BLOCK_CLASS, PRINT_SECTION_CLASS } from "@/lib/export/print";

function day(iso: string): string {
  return iso.slice(0, 10);
}

function Facts({ items }: { items: Array<[string, string]> }) {
  return (
    <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
      {items.map(([label, value]) => (
        <div key={label} className="flex gap-1.5">
          <dt className="text-text-faint">{label}</dt>
          <dd className="font-medium text-text">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Evidence({ evidence, notice }: { evidence: ExportEvidence[]; notice: string | null }) {
  if (evidence.length === 0) {
    return notice ? <p className="mt-3 text-[13px] italic text-text-muted">{notice}</p> : null;
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">
        Source evidence
      </p>
      {evidence.map((item, index) => (
        <figure key={`${item.sourceRevisionId}-${index}`} className="flex flex-col gap-1">
          <blockquote className="border-l-2 border-border-strong pl-3 text-sm leading-relaxed whitespace-pre-wrap text-text">
            {item.excerpt}
          </blockquote>
          <figcaption className="text-xs text-text-faint">
            {item.sourceTitle} · {labelFor(SOURCE_KIND_LABEL, item.sourceKind)} · revision{" "}
            {item.revisionNumber} ·{" "}
            {item.startOffset !== null && item.endOffset !== null
              ? `characters ${item.startOffset}–${item.endOffset}`
              : "no character span recorded"}
            {item.offsetVerified ? "" : " · span unverified"}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}

function Relations({ relations }: { relations: ExportRelationRef[] }) {
  if (relations.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">Relations</p>
      <ul className="mt-1 flex flex-col gap-0.5 text-[13px] text-text">
        {relations.map((relation, index) => (
          <li key={`${relation.type}-${relation.displayId}-${index}`}>
            {relation.phrase} <span className="font-mono">{relation.displayId}</span>
            {relation.legacy ? (
              <span className="ml-1 text-text-faint">(legacy relation)</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function Block({ children }: { children: React.ReactNode }) {
  return (
    <article className={`${PRINT_BLOCK_CLASS} border-t border-border-soft pt-4 first:border-t-0 first:pt-0`}>
      {children}
    </article>
  );
}

function RequirementBlock({
  item,
  includeConfidence,
}: {
  item: ExportRequirement;
  includeConfidence: boolean;
}) {
  const facts: Array<[string, string]> = [
    ["Type", item.typeLabel],
    ["Priority", labelFor(PRIORITY_LABEL, item.priority)],
    ["Status", item.statusLabel],
    ["Version", `${item.versionNo}${item.humanEdited ? " · human-edited" : ""}`],
    ["Evidence", labelFor(EVIDENCE_LABEL, item.evidenceClass)],
    ["Origin", labelFor(ORIGIN_LABEL, item.origin)],
  ];
  if (includeConfidence && item.confidence !== null) {
    facts.push(["Confidence", confidencePercent(item.confidence)]);
  }

  return (
    <Block>
      <h3 className="text-[15px] font-semibold text-text">
        <span className="font-mono text-text-muted">{item.displayId}</span> — {item.title}
      </h3>
      <Facts items={facts} />
      <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-text">{item.description}</p>
      {item.rationale ? (
        <p className="mt-2 text-[13px] leading-relaxed text-text-muted">
          <span className="font-medium">Why this was inferred: </span>
          {item.rationale}
        </p>
      ) : null}
      <Evidence evidence={item.sourceEvidence} notice={item.evidenceNotice} />
      <Relations relations={item.relations} />
      <p className="mt-3 text-xs text-text-faint">
        {item.review.lastActivity
          ? `Review: ${item.review.lastActivity.label} on ${day(item.review.lastActivity.at)} · ${item.review.activityCount} recorded ${item.review.activityCount === 1 ? "activity" : "activities"}`
          : "Review: no review activity recorded"}
      </p>
    </Block>
  );
}

function QuestionBlock({
  item,
  includeConfidence,
}: {
  item: ExportOpenQuestion;
  includeConfidence: boolean;
}) {
  const facts: Array<[string, string]> = [
    ["State", item.workflowStateLabel],
    ["Origin", labelFor(ORIGIN_LABEL, item.origin)],
  ];
  if (includeConfidence && item.confidence !== null) {
    facts.push(["Confidence", confidencePercent(item.confidence)]);
  }
  if (item.followUpOn) facts.push(["Follow up on", item.followUpOn]);

  const answerHeading =
    item.workflowState === "answered"
      ? "Answer"
      : item.workflowState === "deferred"
        ? "Deferred because"
        : item.workflowState === "not_applicable"
          ? "Not applicable because"
          : "Note";

  return (
    <Block>
      <h3 className="text-[15px] font-semibold text-text">
        <span className="font-mono text-text-muted">{item.displayId}</span> — {item.title}
      </h3>
      <Facts items={facts} />
      <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-text">{item.description}</p>
      {item.resolutionText ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">
            {answerHeading}
          </p>
          <blockquote className="mt-1 border-l-2 border-border-strong pl-3 text-sm leading-relaxed whitespace-pre-wrap text-text">
            {item.resolutionText}
          </blockquote>
          {item.resolvedAt ? (
            <p className="mt-1 text-xs text-text-faint">Recorded {day(item.resolvedAt)}</p>
          ) : null}
        </div>
      ) : null}
      <Evidence evidence={item.sourceEvidence} notice={item.evidenceNotice} />
      <Relations relations={item.relations} />
    </Block>
  );
}

function FindingBlock({
  item,
  includeConfidence,
}: {
  item: ExportQualityFinding;
  includeConfidence: boolean;
}) {
  const facts: Array<[string, string]> = [];
  if (item.findingKind) facts.push(["Finding", labelFor(FINDING_KIND_LABEL, item.findingKind)]);
  facts.push(["State", item.workflowStateLabel]);
  if (includeConfidence && item.confidence !== null) {
    facts.push(["Confidence", confidencePercent(item.confidence)]);
  }

  const heading =
    item.workflowState === "resolved"
      ? "Resolution"
      : item.workflowState === "dismissed"
        ? "Dismissed because"
        : "Note";

  return (
    <Block>
      <h3 className="text-[15px] font-semibold text-text">
        <span className="font-mono text-text-muted">{item.displayId}</span> — {item.title}
      </h3>
      <Facts items={facts} />
      <p className="mt-3 text-sm leading-relaxed whitespace-pre-wrap text-text">{item.description}</p>
      {item.resolutionText ? (
        <div className="mt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">{heading}</p>
          <blockquote className="mt-1 border-l-2 border-border-strong pl-3 text-sm leading-relaxed whitespace-pre-wrap text-text">
            {item.resolutionText}
          </blockquote>
          {item.resolvedAt ? (
            <p className="mt-1 text-xs text-text-faint">Recorded {day(item.resolvedAt)}</p>
          ) : null}
        </div>
      ) : null}
      <Evidence evidence={item.sourceEvidence} notice={item.evidenceNotice} />
      <Relations relations={item.relations} />
    </Block>
  );
}

/**
 * A table that must survive a narrow screen *and* a sheet of paper.
 *
 * `overflow-x-auto` keeps the page itself from scrolling sideways on a tablet; in print
 * the stylesheet drops the scroll container so nothing is clipped at the page edge.
 */
function Scroller({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 overflow-x-auto">{children}</div>;
}

const TH = "border-b border-border-strong px-2 py-1.5 text-left text-xs font-semibold text-text";
const TD = "border-b border-border-soft px-2 py-1.5 align-top text-[13px] text-text";

function Section({
  heading,
  children,
}: {
  heading: string;
  children: React.ReactNode;
}) {
  return (
    <section className={`${PRINT_SECTION_CLASS} flex flex-col gap-4`}>
      <h2 className="border-b border-border-strong pb-1 text-[17px] font-semibold text-text">
        {heading}
      </h2>
      {children}
    </section>
  );
}

export function ExportDocument({ pkg }: { pkg: ExportPackage }) {
  const sections = documentSections(pkg);
  const { project, scope } = pkg;

  return (
    <div className="flex flex-col gap-8">
      <header className={`${PRINT_SECTION_CLASS} flex flex-col gap-3`}>
        <h1 className="text-[24px] font-semibold tracking-[-0.01em] text-text">
          {project.name} — requirements
        </h1>

        {project.archived ? (
          <p
            role="status"
            className="rounded-md border border-warn-border bg-warn-soft px-3 py-2 text-[13px] text-warn"
          >
            {pkg.notices[0]}
          </p>
        ) : null}

        <dl className="grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2">
          {project.businessObjective ? (
            <Meta label="Business objective" value={project.businessObjective} />
          ) : null}
          {project.domain ? <Meta label="Domain profile" value={project.domain.name} /> : null}
          <Meta label="Output language" value={project.outputLang === "th" ? "Thai" : "English"} />
          <Meta label="Project status" value={project.archived ? "Archived (read-only)" : "Active"} />
          <Meta label="Export scope" value={EXPORT_STATUS_SCOPE_LABEL[scope.status]} />
          <Meta label="Generated at" value={pkg.generatedAt} />
          <Meta label="Source documents" value={String(project.counts.sources)} />
          <Meta label="Analysis runs" value={String(project.counts.analysisRuns)} />
          <Meta label="Requirements in this export" value={String(project.counts.requirements)} />
          <Meta label="Approved" value={String(project.counts.approvedRequirements)} />
          <Meta label="Outstanding questions" value={String(project.counts.openQuestions)} />
          <Meta
            label="Unresolved quality findings"
            value={String(project.counts.unresolvedQualityFindings)}
          />
          {project.knownStakeholders.length > 0 ? (
            <Meta label="Known stakeholders" value={project.knownStakeholders.join(" · ")} />
          ) : null}
          {project.archived && project.archiveReason ? (
            <Meta label="Archive reason" value={project.archiveReason} />
          ) : null}
        </dl>
      </header>

      {sections.map((section, index) => (
        <Section key={`${section.id}-${section.heading}-${index}`} heading={section.heading}>
          {section.kind === "requirements" ? (
            <div className="flex flex-col gap-5">
              {section.items.map((item) => (
                <RequirementBlock
                  key={item.displayId}
                  item={item}
                  includeConfidence={scope.includeConfidence}
                />
              ))}
            </div>
          ) : null}

          {section.kind === "questions" ? (
            <div className="flex flex-col gap-5">
              {section.items.map((item) => (
                <QuestionBlock
                  key={item.displayId}
                  item={item}
                  includeConfidence={scope.includeConfidence}
                />
              ))}
            </div>
          ) : null}

          {section.kind === "findings" ? (
            <div className="flex flex-col gap-5">
              {section.items.map((item) => (
                <FindingBlock
                  key={item.displayId}
                  item={item}
                  includeConfidence={scope.includeConfidence}
                />
              ))}
            </div>
          ) : null}

          {section.kind === "traceability" ? (
            pkg.relations.length === 0 ? (
              <p className="text-sm text-text-muted">
                No traceability relations are recorded for the items in this export.
              </p>
            ) : (
              <Scroller>
                <table className="w-full min-w-[560px] border-collapse">
                  <thead>
                    <tr>
                      <th className={TH}>From</th>
                      <th className={TH}>Relation</th>
                      <th className={TH}>To</th>
                      <th className={TH}>From status</th>
                      <th className={TH}>To status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pkg.relations.map((relation, index) => (
                      <tr key={`${relation.fromDisplayId}-${relation.type}-${relation.toDisplayId}-${index}`}>
                        <td className={`${TD} font-mono`}>{relation.fromDisplayId}</td>
                        <td className={TD}>
                          {relation.phrase}
                          {relation.legacy ? (
                            <span className="text-text-faint"> (legacy relation)</span>
                          ) : null}
                        </td>
                        <td className={`${TD} font-mono`}>{relation.toDisplayId}</td>
                        <td className={TD}>{relation.fromStatus}</td>
                        <td className={TD}>{relation.toStatus}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Scroller>
            )
          ) : null}

          {section.kind === "coverage" ? (
            <div className="flex flex-col gap-3">
              <p className="text-[13px] text-text-muted">
                Coverage is computed over the <strong>whole project</strong>, not over the
                exported scope.
              </p>
              <Scroller>
                <table className="w-full min-w-[360px] border-collapse">
                  <thead>
                    <tr>
                      <th className={TH}>Indicator</th>
                      <th className={TH}>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    <CoverageRow label="Total items" value={pkg.coverage.totals.items} />
                    <CoverageRow label="Linked items" value={pkg.coverage.totals.linked} />
                    <CoverageRow label="Orphan items" value={pkg.coverage.totals.orphans} />
                    <CoverageRow
                      label="Missing acceptance criteria"
                      value={pkg.coverage.totals.missingAcceptanceCriteria}
                    />
                    <CoverageRow
                      label="Items with source evidence"
                      value={pkg.coverage.totals.itemsWithSourceEvidence}
                    />
                    <CoverageRow
                      label="Approved requirements in this export"
                      value={pkg.coverage.totals.approvedRequirements}
                    />
                    <CoverageRow label="Open questions" value={pkg.coverage.totals.openQuestions} />
                    <CoverageRow
                      label="Unresolved quality findings"
                      value={pkg.coverage.totals.unresolvedQualityFindings}
                    />
                  </tbody>
                </table>
              </Scroller>

              {pkg.coverage.gaps.some((gap) => gap.displayIds.length > 0) ? (
                <div className="flex flex-col gap-2">
                  <p className="text-xs font-semibold uppercase tracking-wide text-text-faint">
                    Missing links and conflicts
                  </p>
                  <ul className="flex flex-col gap-2 text-[13px]">
                    {pkg.coverage.gaps
                      .filter((gap) => gap.displayIds.length > 0)
                      .map((gap) => (
                        <li key={gap.key}>
                          <span className="font-medium text-text">
                            {gap.label} ({gap.displayIds.length})
                          </span>
                          <span className="text-text-muted"> — {gap.meaning}</span>
                          <p className="font-mono text-xs text-text-faint">
                            {gap.displayIds.join(", ")}
                          </p>
                        </li>
                      ))}
                  </ul>
                </div>
              ) : null}

              <p className="text-[13px] italic text-text-muted">{pkg.coverage.disclaimer}</p>
            </div>
          ) : null}

          {section.kind === "sources" ? (
            <div className="flex flex-col gap-2">
              <Scroller>
                <table className="w-full min-w-[520px] border-collapse">
                  <thead>
                    <tr>
                      <th className={TH}>Document</th>
                      <th className={TH}>Type</th>
                      <th className={TH}>Revision</th>
                      <th className={TH}>Characters</th>
                      <th className={TH}>Locked</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pkg.sources.map((source) => (
                      <tr key={source.revisionId}>
                        <td className={TD}>{source.title}</td>
                        <td className={TD}>{labelFor(SOURCE_KIND_LABEL, source.kind)}</td>
                        <td className={TD}>{source.revisionNumber}</td>
                        <td className={TD}>{source.characterCount}</td>
                        <td className={TD}>{source.locked ? "Yes" : "No"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Scroller>
              <p className="text-[13px] italic text-text-muted">
                Source documents are quoted only where an item cites them. The full text is
                not reproduced here.
              </p>
            </div>
          ) : null}

          {section.kind === "versions" ? (
            <Scroller>
              <table className="w-full min-w-[520px] border-collapse">
                <thead>
                  <tr>
                    <th className={TH}>Item</th>
                    <th className={TH}>Version</th>
                    <th className={TH}>Snapshots</th>
                    <th className={TH}>Last changed</th>
                    <th className={TH}>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {pkg.versionSummary.map((row) => (
                    <tr key={row.displayId}>
                      <td className={`${TD} font-mono`}>{row.displayId}</td>
                      <td className={TD}>{row.versionNo}</td>
                      <td className={TD}>{row.versionCount}</td>
                      <td className={TD}>{row.lastChangedAt ? day(row.lastChangedAt) : "—"}</td>
                      <td className={TD}>{row.lastChangeReason ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Scroller>
          ) : null}

          {section.kind === "activity" ? (
            <Scroller>
              <table className="w-full min-w-[520px] border-collapse">
                <thead>
                  <tr>
                    <th className={TH}>Item</th>
                    <th className={TH}>Activity</th>
                    <th className={TH}>Date</th>
                    <th className={TH}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {pkg.reviewActivitySummary.map((row, index) => (
                    <tr key={`${row.displayId}-${row.at}-${index}`}>
                      <td className={`${TD} font-mono`}>{row.displayId}</td>
                      <td className={TD}>{row.label}</td>
                      <td className={TD}>{day(row.at)}</td>
                      <td className={TD}>{row.comment ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Scroller>
          ) : null}
        </Section>
      ))}
    </div>
  );
}

function CoverageRow({ label, value }: { label: string; value: number }) {
  return (
    <tr>
      <td className={TD}>{label}</td>
      <td className={TD}>{value}</td>
    </tr>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-text-faint">{label}</dt>
      <dd className="text-[13px] text-text">{value}</dd>
    </div>
  );
}
