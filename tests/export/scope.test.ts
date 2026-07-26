/**
 * What each scope admits, and what a preset resolves to.
 *
 * The four status scopes are the feature most likely to be got subtly wrong — an
 * off-by-one in a status list ships a rejected requirement into a signed-off document — so
 * each is asserted against the fixture's full status spread rather than against a list of
 * enum values.
 */

import { describe, expect, it } from "vitest";
import {
  DEFAULT_SCOPE,
  DEFAULT_SECTIONS,
  scopeForPreset,
  type ExportScope,
} from "../../lib/contracts/export";
import { buildExportPackage } from "../../lib/export/build";
import { exportInput, GENERATED_AT } from "./fixtures";

function build(scope: ExportScope) {
  return buildExportPackage(exportInput(), scope, GENERATED_AT);
}

function withStatus(status: ExportScope["status"]): ExportScope {
  return { ...DEFAULT_SCOPE, status, sections: { ...DEFAULT_SECTIONS } };
}

function ids(scope: ExportScope): string[] {
  return build(scope).requirements.map((item) => item.displayId);
}

describe("status scopes", () => {
  it("approved only keeps approved requirements and nothing else", () => {
    const displayIds = ids(withStatus("approved_only"));
    expect(displayIds).toEqual(["AC-001", "BR-001", "BR-003", "OBJ-001", "US-001"]);
    const statuses = new Set(build(withStatus("approved_only")).requirements.map((i) => i.status));
    expect([...statuses]).toEqual(["approved"]);
  });

  it("reviewed and approved adds the reviewed ones, still no drafts", () => {
    const displayIds = ids(withStatus("reviewed_and_approved"));
    expect(displayIds).toContain("FR-001"); // reviewed
    expect(displayIds).not.toContain("BR-002"); // draft
    expect(displayIds).not.toContain("NFR-001"); // needs_clarification
    expect(displayIds).not.toContain("FR-002"); // rejected
  });

  it("the active working set includes drafts and clarification, never rejected", () => {
    const displayIds = ids(withStatus("active_working_set"));
    expect(displayIds).toContain("BR-002");
    expect(displayIds).toContain("NFR-001");
    expect(displayIds).not.toContain("FR-002");
  });

  it("all statuses includes the rejected one, labelled", () => {
    const pkg = build(withStatus("all_statuses"));
    const rejected = pkg.requirements.find((item) => item.displayId === "FR-002");
    expect(rejected).toBeDefined();
    expect(rejected?.statusLabel).toBe("Rejected");
  });

  it("does not filter questions or findings by status", () => {
    // A question's status is always draft, so a status filter would delete every question
    // from an approved-only export.
    const pkg = build(withStatus("approved_only"));
    expect(pkg.openQuestions.map((q) => q.displayId)).toEqual(["Q-001", "Q-002", "Q-003"]);
    expect(pkg.qualityFindings.map((f) => f.displayId)).toEqual(["QF-001", "QF-002"]);
  });
});

describe("optional sections", () => {
  it("drops a requirement type when its section is off", () => {
    const scope: ExportScope = {
      ...withStatus("all_statuses"),
      sections: { ...DEFAULT_SECTIONS, risks: false },
    };
    expect(ids(scope)).not.toContain("RISK-001");
  });

  it("drops questions and findings independently", () => {
    const scope: ExportScope = {
      ...withStatus("all_statuses"),
      sections: { ...DEFAULT_SECTIONS, open_questions: false },
    };
    const pkg = build(scope);
    expect(pkg.openQuestions).toEqual([]);
    expect(pkg.qualityFindings.length).toBe(2);
  });

  it("omits evidence and the source appendix together when evidence is off", () => {
    const scope: ExportScope = {
      ...withStatus("all_statuses"),
      sections: { ...DEFAULT_SECTIONS, source_evidence: false },
    };
    const pkg = build(scope);
    expect(pkg.sources).toEqual([]);
    expect(pkg.requirements.every((item) => item.sourceEvidence.length === 0)).toBe(true);
    expect(pkg.requirements.every((item) => item.evidenceNotice === null)).toBe(true);
  });

  it("omits relations everywhere when traceability is off", () => {
    const scope: ExportScope = {
      ...withStatus("all_statuses"),
      sections: { ...DEFAULT_SECTIONS, traceability: false },
    };
    const pkg = build(scope);
    expect(pkg.relations).toEqual([]);
    expect(pkg.requirements.every((item) => item.relations.length === 0)).toBe(true);
  });

  it("still computes coverage over the whole project when sections are narrowed", () => {
    const narrow: ExportScope = {
      ...withStatus("approved_only"),
      sections: { ...DEFAULT_SECTIONS, risks: false },
    };
    const wide = withStatus("all_statuses");
    // Coverage describes the project, so narrowing the document must not move it.
    expect(build(narrow).coverage.totals).toEqual(build(wide).coverage.totals);
  });

  it("leaves history out by default and includes it when asked", () => {
    expect(build(DEFAULT_SCOPE).versionSummary).toEqual([]);
    expect(build(DEFAULT_SCOPE).reviewActivitySummary).toEqual([]);

    const withHistory: ExportScope = {
      ...withStatus("all_statuses"),
      sections: { ...DEFAULT_SECTIONS, version_summary: true, review_activity: true },
    };
    const pkg = build(withHistory);
    expect(pkg.versionSummary.length).toBeGreaterThan(0);
    expect(pkg.reviewActivitySummary.length).toBeGreaterThan(0);
  });

  it("drops confidence from every block when the reader turns it off", () => {
    const scope: ExportScope = { ...withStatus("all_statuses"), includeConfidence: false };
    const pkg = build(scope);
    expect(pkg.requirements.every((item) => item.confidence === null)).toBe(true);
    expect(pkg.openQuestions.every((item) => item.confidence === null)).toBe(true);
  });
});

describe("presets resolve to explicit scopes", () => {
  it("portfolio demo is reviewed and approved with evidence, questions, findings and traceability", () => {
    const scope = scopeForPreset("portfolio_demo");
    expect(scope.status).toBe("reviewed_and_approved");
    expect(scope.sections.open_questions).toBe(true);
    expect(scope.sections.quality_findings).toBe(true);
    expect(scope.sections.source_evidence).toBe(true);
    expect(scope.sections.traceability).toBe(true);
    expect(scope.sections.coverage).toBe(true);
    expect(scope.sections.version_summary).toBe(false);
    expect(scope.sections.review_activity).toBe(false);
  });

  it("developer handoff is approved only", () => {
    expect(scopeForPreset("developer_handoff").status).toBe("approved_only");
  });

  it("stakeholder review drops the engineering-facing sections", () => {
    const scope = scopeForPreset("stakeholder_review");
    expect(scope.sections.acceptance_criteria).toBe(false);
    expect(scope.sections.traceability).toBe(false);
    expect(scope.sections.open_questions).toBe(true);
  });

  it("the audit package and the full archive carry all statuses and all history", () => {
    for (const preset of ["audit_package", "full_project_archive"] as const) {
      const scope = scopeForPreset(preset);
      expect(scope.status).toBe("all_statuses");
      expect(scope.sections.version_summary).toBe(true);
      expect(scope.sections.review_activity).toBe(true);
    }
  });

  it("returns a fresh object each time, so a caller cannot mutate the table", () => {
    const first = scopeForPreset("portfolio_demo");
    first.sections.risks = false;
    expect(scopeForPreset("portfolio_demo").sections.risks).toBe(true);
  });
});
