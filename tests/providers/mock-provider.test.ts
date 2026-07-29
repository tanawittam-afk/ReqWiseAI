/**
 * The runtime mock strategy.
 *
 * These tests are about the mock being a *function of its input*: arbitrary text in
 * either language produces a valid, citable analysis, and the citations index into
 * the text that was actually supplied. The 14-type contract fixture is tested
 * separately (tests/contracts, tests/validation, tests/normalization) and is
 * deliberately unreachable from here — see `lib/providers/mock/mock-provider.ts`.
 */

import { describe, expect, it } from "vitest";
import { createMockProvider } from "../../lib/providers/mock/mock-provider";
import { runAnalysis } from "../../lib/analysis/run-analysis";
import { bookingSmartSpaceProfile } from "../../lib/domain/profiles/booking-smart-space";
import { generalSoftwareProfile } from "../../lib/domain/profiles/general-software";
import { bookingMeetingNotes } from "../../lib/providers/mock/fixtures/booking-smart-space.source";
import type { AnalysisInput, OutputLang } from "../../lib/contracts/analysis-input";
import type { DomainProfile } from "../../lib/domain/types";
import { testPorts } from "../helpers";
import type { NormalizedAnalysis } from "../../lib/contracts/normalized";

const THAI = [
  "ลูกค้าต้องการจองห้องประชุมผ่านเว็บไซต์ โดยเลือกสาขา ห้อง วันที่ และเวลาได้",
  "พนักงานต้องเห็นรายการจองและตรวจสอบลูกค้าที่มาเช็กอิน",
  "ยังไม่ได้ข้อสรุปเรื่องการยกเลิก การคืนเงิน และช่องทางแจ้งเตือน",
].join("\n");

const ENGLISH = [
  "Customers must be able to book a meeting room on the website, choosing branch, room, date and time.",
  "Front desk staff need to see the booking list and verify each customer at check-in.",
  "Cancellation, refund and notification channels are not decided yet.",
].join("\n");

const MIXED = [
  "ลูกค้าต้องการจองห้องประชุมผ่าน website ได้เอง",
  "Staff must verify each customer at check-in.",
].join("\r\n");

function inputFor(
  text: string,
  options: { profile?: DomainProfile; lang?: OutputLang } = {},
): AnalysisInput {
  return {
    domainProfile: options.profile ?? bookingSmartSpaceProfile,
    sourceDocuments: [{ key: "notes-1", id: "src-1", title: "Meeting notes", text }],
    outputLang: options.lang ?? "th",
  };
}

async function analyse(input: AnalysisInput) {
  return runAnalysis(createMockProvider(), input, testPorts());
}

/** Every citation must address the supplied text exactly. */
function assertCitationsExact(analysis: NormalizedAnalysis, text: string) {
  for (const item of analysis.items) {
    for (const ref of item.sourceReferences) {
      expect(text).toContain(ref.excerpt);
      if (ref.startOffset !== undefined && ref.endOffset !== undefined) {
        expect(text.slice(ref.startOffset, ref.endOffset)).toBe(ref.excerpt);
        expect(ref.offsetVerified).toBe(true);
      }
    }
  }
}

describe("runtime mock strategy — determinism", () => {
  it("declares itself deterministic", () => {
    expect(createMockProvider().deterministic).toBe(true);
  });

  it("returns byte-identical raw output for the same input", async () => {
    const provider = createMockProvider();
    const a = await provider.generate(inputFor(THAI));
    const b = await provider.generate(inputFor(THAI));
    expect(JSON.stringify(a.raw)).toBe(JSON.stringify(b.raw));
    expect(a.metadata).toEqual({ provider: "mock", model: null, promptVersion: null });
  });

  it("is deterministic end to end", async () => {
    const a = await analyse(inputFor(THAI));
    const b = await analyse(inputFor(THAI));
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("produces different output for different input", async () => {
    const a = await analyse(inputFor(THAI));
    const b = await analyse(inputFor(ENGLISH));
    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });
});

describe("runtime mock strategy — arbitrary source text", () => {
  it("analyses arbitrary Thai notes through the real validation path", async () => {
    const result = await analyse(inputFor(THAI));
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;
    assertCitationsExact(result.analysis, THAI);
  });

  it("analyses arbitrary English notes", async () => {
    const result = await analyse(inputFor(ENGLISH, { lang: "en" }));
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;
    assertCitationsExact(result.analysis, ENGLISH);
  });

  it("analyses mixed Thai and English notes with CRLF line endings", async () => {
    const result = await analyse(inputFor(MIXED));
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;
    assertCitationsExact(result.analysis, MIXED);
  });

  it("meets the minimum output contract for ordinary notes", async () => {
    const result = await analyse(inputFor(THAI));
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;

    const types = new Set(result.analysis.items.map((i) => i.type));
    for (const required of [
      "problem_statement",
      "business_objective",
      "stakeholder",
      "business_requirement",
      "functional_requirement",
      "user_story",
      "acceptance_criterion",
      "open_question",
      "quality_finding",
    ]) {
      expect(types).toContain(required);
    }
    // "assumption or risk" — the contract accepts either; the profile supplies both.
    expect(types.has("assumption") || types.has("risk")).toBe(true);
  });

  it("every item is born draft with a unique provider key", async () => {
    const result = await analyse(inputFor(THAI));
    if (result.status !== "valid") throw new Error("expected a valid run");

    expect(result.analysis.items.every((i) => i.status === "draft")).toBe(true);
    const keys = result.analysis.items.map((i) => i.providerKey);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("relates the requirements to what the notes actually say", async () => {
    const result = await analyse(inputFor(THAI));
    if (result.status !== "valid") throw new Error("expected a valid run");

    const br = result.analysis.items.find((i) => i.type === "business_requirement");
    const fr = result.analysis.items.find((i) => i.type === "functional_requirement");
    // The customer-facing need and the staff-facing one are different sentences.
    expect(br?.sourceReferences[0].excerpt).toContain("จอง");
    expect(fr?.sourceReferences[0].excerpt).toContain("พนักงาน");
    expect(br?.sourceReferences[0].excerpt).not.toBe(fr?.sourceReferences[0].excerpt);
  });

  it("raises the undecided topics as questions, never as facts", async () => {
    const result = await analyse(inputFor(THAI));
    if (result.status !== "valid") throw new Error("expected a valid run");

    const questions = result.analysis.items.filter((i) => i.type === "open_question");
    expect(questions.length).toBeGreaterThan(0);

    // Cancellation and refund appear, and appear as questions rather than requirements.
    const questionText = questions.map((q) => `${q.title} ${q.description}`).join(" ");
    expect(questionText).toMatch(/ยกเลิก|คืนเงิน/);

    const requirements = result.analysis.items.filter(
      (i) => i.type === "business_requirement" || i.type === "functional_requirement",
    );
    for (const requirement of requirements) {
      expect(requirement.title).not.toMatch(/ยกเลิก|คืนเงิน/);
    }
  });

  it("does not reuse the contract fixture's text for an unrelated source", async () => {
    const result = await analyse(inputFor(THAI));
    if (result.status !== "valid") throw new Error("expected a valid run");

    const everyExcerpt = result.analysis.items.flatMap((i) =>
      i.sourceReferences.map((r) => r.excerpt),
    );
    expect(everyExcerpt.length).toBeGreaterThan(0);
    for (const excerpt of everyExcerpt) {
      expect(bookingMeetingNotes).not.toContain(excerpt);
    }
  });
});

describe("runtime mock strategy — evidence honesty", () => {
  it("never lets domain-profile guidance become stated evidence", async () => {
    const result = await analyse(inputFor(THAI));
    if (result.status !== "valid") throw new Error("expected a valid run");

    const fromProfile = result.analysis.items.filter((i) => i.origin === "domain_profile");
    expect(fromProfile.length).toBeGreaterThan(0);
    for (const item of fromProfile) {
      expect(item.evidenceClass).not.toBe("stated");
      expect(item.sourceReferences).toHaveLength(0);
    }
  });

  it("gives every assumed item a rationale and no citation", async () => {
    const result = await analyse(inputFor(THAI));
    if (result.status !== "valid") throw new Error("expected a valid run");

    const assumed = result.analysis.items.filter((i) => i.evidenceClass === "assumed");
    expect(assumed.length).toBeGreaterThan(0);
    for (const item of assumed) {
      expect(item.sourceReferences).toHaveLength(0);
      expect(item.rationale?.trim()).toBeTruthy();
    }
  });
});

describe("runtime mock strategy — domain profile drives behaviour", () => {
  it("changes its guidance when the profile changes, with no engine change", async () => {
    const booking = await analyse(inputFor(THAI, { profile: bookingSmartSpaceProfile }));
    const general = await analyse(inputFor(THAI, { profile: generalSoftwareProfile }));
    if (booking.status !== "valid" || general.status !== "valid") {
      throw new Error("expected both runs to be valid");
    }

    const guidanceOf = (a: typeof booking) =>
      a.status === "valid"
        ? a.analysis.items.filter((i) => i.origin === "domain_profile").map((i) => i.title)
        : [];

    expect(guidanceOf(booking)).not.toEqual(guidanceOf(general));
  });

  it("reflects a profile's own risk wording in the risk it raises", async () => {
    const custom: DomainProfile = {
      ...generalSoftwareProfile,
      commonRisks: ["A totally distinctive profile-supplied risk"],
    };
    const result = await analyse(inputFor(ENGLISH, { profile: custom, lang: "en" }));
    if (result.status !== "valid") throw new Error("expected a valid run");

    const risk = result.analysis.items.find((i) => i.type === "risk");
    expect(risk?.title).toContain("A totally distinctive profile-supplied risk");
  });

  it("still produces a usable analysis under a thin profile", async () => {
    const result = await analyse(inputFor(ENGLISH, { profile: generalSoftwareProfile, lang: "en" }));
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;
    assertCitationsExact(result.analysis, ENGLISH);
  });
});

describe("runtime mock strategy — degenerate input", () => {
  it("produces no items for an empty document rather than inventing an analysis", async () => {
    const result = await analyse(inputFor("   \n\n  "));
    // Zero items fails the schema's items.min(1) — an honest invalid run.
    expect(result.status).toBe("invalid");
  });

  it("handles a single short line", async () => {
    const text = "ต้องมีระบบจอง";
    const result = await analyse(inputFor(text));
    expect(result.status).toBe("valid");
    if (result.status !== "valid") return;
    assertCitationsExact(result.analysis, text);
  });
});
