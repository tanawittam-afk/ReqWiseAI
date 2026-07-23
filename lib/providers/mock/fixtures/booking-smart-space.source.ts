/**
 * Fixture source document — realistic Thai meeting notes from a Smart Space
 * booking client.
 *
 * Domain-specific content lives here, in a fixture, never in the core engine.
 *
 * Offsets are computed from this text rather than written by hand, so the valid
 * fixture's citations are genuinely exact — `text.slice(start, end) === excerpt`
 * holds because it was derived, not asserted. The deliberately-wrong offsets in
 * `invalid.ts` are built by mutating these.
 */

import type { SourceDocumentInput } from "../../../contracts/analysis-input";

export const BOOKING_SOURCE_KEY = "meeting-notes-1";
export const BOOKING_SOURCE_ID = "src-booking-1";

export const bookingMeetingNotes = [
  "บันทึกการประชุม — โครงการระบบจองพื้นที่ Smart Space",
  "วันที่ 18 กรกฎาคม 2026 ผู้เข้าร่วม: คุณเมย์ (เจ้าของธุรกิจ), คุณต้น (หน้าร้าน), ทีมพัฒนา",
  "",
  "คุณเมย์เล่าว่าตอนนี้รับจองผ่านไลน์อย่างเดียว พนักงานต้องจดลงสมุดแล้วมาคีย์ใส่ Excel ทีหลัง เดือนที่แล้วจองซ้ำห้องเดียวกันสองรายในเวลาเดียวกัน ต้องคืนเงินลูกค้าและเสียลูกค้าประจำไปหนึ่งราย",
  "",
  "ความต้องการหลักคืออยากให้ลูกค้าจองเองได้จากมือถือ และเห็นห้องว่างแบบเรียลไทม์ คุณเมย์บอกว่าถ้าลูกค้าจองแล้วต้องรู้ทันทีว่าได้ห้อง ไม่ต้องรอพนักงานยืนยัน",
  "",
  "คุณต้นเสริมว่าหน้าร้านยังต้องรับลูกค้า walk-in ได้อยู่ เพราะประมาณสามในสิบของลูกค้าเดินเข้ามาเลยไม่ได้จองล่วงหน้า",
  "",
  "เรื่องการชำระเงิน คุณเมย์บอกว่ายังไม่แน่ใจ อาจจะเก็บเงินตอนจองหรือตอนเข้าใช้ก็ได้ ขอกลับไปคุยกับหุ้นส่วนก่อน",
  "",
  "ทีมถามเรื่องการยกเลิกและคืนเงิน คุณเมย์บอกว่ายังไม่มีนโยบายที่เขียนไว้ ตอนนี้ใช้ดุลพินิจหน้าร้านเป็นรายกรณี",
  "",
  "คุณต้นบอกว่าเวลาลูกค้ามาถึงอยากให้เช็คอินเร็ว ๆ ไม่อยากให้ต่อคิว ระบบควรทำงานได้บนมือถือของพนักงานด้วย",
  "",
  "คุณเมย์อยากได้ข้อมูลลูกค้าไว้ทำการตลาดต่อ ส่งโปรโมชันให้ลูกค้าเก่า แต่ยังไม่ได้คุยเรื่องการขอความยินยอม",
].join("\n");

export const bookingSourceDocument: SourceDocumentInput = {
  key: BOOKING_SOURCE_KEY,
  id: BOOKING_SOURCE_ID,
  title: "บันทึกการประชุม 18 ก.ค. 2026",
  text: bookingMeetingNotes,
};

/**
 * Build a citation with exact, verified offsets.
 *
 * Throws at module load if the excerpt is not in the source — a fixture that
 * cites text it invented should fail loudly while it is being authored, not
 * quietly during a test run.
 */
export function citation(
  excerpt: string,
  evidenceStrength?: number,
): {
  source_document_key: string;
  excerpt: string;
  start_offset: number;
  end_offset: number;
  evidence_strength?: number;
} {
  const start = bookingMeetingNotes.indexOf(excerpt);
  if (start < 0) {
    throw new Error(`fixture error: excerpt not present in source document: ${JSON.stringify(excerpt)}`);
  }
  return {
    source_document_key: BOOKING_SOURCE_KEY,
    excerpt,
    start_offset: start,
    end_offset: start + excerpt.length,
    ...(evidenceStrength === undefined ? {} : { evidence_strength: evidenceStrength }),
  };
}
