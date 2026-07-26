/**
 * The Markdown document, asserted per section rather than as one snapshot.
 *
 * A whole-file snapshot would fail on every wording change and teach whoever hits it to
 * re-record it without reading — so the claims here are the ones that matter: Thai text
 * survives, requirement text cannot become markup, an excerpt is a quotation, and no
 * section asserts something the data does not support.
 */

import { describe, expect, it } from "vitest";
import { DEFAULT_SCOPE, DEFAULT_SECTIONS, type ExportScope } from "../../lib/contracts/export";
import { buildExportPackage } from "../../lib/export/build";
import { escapeBlock, renderMarkdown } from "../../lib/export/markdown";
import { archivedInput, exportInput, GENERATED_AT } from "./fixtures";

const allStatuses: ExportScope = {
  ...DEFAULT_SCOPE,
  status: "all_statuses",
  sections: { ...DEFAULT_SECTIONS, version_summary: true, review_activity: true },
};

const markdown = renderMarkdown(buildExportPackage(exportInput(), allStatuses, GENERATED_AT));

describe("escaping", () => {
  it("neutralises a line-leading heading so a requirement cannot become one", () => {
    expect(escapeBlock("# Cancellation policy")).toBe("\\# Cancellation policy");
  });

  it("neutralises a code fence so a requirement cannot swallow the document", () => {
    expect(escapeBlock("```\nrm -rf\n```")).toBe("\\```\nrm -rf\n\\```");
  });

  it("neutralises a line-leading list marker, blockquote and table pipe", () => {
    expect(escapeBlock("- item")).toBe("\\- item");
    expect(escapeBlock("> quote")).toBe("\\> quote");
    expect(escapeBlock("| a | b |")).toBe("\\| a | b |");
    expect(escapeBlock("1. first")).toBe("1\\. first");
  });

  it("leaves inline emphasis alone — a requirement may mean it", () => {
    expect(escapeBlock("the *fast* path")).toBe("the *fast* path");
  });

  it("leaves Thai text untouched", () => {
    expect(escapeBlock("ลูกค้าต้องการจอง")).toBe("ลูกค้าต้องการจอง");
  });
});

describe("project summary", () => {
  it("names the project, the scope and the schema", () => {
    expect(markdown).toContain("# Smart Space intake — requirements");
    expect(markdown).toContain("**Export scope:** All statuses");
    expect(markdown).toContain("**Export schema:** reqwise-export/1.0");
  });

  it("reports the counts a reader checks first", () => {
    expect(markdown).toContain("**Requirements in this export:** 10");
    expect(markdown).toContain("**Approved:** 5");
    expect(markdown).toContain("**Outstanding questions:** 2");
    expect(markdown).toContain("**Unresolved quality findings:** 1");
  });

  it("shows a table of contents once the document is long", () => {
    expect(markdown).toContain("## Contents");
    expect(markdown).toContain("- [Business requirements](#business-requirements)");
  });
});

describe("requirement sections", () => {
  it("renders one heading per requirement, with its display id", () => {
    expect(markdown).toContain("### BR-001 — BR-001 statement");
  });

  it("prints status, priority, version and evidence as words", () => {
    expect(markdown).toContain("- **Status:** Approved");
    expect(markdown).toContain("- **Priority:** High");
    expect(markdown).toContain("- **Version:** 3 (human-edited)");
    expect(markdown).toContain("- **Evidence:** Stated");
  });

  it("prints confidence as a percentage when the scope includes it", () => {
    expect(markdown).toContain("- **Confidence:** 91%");
  });

  it("keeps the human-edited text, in Thai, exactly as stored", () => {
    expect(markdown).toContain('ระบบต้องรองรับการจอง "ออนไลน์"');
  });

  it("explains an inferred item rather than leaving the class unexplained", () => {
    expect(markdown).toContain("**Why this was inferred:**");
  });

  it("labels a rejected requirement Rejected and never Approved", () => {
    const section = markdown.slice(markdown.indexOf("### FR-002"));
    expect(section).toContain("- **Status:** Rejected");
  });
});

describe("source evidence", () => {
  it("renders the excerpt as a blockquote with its span", () => {
    expect(markdown).toContain("> ลูกค้าต้องการจองห้องประชุมผ่านเว็บไซต์");
    expect(markdown).toContain("characters 0–38");
  });

  it("names the document, its kind and its revision", () => {
    expect(markdown).toContain("Source: ประชุมเก็บความต้องการ, meeting notes, revision 1");
  });

  it("says so when a span was never verified", () => {
    expect(markdown).toContain("span unverified");
  });

  it("says an item came from domain guidance instead of inventing a citation", () => {
    const section = markdown.slice(markdown.indexOf("### NFR-001"));
    expect(section).toContain("Generated from domain guidance; no direct source evidence.");
    // The nearest plausible sentence must not have been attached to it.
    expect(section.slice(0, section.indexOf("###", 5))).not.toContain("> ลูกค้า");
  });

  it("does not reproduce the full source document", () => {
    expect(markdown).not.toContain("ยังไม่ได้ข้อสรุปเรื่องการยกเลิกและการคืนเงิน");
  });
});

describe("questions and findings", () => {
  it("splits questions into outstanding and resolved", () => {
    expect(markdown).toContain("## Outstanding stakeholder questions");
    expect(markdown).toContain("## Resolved stakeholder questions");
  });

  it("quotes the stakeholder's answer under its own heading", () => {
    expect(markdown).toContain("**Answer**");
    expect(markdown).toContain("> ยกเลิกฟรีก่อน 24 ชั่วโมง");
  });

  it("shows a deferral reason and its follow-up date", () => {
    expect(markdown).toContain("**Deferred because**");
    expect(markdown).toContain("- **Follow up on:** 2026-08-15");
  });

  it("splits findings into unresolved and closed, with the provider's own kind", () => {
    expect(markdown).toContain("## Unresolved quality findings");
    expect(markdown).toContain("## Resolved or dismissed findings");
    expect(markdown).toContain("- **Finding:** Ambiguous");
  });

  it("never invents a severity, because the contract has none", () => {
    expect(markdown.toLowerCase()).not.toContain("severity");
  });
});

describe("traceability and coverage", () => {
  it("prints the relation as a sentence and marks a legacy one", () => {
    expect(markdown).toContain("| BR-001 | is implemented by | FR-001 |");
    expect(markdown).toContain("(legacy relation)");
  });

  it("says coverage is computed over the whole project", () => {
    expect(markdown).toContain("Coverage is computed over the **whole project**");
  });

  it("carries the coverage disclaimer verbatim", () => {
    expect(markdown).toContain("Coverage indicators assist review and do not replace human judgment.");
  });

  it("never calls coverage a quality score", () => {
    expect(markdown.toLowerCase()).not.toContain("quality score");
  });
});

describe("optional sections", () => {
  it("prints the version and review summaries when asked", () => {
    expect(markdown).toContain("## Version summary");
    expect(markdown).toContain("Tightened the wording");
    expect(markdown).toContain("## Review activity summary");
    expect(markdown).toContain("Signed off with the client.");
  });

  it("omits an empty section rather than printing a heading over nothing", () => {
    const scope: ExportScope = {
      ...DEFAULT_SCOPE,
      status: "approved_only",
      sections: { ...DEFAULT_SECTIONS },
    };
    const narrow = renderMarkdown(buildExportPackage(exportInput(), scope, GENERATED_AT));
    // No non-functional requirement is approved in the fixture.
    expect(narrow).not.toContain("## Non-functional requirements");
  });
});

describe("archived projects", () => {
  it("carries the notice, as a quote at the top", () => {
    const archived = renderMarkdown(buildExportPackage(archivedInput(), allStatuses, GENERATED_AT));
    expect(archived).toContain("> This export was generated from an archived read-only project.");
    expect(archived).toContain("**Project status:** Archived (read-only)");
    expect(archived).toContain("**Archive reason:** Superseded by the 2027 intake");
  });
});

describe("document hygiene", () => {
  it("ends with exactly one newline", () => {
    expect(markdown.endsWith("\n")).toBe(true);
    expect(markdown.endsWith("\n\n")).toBe(false);
  });

  it("never leaves three blank lines", () => {
    expect(markdown).not.toMatch(/\n{3,}/);
  });

  it("records what produced it", () => {
    expect(markdown).toContain("Generated by ReqWise AI · export schema reqwise-export/1.0");
  });
});
