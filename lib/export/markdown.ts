/**
 * The Markdown document.
 *
 * Pure `ExportPackage → string`. No database, no clock, no React.
 *
 * Two things Markdown makes easy to get wrong, both handled here:
 *
 *  * **Requirement text is data, not markup.** A requirement whose description begins
 *    `# Cancellation` must not become a heading, and one containing ``` must not open a
 *    code fence that swallows the rest of the document. `escapeBlock` neutralises the
 *    line-leading constructs and nothing else — it does not escape every special
 *    character, because a requirement written with *emphasis* on purpose should keep it.
 *  * **The excerpt is a quotation.** It renders as a blockquote, prefixing every line,
 *    so a multi-line Thai excerpt stays inside the quote instead of half-escaping into
 *    the surrounding text.
 *
 * Section order comes from `documentSections()`, shared with the printable page, so the
 * two documents can never disagree.
 */

import {
  ARCHIVED_NOTICE,
  EXPORT_STATUS_SCOPE_LABEL,
  type ExportEvidence,
  type ExportOpenQuestion,
  type ExportPackage,
  type ExportQualityFinding,
  type ExportRelationRef,
  type ExportRequirement,
} from "../contracts/export.ts";
import { documentSections, type DocumentSection } from "./build.ts";
import {
  confidencePercent,
  EVIDENCE_LABEL,
  FINDING_KIND_LABEL,
  labelFor,
  ORIGIN_LABEL,
  PRIORITY_LABEL,
  SOURCE_KIND_LABEL,
} from "./labels.ts";

/** Above this many items a reader needs a table of contents more than they need brevity. */
const TOC_THRESHOLD = 10;

/**
 * Neutralises constructs that would change the document's *structure*.
 *
 * Line-leading `#`, `>`, `-`, `*`, `+`, `|`, a digit followed by `.`, and any run of
 * three or more backticks or tildes. Inline emphasis is left alone on purpose.
 */
export function escapeBlock(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) =>
      line
        .replace(/^(\s*)(#{1,6})(\s)/, "$1\\$2$3")
        .replace(/^(\s*)([>|])/, "$1\\$2")
        .replace(/^(\s*)([-*+])(\s)/, "$1\\$2$3")
        .replace(/^(\s*)(\d+)\.(\s)/, "$1$2\\.$3")
        .replace(/^(\s*)(`{3,}|~{3,})/, "$1\\$2"),
    )
    .join("\n");
}

/** A single-line cell: newlines would break the row it sits in. */
function inline(text: string): string {
  return text.replace(/\s*\r?\n\s*/g, " ").replace(/\|/g, "\\|").trim();
}

function blockquote(text: string): string {
  return text
    .split(/\r?\n/)
    .map((line) => `> ${line}`)
    .join("\n");
}

function anchor(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9฀-๿\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function evidenceBlock(evidence: ExportEvidence[], notice: string | null): string[] {
  const lines: string[] = [];

  if (evidence.length > 0) {
    lines.push("", "**Source evidence**");
    for (const item of evidence) {
      lines.push("", blockquote(item.excerpt));
      const where =
        item.startOffset !== null && item.endOffset !== null
          ? `characters ${item.startOffset}–${item.endOffset}`
          : "no character span recorded";
      const verified = item.offsetVerified ? "" : ", span unverified";
      lines.push(
        "",
        `Source: ${inline(item.sourceTitle)}, ${labelFor(SOURCE_KIND_LABEL, item.sourceKind).toLowerCase()}, revision ${item.revisionNumber}, ${where}${verified}`,
      );
    }
  } else if (notice) {
    lines.push("", `*${notice}*`);
  }

  return lines;
}

function relationBlock(relations: ExportRelationRef[]): string[] {
  if (relations.length === 0) return [];
  const lines = ["", "**Relations**", ""];
  for (const relation of relations) {
    const legacy = relation.legacy ? " *(legacy relation)*" : "";
    lines.push(`- ${relation.phrase} ${relation.displayId}${legacy}`);
  }
  return lines;
}

function requirementBlock(item: ExportRequirement, includeConfidence: boolean): string[] {
  const lines: string[] = ["", `### ${item.displayId} — ${inline(item.title)}`, ""];

  const facts = [
    `- **Type:** ${item.typeLabel}`,
    `- **Priority:** ${labelFor(PRIORITY_LABEL, item.priority)}`,
    `- **Status:** ${item.statusLabel}`,
    `- **Version:** ${item.versionNo}${item.humanEdited ? " (human-edited)" : ""}`,
    `- **Evidence:** ${labelFor(EVIDENCE_LABEL, item.evidenceClass)}`,
    `- **Origin:** ${labelFor(ORIGIN_LABEL, item.origin)}`,
  ];
  if (includeConfidence && item.confidence !== null) {
    facts.push(`- **Confidence:** ${confidencePercent(item.confidence)}`);
  }
  lines.push(...facts);

  lines.push("", escapeBlock(item.description));

  if (item.rationale) {
    lines.push("", `**Why this was inferred:** ${inline(item.rationale)}`);
  }

  lines.push(...evidenceBlock(item.sourceEvidence, item.evidenceNotice));
  lines.push(...relationBlock(item.relations));

  if (item.review.lastActivity) {
    lines.push(
      "",
      `**Review:** ${item.review.lastActivity.label} on ${formatDate(item.review.lastActivity.at)} · ${item.review.activityCount} recorded ${item.review.activityCount === 1 ? "activity" : "activities"}`,
    );
  } else {
    lines.push("", "**Review:** no review activity recorded");
  }

  return lines;
}

function questionBlock(item: ExportOpenQuestion, includeConfidence: boolean): string[] {
  const lines: string[] = ["", `### ${item.displayId} — ${inline(item.title)}`, ""];
  lines.push(`- **State:** ${item.workflowStateLabel}`);
  lines.push(`- **Origin:** ${labelFor(ORIGIN_LABEL, item.origin)}`);
  if (includeConfidence && item.confidence !== null) {
    lines.push(`- **Confidence:** ${confidencePercent(item.confidence)}`);
  }
  if (item.followUpOn) lines.push(`- **Follow up on:** ${item.followUpOn}`);

  lines.push("", escapeBlock(item.description));

  if (item.resolutionText) {
    // The stakeholder's own words, quoted and labelled by the state they belong to. An
    // answer is never rewritten into a requirement here — that is a change request, and
    // it has its own workflow (DATA-MODEL §C.12).
    const heading =
      item.workflowState === "answered"
        ? "Answer"
        : item.workflowState === "deferred"
          ? "Deferred because"
          : item.workflowState === "not_applicable"
            ? "Not applicable because"
            : "Note";
    lines.push("", `**${heading}**`, "", blockquote(escapeBlock(item.resolutionText)));
    if (item.resolvedAt) lines.push("", `Recorded ${formatDate(item.resolvedAt)}`);
  }

  lines.push(...evidenceBlock(item.sourceEvidence, item.evidenceNotice));
  lines.push(...relationBlock(item.relations));
  return lines;
}

function findingBlock(item: ExportQualityFinding, includeConfidence: boolean): string[] {
  const lines: string[] = ["", `### ${item.displayId} — ${inline(item.title)}`, ""];
  if (item.findingKind) {
    lines.push(`- **Finding:** ${labelFor(FINDING_KIND_LABEL, item.findingKind)}`);
  }
  lines.push(`- **State:** ${item.workflowStateLabel}`);
  if (includeConfidence && item.confidence !== null) {
    lines.push(`- **Confidence:** ${confidencePercent(item.confidence)}`);
  }

  lines.push("", escapeBlock(item.description));

  if (item.resolutionText) {
    const heading =
      item.workflowState === "resolved"
        ? "Resolution"
        : item.workflowState === "dismissed"
          ? "Dismissed because"
          : "Note";
    lines.push("", `**${heading}**`, "", blockquote(escapeBlock(item.resolutionText)));
    if (item.resolvedAt) lines.push("", `Recorded ${formatDate(item.resolvedAt)}`);
  }

  lines.push(...evidenceBlock(item.sourceEvidence, item.evidenceNotice));
  lines.push(...relationBlock(item.relations));
  return lines;
}

/** ISO date, trimmed to the day. Times add noise a document does not need. */
export function formatDate(iso: string): string {
  return iso.slice(0, 10);
}

function projectSummary(pkg: ExportPackage): string[] {
  const { project, scope } = pkg;
  const lines: string[] = [`# ${inline(project.name)} — requirements`, ""];

  if (project.archived) lines.push(`> ${ARCHIVED_NOTICE}`, "");

  lines.push("## Project summary", "");
  lines.push(`- **Project:** ${inline(project.name)}`);
  if (project.businessObjective) {
    lines.push(`- **Business objective:** ${inline(project.businessObjective)}`);
  }
  if (project.domain) lines.push(`- **Domain profile:** ${inline(project.domain.name)}`);
  lines.push(`- **Output language:** ${project.outputLang === "th" ? "Thai" : "English"}`);
  lines.push(`- **Project status:** ${project.archived ? "Archived (read-only)" : "Active"}`);
  lines.push(`- **Export scope:** ${EXPORT_STATUS_SCOPE_LABEL[scope.status]}`);
  lines.push(`- **Generated at:** ${pkg.generatedAt}`);
  lines.push(`- **Source documents:** ${project.counts.sources}`);
  lines.push(`- **Analysis runs:** ${project.counts.analysisRuns}`);
  lines.push(`- **Requirements in this export:** ${project.counts.requirements}`);
  lines.push(`- **Approved:** ${project.counts.approvedRequirements}`);
  lines.push(`- **Outstanding questions:** ${project.counts.openQuestions}`);
  lines.push(`- **Unresolved quality findings:** ${project.counts.unresolvedQualityFindings}`);
  lines.push(`- **Export schema:** ${pkg.schemaVersion}`);

  if (project.knownStakeholders.length > 0) {
    lines.push(`- **Known stakeholders:** ${project.knownStakeholders.map(inline).join(" · ")}`);
  }
  if (project.archived && project.archiveReason) {
    lines.push(`- **Archive reason:** ${inline(project.archiveReason)}`);
  }

  return lines;
}

function tableOfContents(sections: DocumentSection[]): string[] {
  const lines = ["", "## Contents", ""];
  for (const section of sections) {
    lines.push(`- [${section.heading}](#${anchor(section.heading)})`);
  }
  return lines;
}

function traceabilityTable(pkg: ExportPackage): string[] {
  if (pkg.relations.length === 0) {
    return ["", "No traceability relations are recorded for the items in this export."];
  }
  const lines = [
    "",
    "| From | Relation | To | From status | To status |",
    "| --- | --- | --- | --- | --- |",
  ];
  for (const relation of pkg.relations) {
    const legacy = relation.legacy ? " (legacy relation)" : "";
    lines.push(
      `| ${relation.fromDisplayId} | ${inline(relation.phrase)}${legacy} | ${relation.toDisplayId} | ${relation.fromStatus} | ${relation.toStatus} |`,
    );
  }
  return lines;
}

function coverageBlock(pkg: ExportPackage): string[] {
  const { totals, gaps, disclaimer } = pkg.coverage;
  const lines = [
    "",
    "Coverage is computed over the **whole project**, not over the exported scope.",
    "",
    "| Indicator | Count |",
    "| --- | --- |",
    `| Total items | ${totals.items} |`,
    `| Linked items | ${totals.linked} |`,
    `| Orphan items | ${totals.orphans} |`,
    `| Missing acceptance criteria | ${totals.missingAcceptanceCriteria} |`,
    `| Items with source evidence | ${totals.itemsWithSourceEvidence} |`,
    `| Approved requirements in this export | ${totals.approvedRequirements} |`,
    `| Open questions | ${totals.openQuestions} |`,
    `| Unresolved quality findings | ${totals.unresolvedQualityFindings} |`,
  ];

  const populated = gaps.filter((gap) => gap.displayIds.length > 0);
  if (populated.length > 0) {
    lines.push("", "**Missing links and conflicts**", "");
    for (const gap of populated) {
      lines.push(`- **${gap.label}** (${gap.displayIds.length}) — ${gap.meaning}`);
      lines.push(`  - ${gap.displayIds.join(", ")}`);
    }
  }

  lines.push("", `*${disclaimer}*`);
  return lines;
}

function sourceAppendix(pkg: ExportPackage): string[] {
  const lines = ["", "| Document | Type | Revision | Characters | Locked |", "| --- | --- | --- | --- | --- |"];
  for (const source of pkg.sources) {
    lines.push(
      `| ${inline(source.title)} | ${labelFor(SOURCE_KIND_LABEL, source.kind)} | ${source.revisionNumber} | ${source.characterCount} | ${source.locked ? "Yes" : "No"} |`,
    );
  }
  lines.push(
    "",
    "*Source documents are quoted only where an item cites them. The full text is not reproduced here.*",
  );
  return lines;
}

function versionTable(pkg: ExportPackage): string[] {
  const lines = ["", "| Item | Version | Snapshots | Last changed | Reason |", "| --- | --- | --- | --- | --- |"];
  for (const row of pkg.versionSummary) {
    lines.push(
      `| ${row.displayId} | ${row.versionNo} | ${row.versionCount} | ${row.lastChangedAt ? formatDate(row.lastChangedAt) : "—"} | ${row.lastChangeReason ? inline(row.lastChangeReason) : "—"} |`,
    );
  }
  return lines;
}

function activityTable(pkg: ExportPackage): string[] {
  const lines = ["", "| Item | Activity | Date | Note |", "| --- | --- | --- | --- |"];
  for (const row of pkg.reviewActivitySummary) {
    lines.push(
      `| ${row.displayId} | ${inline(row.label)} | ${formatDate(row.at)} | ${row.comment ? inline(row.comment) : "—"} |`,
    );
  }
  return lines;
}

export function renderMarkdown(pkg: ExportPackage): string {
  const sections = documentSections(pkg);
  const itemCount =
    pkg.requirements.length + pkg.openQuestions.length + pkg.qualityFindings.length;

  const lines: string[] = [...projectSummary(pkg)];

  if (itemCount >= TOC_THRESHOLD) lines.push(...tableOfContents(sections));

  for (const section of sections) {
    lines.push("", `## ${section.heading}`);
    switch (section.kind) {
      case "requirements":
        for (const item of section.items) {
          lines.push(...requirementBlock(item, pkg.scope.includeConfidence));
        }
        break;
      case "questions":
        for (const item of section.items) {
          lines.push(...questionBlock(item, pkg.scope.includeConfidence));
        }
        break;
      case "findings":
        for (const item of section.items) {
          lines.push(...findingBlock(item, pkg.scope.includeConfidence));
        }
        break;
      case "traceability":
        lines.push(...traceabilityTable(pkg));
        break;
      case "coverage":
        lines.push(...coverageBlock(pkg));
        break;
      case "sources":
        lines.push(...sourceAppendix(pkg));
        break;
      case "versions":
        lines.push(...versionTable(pkg));
        break;
      case "activity":
        lines.push(...activityTable(pkg));
        break;
    }
  }

  lines.push(
    "",
    "---",
    "",
    `Generated by ReqWise AI · export schema ${pkg.schemaVersion} · ${pkg.generatedAt}`,
    "",
  );

  // One trailing newline, no run of three blank lines anywhere — a document diffed in a
  // repository should not churn on whitespace.
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").replace(/\s+$/, "\n");
}
