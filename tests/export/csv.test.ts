/**
 * The CSV files, including the one control that is a security control rather than a
 * formatting rule: a cell that starts with `=`, `+`, `-` or `@` must not be handed to a
 * spreadsheet as a formula.
 *
 * The escaping tests use the fixture's real awkward values — a Thai multi-line description
 * containing a comma and a quote, and a requirement whose title genuinely begins `=` — so
 * they fail for the reason a user would hit rather than for a synthetic one.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_SCOPE, DEFAULT_SECTIONS, type ExportScope } from "../../lib/contracts/export";
import { buildExportPackage } from "../../lib/export/build";
import {
  csvField,
  csvRow,
  FINDINGS_CSV_HEADER,
  neutralizeFormula,
  QUESTIONS_CSV_HEADER,
  REQUIREMENTS_CSV_HEADER,
  renderFindingsCsv,
  renderQuestionsCsv,
  renderRequirementsCsv,
  renderTraceabilityCsv,
  TRACEABILITY_CSV_HEADER,
} from "../../lib/export/csv";
import { exportInput, GENERATED_AT } from "./fixtures";

const allStatuses: ExportScope = {
  ...DEFAULT_SCOPE,
  status: "all_statuses",
  sections: { ...DEFAULT_SECTIONS },
};

const pkg = buildExportPackage(exportInput(), allStatuses, GENERATED_AT);

describe("field escaping", () => {
  it("leaves a plain value alone", () => {
    expect(csvField("BR-001")).toBe("BR-001");
  });

  it("quotes a value containing a comma", () => {
    expect(csvField("a, b")).toBe('"a, b"');
  });

  it("doubles an embedded quote and wraps the field", () => {
    expect(csvField('say "yes"')).toBe('"say ""yes"""');
  });

  it("quotes a multi-line value so it stays one field", () => {
    expect(csvField("line one\nline two")).toBe('"line one\nline two"');
  });

  it("quotes a value containing CRLF", () => {
    expect(csvField("a\r\nb")).toBe('"a\r\nb"');
  });

  it("passes Thai text through unquoted when it needs no quoting", () => {
    expect(csvField("ลูกค้าต้องการจอง")).toBe("ลูกค้าต้องการจอง");
  });

  it("writes an empty field for null, and keeps an empty string empty", () => {
    expect(csvField(null)).toBe("");
    expect(csvField("")).toBe("");
  });

  it("writes numbers and booleans without quotes", () => {
    expect(csvRow([3, true, false])).toBe("3,true,false");
  });
});

describe("formula injection", () => {
  for (const leader of ["=", "+", "-", "@", "\t", "\r"]) {
    it(`prefixes a value starting with ${JSON.stringify(leader)}`, () => {
      expect(neutralizeFormula(`${leader}cmd`)).toBe(`'${leader}cmd`);
    });
  }

  it("leaves a value that merely contains one alone", () => {
    expect(neutralizeFormula("a=b")).toBe("a=b");
  });

  it("does not alter an empty value", () => {
    expect(neutralizeFormula("")).toBe("");
  });

  it("guards the requirement whose title is a formula, without altering its words", () => {
    const csv = renderRequirementsCsv(pkg);
    // The apostrophe is visible and reversible; the words are unchanged. No quoting is
    // added — the value holds no comma, quote or newline, and quoting it would make a
    // reader parse a delimiter rule that is not in play.
    expect(csv).toContain("'=SUM(A1:A9) must not be executed");
    expect(csv).toContain("'-1 discount is out of scope");
    expect(csv).not.toContain(",=SUM(A1:A9)");
  });
});

describe("requirements CSV", () => {
  const csv = renderRequirementsCsv(pkg);
  const lines = csv.split("\r\n");

  it("starts with the declared column order", () => {
    expect(lines[0]).toBe(REQUIREMENTS_CSV_HEADER.join(","));
  });

  it("separates rows with CRLF and ends with one", () => {
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv).not.toContain("\n\n");
  });

  it("has one row per requirement plus the header", () => {
    expect(lines.filter((line) => line !== "").length).toBe(pkg.requirements.length + 1);
  });

  it("keeps a Thai multi-line description in a single quoted field", () => {
    expect(csv).toContain('"ระบบต้องรองรับการจอง ""ออนไลน์""');
  });

  it("carries the evidence excerpt and its span", () => {
    expect(csv).toContain("ประชุมเก็บความต้องการ r1 [0-38]");
  });

  it("carries the domain-guidance notice where there is no citation", () => {
    expect(csv).toContain("Generated from domain guidance; no direct source evidence.");
  });

  it("records human-edited as a boolean, not as prose", () => {
    const row = lines.find((line) => line.startsWith("BR-001,")) ?? "";
    expect(row).toContain(",true,");
  });
});

describe("questions CSV", () => {
  const csv = renderQuestionsCsv(pkg);

  it("uses the declared column order", () => {
    expect(csv.split("\r\n")[0]).toBe(QUESTIONS_CSV_HEADER.join(","));
  });

  it("carries the answer, the state and the follow-up date", () => {
    expect(csv).toContain("ยกเลิกฟรีก่อน 24 ชั่วโมง");
    expect(csv).toContain("Answered");
    expect(csv).toContain("2026-08-15");
  });

  it("marks an open question as outstanding", () => {
    const row = csv.split("\r\n").find((line) => line.startsWith("Q-001,")) ?? "";
    expect(row).toContain(",true,");
  });
});

describe("findings CSV", () => {
  const csv = renderFindingsCsv(pkg);

  it("uses the declared column order and the provider's finding kind", () => {
    expect(csv.split("\r\n")[0]).toBe(FINDINGS_CSV_HEADER.join(","));
    expect(csv).toContain("Ambiguous");
    expect(csv).toContain("Incomplete");
  });

  it("has no severity column", () => {
    expect(FINDINGS_CSV_HEADER.join(",").toLowerCase()).not.toContain("severity");
  });
});

describe("traceability CSV", () => {
  const csv = renderTraceabilityCsv(pkg);
  const lines = csv.split("\r\n").filter((line) => line !== "");

  it("uses the declared column order", () => {
    expect(lines[0]).toBe(TRACEABILITY_CSV_HEADER.join(","));
  });

  it("carries the machine type and the human sentence side by side", () => {
    expect(csv).toContain("implemented_by,is implemented by");
  });

  it("flags a legacy relation as legacy and keeps its own type", () => {
    const row = lines.find((line) => line.includes("derives_from")) ?? "";
    expect(row).toContain("derives from");
    expect(row.endsWith("true")).toBe(true);
  });

  it("carries both endpoints' statuses", () => {
    const row = lines.find((line) => line.startsWith("BR-001,")) ?? "";
    expect(row).toContain("approved");
    expect(row).toContain("reviewed");
  });

  it("has one row per exported relation", () => {
    expect(lines.length - 1).toBe(pkg.relations.length);
  });
});
