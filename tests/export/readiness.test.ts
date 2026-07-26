/**
 * The line between "this document would be wrong" and "this document is unfinished".
 *
 * The most important test in this file is the one asserting that unanswered questions do
 * **not** block: an export whose whole purpose is the handoff conversation must not be
 * withheld because that conversation has not happened yet.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_SCOPE, DEFAULT_SECTIONS, type ExportScope } from "../../lib/contracts/export";
import { buildExportPackage } from "../../lib/export/build";
import { assessReadiness } from "../../lib/export/readiness";
import { exportInput, GENERATED_AT, SOURCE_ID } from "./fixtures";

const allStatuses: ExportScope = {
  ...DEFAULT_SCOPE,
  status: "all_statuses",
  sections: { ...DEFAULT_SECTIONS },
};

function assess(input = exportInput(), scope: ExportScope = allStatuses) {
  const pkg = buildExportPackage(input, scope, GENERATED_AT);
  return { pkg, report: assessReadiness(input, pkg) };
}

describe("a healthy export", () => {
  it("is ready with warnings, because the fixture has real outstanding work", () => {
    const { report } = assess();
    expect(report.errors).toEqual([]);
    expect(report.level).toBe("ready_with_warnings");
  });

  it("counts what the document contains", () => {
    const { report } = assess();
    expect(report.counts.requirements).toBe(10);
    expect(report.counts.openQuestions).toBe(3);
    expect(report.counts.qualityFindings).toBe(2);
  });
});

describe("blocking errors", () => {
  it("refuses an export whose citation offsets no longer match the text", () => {
    const input = exportInput();
    // The excerpt stays; the span moves. This is exactly the state the schema's locking is
    // designed to prevent, so meeting it means refusing rather than publishing.
    input.references = input.references.map((reference) =>
      reference.itemId === "i-br-1" ? { ...reference, startOffset: 5, endOffset: 20 } : reference,
    );
    const { report } = assess(input);
    expect(report.level).toBe("cannot_export");
    expect(report.errors.map((issue) => issue.key)).toContain("citation_offset_mismatch");
    expect(report.errors[0].displayIds).toContain("BR-001");
  });

  it("does not put the source text into the error message", () => {
    const input = exportInput();
    input.references = input.references.map((reference) =>
      reference.itemId === "i-br-1" ? { ...reference, startOffset: 5, endOffset: 20 } : reference,
    );
    const { report } = assess(input);
    const message = report.errors.find((issue) => issue.key === "citation_offset_mismatch")?.message ?? "";
    expect(message).not.toContain("ลูกค้า");
  });

  it("refuses a citation pointing at a source revision that is not readable", () => {
    const input = exportInput();
    input.sources = input.sources.filter((source) => source.id !== SOURCE_ID);
    const { report } = assess(input);
    expect(report.errors.map((issue) => issue.key)).toContain("citation_source_missing");
  });

  it("refuses an empty scope", () => {
    const nothing: ExportScope = {
      ...DEFAULT_SCOPE,
      status: "approved_only",
      sections: Object.fromEntries(
        Object.keys(DEFAULT_SECTIONS).map((key) => [key, false]),
      ) as ExportScope["sections"],
    };
    const { report } = assess(exportInput(), nothing);
    expect(report.level).toBe("cannot_export");
    expect(report.errors.map((issue) => issue.key)).toContain("scope_empty");
  });

  it("accepts an unverified span as a warning rather than an error", () => {
    // US-001's citation is stored with offset_verified = false in the fixture.
    const { report } = assess();
    expect(report.errors.map((issue) => issue.key)).not.toContain("citation_offset_mismatch");
    expect(report.warnings.map((issue) => issue.key)).toContain("unverified_offsets");
  });
});

describe("warnings never block", () => {
  it("reports unanswered questions without refusing the export", () => {
    const { report } = assess();
    const warning = report.warnings.find((issue) => issue.key === "open_questions");
    expect(warning?.displayIds).toContain("Q-001");
    expect(report.level).not.toBe("cannot_export");
  });

  it("reports an unresolved finding, and says acknowledged is not fixed", () => {
    const { report } = assess();
    const warning = report.warnings.find((issue) => issue.key === "unresolved_findings");
    expect(warning?.displayIds).toContain("QF-001");
    expect(warning?.message).toContain("Acknowledged");
  });

  it("reports drafts and rejected items that the scope let in", () => {
    const { report } = assess();
    expect(report.warnings.map((issue) => issue.key)).toContain("draft_items");
    expect(report.warnings.map((issue) => issue.key)).toContain("rejected_items");
  });

  it("reports orphans and stories with no acceptance criterion", () => {
    const { report } = assess();
    const orphans = report.warnings.find((issue) => issue.key === "orphans");
    expect(orphans?.displayIds).toContain("RISK-001");
  });

  it("reports legacy relations as legacy", () => {
    const { report } = assess();
    const legacy = report.warnings.find((issue) => issue.key === "legacy_relations");
    expect(legacy?.message).toContain("Legacy relation");
  });

  it("reports items that came from domain guidance with no citation", () => {
    const { report } = assess();
    const notice = report.warnings.find((issue) => issue.key === "domain_guidance_items");
    expect(notice?.displayIds).toContain("NFR-001");
  });

  it("is ready with no warnings when the scope contains only settled work", () => {
    const clean = exportInput();
    // Approved items only, with their citations intact and nothing outstanding in scope.
    clean.items = clean.items.filter((item) => ["i-obj-1", "i-br-1"].includes(item.id));
    clean.references = clean.references.filter((reference) => reference.itemId === "i-br-1");
    clean.relations = clean.relations.filter(
      (relation) => relation.fromItemId === "i-obj-1" && relation.toItemId === "i-br-1",
    );
    const scope: ExportScope = {
      ...DEFAULT_SCOPE,
      status: "approved_only",
      sections: { ...DEFAULT_SECTIONS, coverage: false },
    };
    const { report } = assess(clean, scope);
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([]);
    expect(report.level).toBe("ready");
  });
});
