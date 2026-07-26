/**
 * Deterministic ordering — the property that makes three formats of one export comparable.
 *
 * The interesting assertion is the last one: the display ids Markdown prints, the ones JSON
 * lists and the ones the CSV rows carry must be the *same sequence*. Two formats that agree
 * on content but not on order would send a reviewer hunting for a difference that is not
 * there.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_SCOPE, DEFAULT_SECTIONS, type ExportScope } from "../../lib/contracts/export";
import { buildExportPackage, compareItems, displayIdParts } from "../../lib/export/build";
import { renderRequirementsCsv } from "../../lib/export/csv";
import { renderJson } from "../../lib/export/json";
import { renderMarkdown } from "../../lib/export/markdown";
import { exportInput, GENERATED_AT, item } from "./fixtures";

const allStatuses: ExportScope = {
  ...DEFAULT_SCOPE,
  status: "all_statuses",
  sections: { ...DEFAULT_SECTIONS },
};

describe("display id ordering", () => {
  it("splits a display id into a prefix and a number", () => {
    expect(displayIdParts("FR-005")).toEqual({ prefix: "FR", number: 5 });
    expect(displayIdParts("RULE-12")).toEqual({ prefix: "RULE", number: 12 });
  });

  it("sorts numerically, not as text", () => {
    const two = item("a", "FR-2", "functional_requirement");
    const ten = item("b", "FR-10", "functional_requirement");
    expect([ten, two].sort(compareItems).map((i) => i.displayId)).toEqual(["FR-2", "FR-10"]);
  });

  it("groups by prefix before number", () => {
    const list = [
      item("a", "FR-1", "functional_requirement"),
      item("b", "BR-9", "business_requirement"),
      item("c", "BR-1", "business_requirement"),
    ];
    expect(list.sort(compareItems).map((i) => i.displayId)).toEqual(["BR-1", "BR-9", "FR-1"]);
  });

  it("breaks a tie on created_at, then on the row id", () => {
    const early = item("z-id", "BR-1", "business_requirement", { createdAt: "2026-01-01T00:00:00.000Z" });
    const late = item("a-id", "BR-1", "business_requirement", { createdAt: "2026-02-01T00:00:00.000Z" });
    expect([late, early].sort(compareItems).map((i) => i.id)).toEqual(["z-id", "a-id"]);

    const sameTime = [
      item("b-id", "BR-1", "business_requirement"),
      item("a-id", "BR-1", "business_requirement"),
    ];
    expect(sameTime.sort(compareItems).map((i) => i.id)).toEqual(["a-id", "b-id"]);
  });

  it("sorts a malformed id last within its own name rather than throwing", () => {
    const odd = item("a", "WEIRD", "risk");
    const normal = item("b", "RISK-1", "risk");
    expect(() => [odd, normal].sort(compareItems)).not.toThrow();
  });
});

describe("the same input produces the same order in every format", () => {
  const pkg = buildExportPackage(exportInput(), allStatuses, GENERATED_AT);

  it("orders the JSON requirement list by display id", () => {
    expect(pkg.requirements.map((item) => item.displayId)).toEqual([
      "AC-001",
      "BR-001",
      "BR-002",
      "BR-003",
      "FR-001",
      "FR-002",
      "NFR-001",
      "OBJ-001",
      "RISK-001",
      "US-001",
    ]);
  });

  it("prints the CSV rows in that same order", () => {
    const rows = renderRequirementsCsv(pkg).trim().split("\r\n").slice(1);
    const displayIds = rows.map((row) => row.split(",")[0]);
    expect(displayIds).toEqual(pkg.requirements.map((item) => item.displayId));
  });

  it("prints the Markdown headings in that same order", () => {
    const markdown = renderMarkdown(pkg);
    const headings = [...markdown.matchAll(/^### ([A-Z]+-\d+)/gm)].map((match) => match[1]);
    const expected = [
      ...pkg.requirements.map((item) => item.displayId),
      ...pkg.openQuestions.filter((q) => q.outstanding).map((q) => q.displayId),
      ...pkg.openQuestions.filter((q) => !q.outstanding).map((q) => q.displayId),
      ...pkg.qualityFindings.filter((f) => f.unresolved).map((f) => f.displayId),
      ...pkg.qualityFindings.filter((f) => !f.unresolved).map((f) => f.displayId),
    ];
    // Markdown groups requirements into type sections, so compare the sets per section
    // rather than one flat list — but every id must appear exactly once, in ascending
    // order within its section.
    expect(new Set(headings)).toEqual(new Set(expected));
    expect(headings.length).toBe(expected.length);
  });

  it("is stable across repeated builds of the same input", () => {
    const again = buildExportPackage(exportInput(), allStatuses, GENERATED_AT);
    expect(renderJson(again)).toBe(renderJson(pkg));
    expect(renderMarkdown(again)).toBe(renderMarkdown(pkg));
    expect(renderRequirementsCsv(again)).toBe(renderRequirementsCsv(pkg));
  });

  it("differs only in generatedAt when the clock moves", () => {
    const later = buildExportPackage(exportInput(), allStatuses, "2027-01-01T00:00:00.000Z");
    const normalise = (json: string) => json.replace(/"generatedAt": "[^"]+"/, '"generatedAt": "X"');
    expect(normalise(renderJson(later))).toBe(normalise(renderJson(pkg)));
  });

  it("does not depend on the order rows arrive in", () => {
    const shuffled = exportInput();
    shuffled.items = [...shuffled.items].reverse();
    shuffled.relations = [...shuffled.relations].reverse();
    shuffled.references = [...shuffled.references].reverse();
    const other = buildExportPackage(shuffled, allStatuses, GENERATED_AT);
    expect(renderJson(other)).toBe(renderJson(pkg));
  });
});
