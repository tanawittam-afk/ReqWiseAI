/**
 * The public demo's source text — authored fresh for this purpose, in the shape of
 * `lib/providers/mock/fixtures/booking-smart-space.source.ts` but deliberately **not**
 * imported from it. That fixture is documented test-only
 * (`mock-provider.ts`); coupling a shipped, public page to a test fixture would invite
 * exactly the drift its own doc comment warns against.
 *
 * Both language variants are tuned against the mock strategy's real trigger words
 * (`lib/providers/mock/runtime/lexicon.ts`) so the demo run genuinely exercises the
 * engine — an obligation + customer + booking line, an obligation + staff line, and a
 * line the source itself flags as unresolved — rather than hoping the strategy finds
 * something to say. Titles avoid every trigger word on purpose: a title matching
 * "obligation" would make the *heading* the business requirement instead of the first
 * real sentence.
 */

import type { OutputLang, SourceDocumentInput } from "../contracts/analysis-input";

export const DEMO_SOURCE_KEY = "demo-meeting-notes";
export const DEMO_SOURCE_ID = "demo-source";

const TH_LINES = [
  "บันทึกสรุปประชุม: ระบบจองห้องประชุมอัจฉริยะ",
  "",
  "ลูกค้าต้องสามารถค้นหาห้องประชุมที่ว่างและทำการจองผ่านแอปได้ทันที ระบบต้องส่งอีเมลยืนยันการจองให้ลูกค้าทุกครั้ง",
  "",
  "พนักงานหน้าเคาน์เตอร์ต้องสามารถเปิดดูตารางการจองทั้งหมด และช่วยเหลือลูกค้าที่ walk-in เข้ามาโดยไม่ได้จองล่วงหน้า",
  "",
  "ฝ่ายปฏิบัติการต้องการให้ระบบแจ้งเตือนพนักงานล่วงหน้า 15 นาทีก่อนลูกค้าเข้าใช้ห้องที่จองไว้",
  "",
  "ยังไม่ได้ข้อสรุปเรื่องนโยบายการยกเลิกการจองว่าลูกค้าจะสามารถยกเลิกได้ภายในกี่ชั่วโมงก่อนเวลาที่จองไว้",
];

const EN_LINES = [
  "Meeting notes: Smart meeting-room booking system",
  "",
  "Customers must be able to search available meeting rooms and complete a booking through the app immediately. The system must send a booking confirmation email to the customer every time.",
  "",
  "Front desk staff must be able to view the full booking schedule and assist a walk-in customer who arrives without a reservation.",
  "",
  "Operations needs to notify staff 15 minutes before a customer's reserved session begins.",
  "",
  "The cancellation policy is not yet decided — how many hours before the reserved time a customer may cancel is still unclear.",
];

const TITLE: Record<OutputLang, string> = {
  th: "บันทึกการประชุม — ตัวอย่างสาธิต",
  en: "Meeting notes — demo example",
};

export function demoSourceText(lang: OutputLang): string {
  return (lang === "th" ? TH_LINES : EN_LINES).join("\n");
}

export function demoSourceDocument(lang: OutputLang): SourceDocumentInput {
  return {
    key: DEMO_SOURCE_KEY,
    id: DEMO_SOURCE_ID,
    title: TITLE[lang],
    text: demoSourceText(lang),
  };
}
