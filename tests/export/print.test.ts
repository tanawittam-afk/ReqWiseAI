/**
 * The printable document's rules — the ones that can be asserted without a browser.
 *
 * What a real print looks like is verified in a browser and recorded in HANDOFF.md; what is
 * testable here is that the classes the print stylesheet keys on exist and are applied to
 * the right things, that the title and footer say what the document is, and that a status
 * survives without colour.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { DEFAULT_SCOPE, DEFAULT_SECTIONS, type ExportScope } from "../../lib/contracts/export";
import { buildExportPackage } from "../../lib/export/build";
import {
  factPairs,
  PRINT_BLOCK_CLASS,
  PRINT_ONLY_CLASS,
  printDocumentTitle,
  printFooter,
  PRINT_SECTION_CLASS,
  SCREEN_ONLY_CLASS,
} from "../../lib/export/print";
import { archivedInput, exportInput, GENERATED_AT } from "./fixtures";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");

const scope: ExportScope = {
  ...DEFAULT_SCOPE,
  status: "all_statuses",
  sections: { ...DEFAULT_SECTIONS },
};
const pkg = buildExportPackage(exportInput(), scope, GENERATED_AT);

describe("print title and footer", () => {
  it("names the project and the day, because that becomes the PDF's filename", () => {
    expect(printDocumentTitle(pkg)).toBe("Smart Space intake — requirements (2026-07-26)");
  });

  it("records the scope, the schema and the timestamp on paper", () => {
    const footer = printFooter(pkg);
    expect(footer).toContain("Smart Space intake");
    expect(footer).toContain("scope: all statuses");
    expect(footer).toContain("reqwise-export/1.0");
    expect(footer).toContain(GENERATED_AT);
  });
});

describe("fact pairs", () => {
  it("drops empty values rather than printing a label with nothing after it", () => {
    expect(factPairs([["Status", "Approved"], ["Priority", null], ["Version", ""]])).toEqual([
      { label: "Status", value: "Approved" },
    ]);
  });
});

describe("the print stylesheet", () => {
  const css = readFileSync(join(root, "app", "globals.css"), "utf8");
  const printBlock = css.slice(css.indexOf("@media print"));

  it("has a print block at all", () => {
    expect(css).toContain("@media print");
  });

  it("hides screen-only chrome and reveals the print-only footer", () => {
    expect(printBlock).toContain(`.${SCREEN_ONLY_CLASS}`);
    expect(printBlock).toContain(`.${PRINT_ONLY_CLASS}`);
    expect(printBlock).toContain("display: none !important");
  });

  it("keeps a requirement block whole", () => {
    expect(printBlock).toContain(`.${PRINT_BLOCK_CLASS}`);
    expect(printBlock).toContain("break-inside: avoid");
    expect(printBlock).toContain("page-break-inside: avoid");
  });

  it("starts each major section on a new page", () => {
    expect(printBlock).toContain(`.${PRINT_SECTION_CLASS} + .${PRINT_SECTION_CLASS}`);
    expect(printBlock).toContain("break-before: page");
  });

  it("sets A4 with sensible margins", () => {
    expect(printBlock).toContain("size: A4");
    expect(printBlock).toMatch(/margin:\s*16mm 14mm/);
  });

  it("releases the shell's viewport clamp so a document is not clipped to one page", () => {
    expect(printBlock).toContain("height: auto !important");
    expect(printBlock).toContain("overflow: visible !important");
  });

  it("prints black on white", () => {
    expect(printBlock).toContain("background: #ffffff !important");
    expect(printBlock).toContain("color: #000000 !important");
  });
});

describe("the app shell is marked screen-only", () => {
  it("on the sidebar", () => {
    const sidebar = readFileSync(
      join(root, "app", "workspace", "_components", "sidebar.tsx"),
      "utf8",
    );
    expect(sidebar).toContain(SCREEN_ONLY_CLASS);
  });

  it("on the toolbar", () => {
    const toolbar = readFileSync(
      join(root, "app", "workspace", "_components", "toolbar.tsx"),
      "utf8",
    );
    expect(toolbar).toContain(SCREEN_ONLY_CLASS);
  });
});

describe("status is legible without colour", () => {
  it("every requirement carries a status word, not only a status value", () => {
    for (const requirement of pkg.requirements) {
      expect(requirement.statusLabel.length).toBeGreaterThan(0);
      expect(requirement.statusLabel[0]).toBe(requirement.statusLabel[0].toUpperCase());
    }
  });

  it("every question and finding carries a state word", () => {
    for (const item of [...pkg.openQuestions, ...pkg.qualityFindings]) {
      expect(item.workflowStateLabel.length).toBeGreaterThan(0);
    }
  });
});

describe("an archived project prints its provenance", () => {
  it("carries the notice in the package, not only in the UI", () => {
    const archived = buildExportPackage(archivedInput(), scope, GENERATED_AT);
    expect(archived.notices).toContain(
      "This export was generated from an archived read-only project.",
    );
  });

  it("keeps the notice even when every optional section is switched off", () => {
    const minimal: ExportScope = {
      ...scope,
      sections: { ...DEFAULT_SECTIONS, coverage: false, traceability: false, source_evidence: false },
    };
    const archived = buildExportPackage(archivedInput(), minimal, GENERATED_AT);
    expect(archived.notices.length).toBe(1);
  });
});
