/**
 * Deliberately-broken fixtures — one per failure mode.
 *
 * These exist so that the rejection paths are tested for real rather than assumed
 * to work. Every one of these is raw untrusted output that MUST be rejected, and
 * MUST NOT be partially accepted. None of them is ever repaired.
 *
 * Each is a full, otherwise-plausible analysis with exactly one thing wrong, so a
 * test can attribute the rejection to that one cause.
 */

import { PROVIDER_SCHEMA_VERSION } from "../../../contracts/provider-output";
import { BOOKING_SOURCE_KEY, citation } from "./booking-smart-space.source";

const okReference = () => citation("จองซ้ำห้องเดียวกันสองรายในเวลาเดียวกัน");

function envelope(items: unknown[]) {
  return { schema_version: PROVIDER_SCHEMA_VERSION, items };
}

/** evidence_error: 'stated' with no source reference. */
export const statedWithoutSource = envelope([
  {
    key: "br-1",
    type: "business_requirement",
    title: "ข้อกำหนดที่อ้างว่ามีในแหล่งข้อมูลแต่ไม่มีการอ้างอิง",
    description: "ระบุ evidence_class เป็น stated แต่ไม่มี source_references",
    evidence_class: "stated",
    origin: "source_analysis",
    confidence: 0.8,
    source_references: [],
  },
]);

/** evidence_error: 'inferred' without a rationale. */
export const inferredWithoutRationale = envelope([
  {
    key: "br-1",
    type: "business_requirement",
    title: "ข้อกำหนดเชิงอนุมานที่ไม่มีเหตุผลกำกับ",
    description: "ระบุ inferred แต่ไม่มี rationale",
    evidence_class: "inferred",
    origin: "source_analysis",
    confidence: 0.6,
    source_references: [okReference()],
  },
]);

/** evidence_error: 'assumed' carrying a source reference — the core failure mode. */
export const assumedWithSource = envelope([
  {
    key: "asm-1",
    type: "assumption",
    title: "ข้อสันนิษฐานที่แอบอ้างหลักฐาน",
    description: "ระบุ assumed แต่กลับแนบ source_references มาด้วย",
    evidence_class: "assumed",
    origin: "source_analysis",
    confidence: 0.3,
    rationale: "มีเหตุผลกำกับครบ แต่ evidence_class กับ references ขัดกัน",
    source_references: [okReference()],
  },
]);

/** source_reference_error: excerpt does not match the text at the given offsets. */
export const excerptOffsetMismatch = envelope([
  {
    key: "br-1",
    type: "business_requirement",
    title: "อ้างอิงที่ excerpt ไม่ตรงกับ offset",
    description: "offset ชี้ไปที่ข้อความหนึ่ง แต่ excerpt เป็นอีกข้อความ",
    evidence_class: "stated",
    origin: "source_analysis",
    confidence: 0.8,
    source_references: [
      {
        source_document_key: BOOKING_SOURCE_KEY,
        excerpt: "ข้อความที่ไม่ตรงกับตำแหน่งนี้เลย",
        start_offset: 0,
        end_offset: 10,
      },
    ],
  },
]);

/** source_reference_error: end_offset beyond the length of the source. */
export const offsetOutOfRange = envelope([
  {
    key: "br-1",
    type: "business_requirement",
    title: "offset เกินความยาวของแหล่งข้อมูล",
    description: "end_offset มากกว่าความยาวของข้อความต้นทาง",
    evidence_class: "stated",
    origin: "source_analysis",
    confidence: 0.8,
    source_references: [
      {
        source_document_key: BOOKING_SOURCE_KEY,
        excerpt: "อะไรก็ตาม",
        start_offset: 999998,
        end_offset: 999999,
      },
    ],
  },
]);

/** schema_error: two items share a key. */
export const duplicateKey = envelope([
  {
    key: "dup",
    type: "constraint",
    title: "รายการแรก",
    description: "ใช้ key ว่า dup",
    evidence_class: "assumed",
    origin: "source_analysis",
    confidence: 0.5,
    rationale: "ข้อสันนิษฐาน",
    source_references: [],
  },
  {
    key: "dup",
    type: "constraint",
    title: "รายการที่สองที่ใช้ key ซ้ำ",
    description: "key ชนกับรายการแรก",
    evidence_class: "assumed",
    origin: "source_analysis",
    confidence: 0.5,
    rationale: "ข้อสันนิษฐาน",
    source_references: [],
  },
]);

/** relation_error: related_item_keys points at a key that does not exist. */
export const unknownRelationKey = envelope([
  {
    key: "fr-1",
    type: "functional_requirement",
    title: "อ้างอิงความสัมพันธ์ไปยัง key ที่ไม่มีอยู่",
    description: "related_item_keys ชี้ไปที่ br-missing ซึ่งไม่มีในผลลัพธ์",
    evidence_class: "assumed",
    origin: "source_analysis",
    confidence: 0.5,
    rationale: "ข้อสันนิษฐาน",
    related_item_keys: ["br-missing"],
    source_references: [],
  },
]);

/** schema_error: provider tries to assign a status. */
export const providerSuppliedStatus = envelope([
  {
    key: "br-1",
    type: "business_requirement",
    title: "ผู้ให้บริการพยายามกำหนดสถานะเอง",
    description: "แนบ field status มาด้วย ซึ่งเป็นสิ่งที่แอปเท่านั้นที่กำหนดได้",
    evidence_class: "assumed",
    origin: "source_analysis",
    confidence: 0.5,
    rationale: "ข้อสันนิษฐาน",
    status: "approved",
    source_references: [],
  },
]);

/** schema_error: provider tries to assign a display id. */
export const providerSuppliedDisplayId = envelope([
  {
    key: "br-1",
    type: "business_requirement",
    title: "ผู้ให้บริการพยายามกำหนด display id เอง",
    description: "แนบ field display_id มาด้วย",
    evidence_class: "assumed",
    origin: "source_analysis",
    confidence: 0.5,
    rationale: "ข้อสันนิษฐาน",
    display_id: "BR-001",
    source_references: [],
  },
]);

/** schema_error: unknown item type. */
export const unknownItemType = envelope([
  {
    key: "x-1",
    type: "totally_made_up_type",
    title: "ชนิดรายการที่ไม่มีในสัญญา",
    description: "type ไม่อยู่ใน 14 ประเภทที่รองรับ",
    evidence_class: "assumed",
    origin: "source_analysis",
    confidence: 0.5,
    rationale: "ข้อสันนิษฐาน",
    source_references: [],
  },
]);

/** schema_error: an unknown field on an otherwise valid item. */
export const unknownField = envelope([
  {
    key: "br-1",
    type: "business_requirement",
    title: "รายการที่มี field แปลกปลอม",
    description: "มี field ที่ไม่ได้อยู่ในสัญญา",
    evidence_class: "assumed",
    origin: "source_analysis",
    confidence: 0.5,
    rationale: "ข้อสันนิษฐาน",
    unexpected_field: "should be rejected",
    source_references: [],
  },
]);

/** evidence_error: a domain_profile-origin item claims 'stated'. */
export const domainProfileStatedFact = envelope([
  {
    key: "q-1",
    type: "open_question",
    title: "คำถามจากโดเมนที่แอบอ้างเป็นข้อเท็จจริง",
    description: "origin เป็น domain_profile แต่ evidence_class เป็น stated",
    evidence_class: "stated",
    origin: "domain_profile",
    confidence: 0.5,
    attributes: { category: "การคืนเงิน", blocks_keys: [] },
    source_references: [okReference()],
  },
]);
