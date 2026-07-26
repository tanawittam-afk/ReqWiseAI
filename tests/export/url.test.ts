/**
 * The scope, carried in the URL.
 *
 * The round-trip test is the one that matters: whatever the export screen shows, the print
 * route and every download must rebuild the *same* scope from the query string it was
 * handed, or a reader downloads a document that is not the one they previewed.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_SCOPE, EXPORT_SECTIONS, scopeForPreset } from "../../lib/contracts/export";
import { needsVersionHistory, parseScope, scopeQuery, scopeToParams } from "../../lib/export/url";
import { exportFilename, isExportFormat, projectSlug, SLUG_FALLBACK } from "../../lib/export/filenames";

describe("parsing", () => {
  it("falls back to the default scope when nothing is supplied", () => {
    const { scope, preset } = parseScope({});
    expect(scope).toEqual(DEFAULT_SCOPE);
    expect(preset).toBeNull();
  });

  it("resolves a preset by name", () => {
    const { scope, preset } = parseScope({ preset: "audit_package" });
    expect(preset).toBe("audit_package");
    expect(scope).toEqual(scopeForPreset("audit_package"));
  });

  it("lets an explicit status override a preset", () => {
    const { scope } = parseScope({ preset: "audit_package", status: "approved_only" });
    expect(scope.status).toBe("approved_only");
  });

  it("treats the sections list as authoritative — anything unnamed is off", () => {
    const { scope } = parseScope({ sections: "business_requirements,traceability" });
    expect(scope.sections.business_requirements).toBe(true);
    expect(scope.sections.traceability).toBe(true);
    expect(scope.sections.risks).toBe(false);
    expect(scope.sections.coverage).toBe(false);
  });

  it("reads an empty sections list as everything off, which readiness then refuses", () => {
    const { scope } = parseScope({ sections: "" });
    expect(EXPORT_SECTIONS.every((section) => scope.sections[section] === false)).toBe(true);
  });

  it("ignores an unknown section rather than rejecting the whole link", () => {
    const { scope } = parseScope({ sections: "business_requirements,gantt_chart" });
    expect(scope.sections.business_requirements).toBe(true);
  });

  it("ignores an unknown status and an unknown preset", () => {
    const { scope, preset } = parseScope({ status: "everything", preset: "nope" });
    expect(scope.status).toBe(DEFAULT_SCOPE.status);
    expect(preset).toBeNull();
  });

  it("reads the confidence flag in both spellings", () => {
    expect(parseScope({ confidence: "0" }).scope.includeConfidence).toBe(false);
    expect(parseScope({ confidence: "false" }).scope.includeConfidence).toBe(false);
    expect(parseScope({ confidence: "1" }).scope.includeConfidence).toBe(true);
  });

  it("does not mutate the shared default scope", () => {
    const { scope } = parseScope({});
    scope.sections.risks = false;
    expect(DEFAULT_SCOPE.sections.risks).toBe(true);
  });
});

describe("round trip", () => {
  it("rebuilds an identical scope from its own query string", () => {
    for (const preset of ["portfolio_demo", "developer_handoff", "stakeholder_review", "audit_package"] as const) {
      const original = scopeForPreset(preset);
      const params = scopeToParams(original);
      const { scope } = parseScope({
        status: params.get("status") ?? undefined,
        sections: params.get("sections") ?? undefined,
        confidence: params.get("confidence") ?? undefined,
      });
      expect(scope).toEqual(original);
    }
  });

  it("does not write the preset name back, because a changed toggle would make it a lie", () => {
    expect(scopeQuery(scopeForPreset("audit_package"))).not.toContain("preset");
  });
});

describe("the loader's one optional read", () => {
  it("is requested only when the version summary is on", () => {
    expect(needsVersionHistory(scopeForPreset("portfolio_demo"))).toBe(false);
    expect(needsVersionHistory(scopeForPreset("audit_package"))).toBe(true);
  });
});

describe("filenames", () => {
  it("slugs a latin project name", () => {
    expect(projectSlug("Smart Space intake — slice 3")).toBe("smart-space-intake-slice-3");
  });

  it("falls back rather than producing a nameless file for a Thai-only name", () => {
    expect(projectSlug("ระบบจองห้องประชุม")).toBe(SLUG_FALLBACK);
  });

  it("never leaves a trailing separator", () => {
    expect(projectSlug("Booking!!!")).toBe("booking");
  });

  it("names each artefact predictably", () => {
    expect(exportFilename("demo", "markdown")).toBe("demo-requirements.md");
    expect(exportFilename("demo", "json")).toBe("demo-requirements.json");
    expect(exportFilename("demo", "requirements-csv")).toBe("demo-requirements.csv");
    expect(exportFilename("demo", "questions-csv")).toBe("demo-open-questions.csv");
    expect(exportFilename("demo", "findings-csv")).toBe("demo-quality-findings.csv");
    expect(exportFilename("demo", "traceability-csv")).toBe("demo-traceability.csv");
  });

  it("recognises only the six formats it can render", () => {
    expect(isExportFormat("markdown")).toBe(true);
    expect(isExportFormat("pdf")).toBe(false);
    expect(isExportFormat("../../etc/passwd")).toBe(false);
  });
});
