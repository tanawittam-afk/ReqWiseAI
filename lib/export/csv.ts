/**
 * The four CSV files.
 *
 * Pure `ExportPackage → string`. UTF-8 throughout — Thai requirement text is the normal
 * case here, not an edge case.
 *
 * Three rules that are not obvious, and one that is a security control:
 *
 *  1. **RFC 4180 quoting.** A field is quoted when it contains a comma, a quote, a CR or
 *     an LF, and an embedded quote is doubled. Multi-line descriptions therefore survive
 *     as one field rather than becoming three broken rows.
 *  2. **CRLF row separators**, per the same RFC. Excel on Windows is the tool that reads
 *     these, and it is the one that cares.
 *  3. **Formula-injection protection.** A spreadsheet treats a cell starting with `=`,
 *     `+`, `-`, `@`, a tab or a CR as a formula, and a requirement that legitimately
 *     begins "-" or "=" would then be *executed* by whoever opens the file — the
 *     classic CSV injection. Such a value is prefixed with a single apostrophe, which
 *     spreadsheets read as "this is text" and which is visible and reversible, rather
 *     than being stripped: silently altering a requirement's words is worse than an
 *     extra character a reader can see.
 *
 * Column order is fixed and written out per file, never derived from object keys.
 */

import type { ExportPackage } from "../contracts/export.ts";
import {
  confidencePercent,
  EVIDENCE_LABEL,
  FINDING_KIND_LABEL,
  labelFor,
  ORIGIN_LABEL,
  PRIORITY_LABEL,
} from "./labels.ts";

const ROW_SEPARATOR = "\r\n";

/** Characters that make a spreadsheet treat a cell as a formula rather than as text. */
const FORMULA_LEADERS = ["=", "+", "-", "@", "\t", "\r"];

export function neutralizeFormula(value: string): string {
  if (value === "") return value;
  return FORMULA_LEADERS.includes(value[0]) ? `'${value}` : value;
}

export function csvField(value: string | number | boolean | null): string {
  if (value === null) return "";
  // Numbers and booleans cannot start a formula and cannot contain a delimiter, so they
  // pass through — quoting them would make every reader parse them as text.
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "true" : "false";

  const guarded = neutralizeFormula(value);
  const needsQuotes = /[",\r\n]/.test(guarded);
  return needsQuotes ? `"${guarded.replace(/"/g, '""')}"` : guarded;
}

export function csvRow(fields: Array<string | number | boolean | null>): string {
  return fields.map(csvField).join(",");
}

function csvFile(header: readonly string[], rows: Array<Array<string | number | boolean | null>>): string {
  return [csvRow([...header]), ...rows.map(csvRow)].join(ROW_SEPARATOR) + ROW_SEPARATOR;
}

/** Every citation an item carries, flattened into one cell. */
function evidenceCell(
  evidence: ExportPackage["requirements"][number]["sourceEvidence"],
  notice: string | null,
): string {
  if (evidence.length === 0) return notice ?? "";
  return evidence
    .map((item) => {
      const span =
        item.startOffset !== null && item.endOffset !== null
          ? ` [${item.startOffset}-${item.endOffset}]`
          : " [no span]";
      return `${item.sourceTitle} r${item.revisionNumber}${span}: ${item.excerpt}`;
    })
    .join("\n");
}

function relationCell(relations: ExportPackage["requirements"][number]["relations"]): string {
  return relations
    .map((relation) => `${relation.phrase} ${relation.displayId}${relation.legacy ? " (legacy)" : ""}`)
    .join("\n");
}

export const REQUIREMENTS_CSV_HEADER = [
  "Display ID",
  "Type",
  "Title",
  "Description",
  "Priority",
  "Status",
  "Version",
  "Human edited",
  "Evidence class",
  "Origin",
  "Confidence",
  "Source evidence",
  "Relations",
  "Last review activity",
  "Last review date",
  "Analysis run",
] as const;

export function renderRequirementsCsv(pkg: ExportPackage): string {
  return csvFile(
    REQUIREMENTS_CSV_HEADER,
    pkg.requirements.map((item) => [
      item.displayId,
      item.typeLabel,
      item.title,
      item.description,
      labelFor(PRIORITY_LABEL, item.priority),
      item.statusLabel,
      item.versionNo,
      item.humanEdited,
      labelFor(EVIDENCE_LABEL, item.evidenceClass),
      labelFor(ORIGIN_LABEL, item.origin),
      item.confidence === null ? "" : confidencePercent(item.confidence),
      evidenceCell(item.sourceEvidence, item.evidenceNotice),
      relationCell(item.relations),
      item.review.lastActivity?.label ?? "",
      item.review.lastActivity?.at.slice(0, 10) ?? "",
      item.analysisRunId,
    ]),
  );
}

export const QUESTIONS_CSV_HEADER = [
  "Display ID",
  "Question",
  "Detail",
  "State",
  "Outstanding",
  "Origin",
  "Confidence",
  "Answer or reason",
  "Recorded at",
  "Follow up on",
  "Source evidence",
  "Relations",
] as const;

export function renderQuestionsCsv(pkg: ExportPackage): string {
  return csvFile(
    QUESTIONS_CSV_HEADER,
    pkg.openQuestions.map((item) => [
      item.displayId,
      item.title,
      item.description,
      item.workflowStateLabel,
      item.outstanding,
      labelFor(ORIGIN_LABEL, item.origin),
      item.confidence === null ? "" : confidencePercent(item.confidence),
      item.resolutionText ?? "",
      item.resolvedAt?.slice(0, 10) ?? "",
      item.followUpOn ?? "",
      evidenceCell(item.sourceEvidence, item.evidenceNotice),
      relationCell(item.relations),
    ]),
  );
}

export const FINDINGS_CSV_HEADER = [
  "Display ID",
  "Finding",
  "Finding type",
  "Detail",
  "State",
  "Unresolved",
  "Resolution or dismissal reason",
  "Recorded at",
  "Source evidence",
  "Relations",
] as const;

export function renderFindingsCsv(pkg: ExportPackage): string {
  return csvFile(
    FINDINGS_CSV_HEADER,
    pkg.qualityFindings.map((item) => [
      item.displayId,
      item.title,
      item.findingKind ? labelFor(FINDING_KIND_LABEL, item.findingKind) : "",
      item.description,
      item.workflowStateLabel,
      item.unresolved,
      item.resolutionText ?? "",
      item.resolvedAt?.slice(0, 10) ?? "",
      evidenceCell(item.sourceEvidence, item.evidenceNotice),
      relationCell(item.relations),
    ]),
  );
}

export const TRACEABILITY_CSV_HEADER = [
  "From display ID",
  "From type",
  "Relation type",
  "Relation",
  "To display ID",
  "To type",
  "From status",
  "To status",
  "Legacy relation",
] as const;

export function renderTraceabilityCsv(pkg: ExportPackage): string {
  return csvFile(
    TRACEABILITY_CSV_HEADER,
    pkg.relations.map((relation) => [
      relation.fromDisplayId,
      relation.fromType,
      relation.type,
      relation.phrase,
      relation.toDisplayId,
      relation.toType,
      relation.fromStatus,
      relation.toStatus,
      relation.legacy,
    ]),
  );
}
