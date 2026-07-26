/**
 * Whether this export may be produced, and what a reader should know about it.
 *
 * Pure. Takes the loaded input and the built package; returns errors that stop a download
 * and warnings that do not.
 *
 * The line between the two lists is the whole point of this file:
 *
 *  * A **blocking error** means the document would be *wrong* — a citation that no longer
 *    matches the text it claims to quote, a relation pointing at nothing, a package that
 *    fails its own schema. A document that looks complete and is not is worse than no
 *    document, because somebody will build from it.
 *  * A **warning** means the document is accurate and *unfinished* — open questions,
 *    unresolved findings, drafts included by an explicit choice. Unfinished is a normal
 *    state of requirements work, and blocking on it would make the export useless exactly
 *    when it is most needed: the handoff conversation where those questions get asked.
 *
 * So: unanswered questions never block. That is a product decision, written here rather
 * than left implicit in whichever `if` happened to be first.
 */

import { exportPackageSchema, type ExportPackage } from "../contracts/export.ts";
import type { ExportInput } from "./types.ts";

export type ReadinessLevel = "ready" | "ready_with_warnings" | "cannot_export";

export type ReadinessIssue = {
  /** Stable key, so the UI can style or test one without matching on prose. */
  key: string;
  message: string;
  /** Display ids the issue concerns, when it concerns specific items. */
  displayIds: string[];
};

export type ReadinessReport = {
  level: ReadinessLevel;
  errors: ReadinessIssue[];
  warnings: ReadinessIssue[];
  counts: {
    requirements: number;
    openQuestions: number;
    qualityFindings: number;
    relations: number;
    sources: number;
  };
};

export function readinessLevel(report: Omit<ReadinessReport, "level">): ReadinessLevel {
  if (report.errors.length > 0) return "cannot_export";
  return report.warnings.length > 0 ? "ready_with_warnings" : "ready";
}

/**
 * The invariant every citation must still satisfy:
 *
 *     storedRawText.slice(startOffset, endOffset) === excerpt
 *
 * The excerpt is stored verbatim precisely so it survives the offsets rotting, and a
 * source revision is frozen once cited — so a mismatch means something happened that the
 * schema was built to prevent. The export refuses rather than shipping a quotation
 * attributed to a span that does not contain it.
 *
 * `offsetVerified === false` is **not** a mismatch: it means the writer never claimed the
 * offsets were checked. Those are reported as a warning, not an error.
 */
function citationErrors(input: ExportInput, exportedDisplayIds: Set<string>): ReadinessIssue[] {
  const sourcesById = new Map(input.sources.map((source) => [source.id, source]));
  const displayIdById = new Map(input.items.map((item) => [item.id, item.displayId]));

  const mismatched: string[] = [];
  const orphanedSource: string[] = [];

  for (const reference of input.references) {
    const displayId = displayIdById.get(reference.itemId);
    if (!displayId || !exportedDisplayIds.has(displayId)) continue;

    const source = sourcesById.get(reference.sourceDocumentId);
    if (!source) {
      orphanedSource.push(displayId);
      continue;
    }
    if (reference.startOffset === null || reference.endOffset === null) continue;

    const slice = source.rawText.slice(reference.startOffset, reference.endOffset);
    if (slice !== reference.excerpt) mismatched.push(displayId);
  }

  const errors: ReadinessIssue[] = [];
  if (mismatched.length > 0) {
    errors.push({
      key: "citation_offset_mismatch",
      // Deliberately says nothing about *what* the text is. The mismatch is a
      // diagnostic; quoting either side of it into a user-facing error would put source
      // material into a place errors get pasted, logged and shared.
      message:
        "A source citation no longer matches the text it points at, so the evidence in this export cannot be trusted. Re-run the analysis for the affected items.",
      displayIds: unique(mismatched),
    });
  }
  if (orphanedSource.length > 0) {
    errors.push({
      key: "citation_source_missing",
      message: "A citation points at a source revision that is not readable in this project.",
      displayIds: unique(orphanedSource),
    });
  }
  return errors;
}

function unique(values: string[]): string[] {
  return [...new Set(values)].sort();
}

/**
 * Relations the document could not resolve.
 *
 * The loader already drops edges whose endpoints are invisible, and the database refuses
 * cross-project edges outright (DATA-MODEL §C.13), so this is a belt-and-braces check
 * over what actually reached the package: an empty `displayId` here would mean an edge
 * was rendered pointing at nothing.
 */
function relationErrors(pkg: ExportPackage): ReadinessIssue[] {
  const known = new Set<string>([
    ...pkg.requirements.map((item) => item.displayId),
    ...pkg.openQuestions.map((item) => item.displayId),
    ...pkg.qualityFindings.map((item) => item.displayId),
  ]);

  const dangling = pkg.relations
    .filter(
      (relation) =>
        relation.fromDisplayId === "" ||
        relation.toDisplayId === "" ||
        !known.has(relation.fromDisplayId) ||
        !known.has(relation.toDisplayId),
    )
    .map((relation) => relation.fromDisplayId || relation.toDisplayId || "unknown");

  if (dangling.length === 0) return [];
  return [
    {
      key: "relation_unresolved",
      message: "A traceability relation refers to an item that is not in this export.",
      displayIds: unique(dangling),
    },
  ];
}

export function assessReadiness(input: ExportInput, pkg: ExportPackage): ReadinessReport {
  const exportedDisplayIds = new Set<string>([
    ...pkg.requirements.map((item) => item.displayId),
    ...pkg.openQuestions.map((item) => item.displayId),
    ...pkg.qualityFindings.map((item) => item.displayId),
  ]);

  const errors: ReadinessIssue[] = [
    ...citationErrors(input, exportedDisplayIds),
    ...relationErrors(pkg),
  ];

  // The package validates against its own contract before it is offered for download.
  // A schema failure here means the builder and the contract disagree, which is a bug —
  // and one that must not reach a file somebody parses.
  const parsed = exportPackageSchema.safeParse(pkg);
  if (!parsed.success) {
    errors.push({
      key: "contract_invalid",
      message:
        "This export does not match the export contract and cannot be produced. This is a defect, not a data problem.",
      displayIds: [],
    });
  }

  if (exportedDisplayIds.size === 0) {
    errors.push({
      key: "scope_empty",
      message:
        "The selected scope contains no items, so there is nothing to export. Widen the status scope or switch a section back on.",
      displayIds: [],
    });
  }

  const warnings: ReadinessIssue[] = [];

  const outstanding = pkg.openQuestions.filter((question) => question.outstanding);
  if (outstanding.length > 0) {
    warnings.push({
      key: "open_questions",
      message: `${outstanding.length} stakeholder question${outstanding.length === 1 ? " is" : "s are"} still unanswered. They are listed in the document as outstanding.`,
      displayIds: outstanding.map((question) => question.displayId),
    });
  }

  const unresolvedFindings = pkg.qualityFindings.filter((finding) => finding.unresolved);
  if (unresolvedFindings.length > 0) {
    warnings.push({
      key: "unresolved_findings",
      message: `${unresolvedFindings.length} quality finding${unresolvedFindings.length === 1 ? " is" : "s are"} unresolved. "Acknowledged" means seen, not fixed.`,
      displayIds: unresolvedFindings.map((finding) => finding.displayId),
    });
  }

  const drafts = pkg.requirements.filter((item) => item.status === "draft");
  if (drafts.length > 0) {
    warnings.push({
      key: "draft_items",
      message: `${drafts.length} requirement${drafts.length === 1 ? "" : "s"} in this export ${drafts.length === 1 ? "is" : "are"} still a draft that nobody has reviewed.`,
      displayIds: drafts.map((item) => item.displayId),
    });
  }

  const rejected = pkg.requirements.filter((item) => item.status === "rejected");
  if (rejected.length > 0) {
    warnings.push({
      key: "rejected_items",
      message: `${rejected.length} rejected requirement${rejected.length === 1 ? " is" : "s are"} included. Each is labelled Rejected in the document.`,
      displayIds: rejected.map((item) => item.displayId),
    });
  }

  const orphanGap = pkg.coverage.gaps.find((gap) => gap.key === "orphan");
  if (orphanGap && orphanGap.displayIds.length > 0) {
    warnings.push({
      key: "orphans",
      message: `${orphanGap.displayIds.length} item${orphanGap.displayIds.length === 1 ? "" : "s"} in this project ${orphanGap.displayIds.length === 1 ? "has" : "have"} no traceability relation in either direction.`,
      displayIds: orphanGap.displayIds,
    });
  }

  const criteriaGap = pkg.coverage.gaps.find((gap) => gap.key === "story_without_criterion");
  if (criteriaGap && criteriaGap.displayIds.length > 0) {
    warnings.push({
      key: "missing_acceptance_criteria",
      message: `${criteriaGap.displayIds.length} user stor${criteriaGap.displayIds.length === 1 ? "y has" : "ies have"} no acceptance criterion, so there is no stated way to tell when ${criteriaGap.displayIds.length === 1 ? "it is" : "they are"} done.`,
      displayIds: criteriaGap.displayIds,
    });
  }

  const legacy = pkg.relations.filter((relation) => relation.legacy);
  if (legacy.length > 0) {
    warnings.push({
      key: "legacy_relations",
      message: `${legacy.length} relation${legacy.length === 1 ? "" : "s"} predate typed traceability and are exported as "Legacy relation" — the analysis stated no relationship kind, so none is claimed.`,
      displayIds: unique(legacy.map((relation) => relation.fromDisplayId)),
    });
  }

  const noDirectEvidence = [
    ...pkg.requirements,
    ...pkg.openQuestions,
    ...pkg.qualityFindings,
  ].filter((item) => item.evidenceNotice !== null);
  if (noDirectEvidence.length > 0) {
    warnings.push({
      key: "domain_guidance_items",
      message: `${noDirectEvidence.length} item${noDirectEvidence.length === 1 ? "" : "s"} came from domain guidance rather than the source text and carry no citation. Each says so.`,
      displayIds: noDirectEvidence.map((item) => item.displayId),
    });
  }

  const unverifiedOffsets = [...pkg.requirements, ...pkg.openQuestions, ...pkg.qualityFindings]
    .filter((item) => item.sourceEvidence.some((evidence) => !evidence.offsetVerified))
    .map((item) => item.displayId);
  if (unverifiedOffsets.length > 0) {
    warnings.push({
      key: "unverified_offsets",
      message: `${unverifiedOffsets.length} citation${unverifiedOffsets.length === 1 ? "" : "s"} quote the source verbatim but were stored without a verified character span.`,
      displayIds: unique(unverifiedOffsets),
    });
  }

  const partial: Omit<ReadinessReport, "level"> = {
    errors,
    warnings,
    counts: {
      requirements: pkg.requirements.length,
      openQuestions: pkg.openQuestions.length,
      qualityFindings: pkg.qualityFindings.length,
      relations: pkg.relations.length,
      sources: pkg.sources.length,
    },
  };

  return { ...partial, level: readinessLevel(partial) };
}

export const READINESS_LABEL: Record<ReadinessLevel, string> = {
  ready: "Ready",
  ready_with_warnings: "Ready with warnings",
  cannot_export: "Cannot export",
};
