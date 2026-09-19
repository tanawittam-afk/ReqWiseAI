import { describe, expect, it } from "vitest";
import { detectDominantLanguage } from "../../lib/analysis/language-detect";

describe("detectDominantLanguage", () => {
  it("detects pure Thai", () => {
    expect(detectDominantLanguage("ลูกค้าสามารถยกเลิกการจองได้ก่อนยี่สิบสี่ชั่วโมง")).toBe("th");
  });

  it("detects pure English", () => {
    expect(detectDominantLanguage("Customers can cancel a booking up to 24 hours in advance.")).toBe(
      "en",
    );
  });

  it("defaults to English for an empty string — nothing to match", () => {
    expect(detectDominantLanguage("")).toBe("en");
  });

  it("defaults to English for symbol/number-only text", () => {
    expect(detectDominantLanguage("2026-09-21 · #4 · 100%")).toBe("en");
  });

  it("does not let digits or punctuation dilute the ratio into a false 'en'", () => {
    // All-Thai content, but padded with numbers/punctuation a real note would have.
    const note = "1) ยกเลิกได้ภายใน 24 ชม. — คืนเงินเต็มจำนวน 100%";
    expect(detectDominantLanguage(note)).toBe("th");
  });

  /**
   * Realistic mixed TH/EN meeting-note snippets — the master plan's own wording is
   * "Thai characters are more than ~30% of the notes", so these are cases an
   * analyst would actually paste, not synthetic 50/50 strings.
   */
  const mixedSnippets: Array<[string, string, "th" | "en"]> = [
    [
      "mostly Thai with a few English product/role names",
      "ทีม Marketing ต้องการให้ระบบส่งอีเมลแจ้งเตือนลูกค้าก่อนวันนัดหมาย โดยใช้ SendGrid เป็นผู้ให้บริการ",
      "th",
    ],
    [
      "mostly English with a couple of Thai stakeholder quotes",
      'The customer support lead noted: "ลูกค้าบ่นเรื่องการคืนเงินช้า" but the rest of the discussion covered API rate limits and retry policy in English.',
      "en",
    ],
    [
      "short bilingual heading followed by a long English body",
      "สรุปการประชุม — Weekly sync\n\nWe reviewed the current sprint backlog, discussed blockers on the payment gateway integration, and agreed on next steps for the QA environment rollout.",
      "en",
    ],
    [
      "short English heading followed by a long Thai body",
      "Meeting notes — สรุปการประชุม\n\nทีมงานหารือเรื่องนโยบายการคืนเงินและการยกเลิกการจอง โดยเฉพาะกรณีลูกค้าจองผ่านแอปพลิเคชันมือถือและต้องการยกเลิกก่อนเวลานัดหมายไม่ถึงยี่สิบสี่ชั่วโมง ทีมงานยังไม่ได้ข้อสรุปว่าจะคืนเงินเต็มจำนวนหรือหักค่าธรรมเนียม",
      "th",
    ],
  ];

  it.each(mixedSnippets)("%s → %s", (_label, text, expected) => {
    expect(detectDominantLanguage(text)).toBe(expected);
  });
});
