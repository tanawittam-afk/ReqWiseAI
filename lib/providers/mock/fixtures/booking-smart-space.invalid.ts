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

import { PROVIDER_SCHEMA_VERSION } from "../../../contracts/provider-output.ts";
import { BOOKING_SOURCE_KEY, citation } from "./booking-smart-space.source.ts";

const okReference = () => citation("จองซ้ำห้องเดียวกันสองรายในเวลาเดียวกัน");

function envelope(items: unknown[], relations: unknown[] = []) {
  return { schema_version: PROVIDER_SCHEMA_VERSION, items, relations };
}

/** A minimal, individually-valid item of any type, for the relation fixtures below. */
function item(key: string, type: string, extra: Record<string, unknown> = {}) {
  return {
    key,
    type,
    title: `รายการทดสอบ ${key}`,
    description: `รายการที่ถูกต้องในตัวเอง ใช้เพื่อทดสอบกฎความสัมพันธ์ (${type})`,
    evidence_class: "assumed",
    origin: "source_analysis",
    confidence: 0.5,
    rationale: "ข้อสันนิษฐาน — ใช้เป็นปลายทางของความสัมพันธ์ในชุดทดสอบ",
    source_references: [],
    ...extra,
  };
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

/** relation_error: a typed relation points at a key that does not exist. */
export const unknownRelationKey = envelope(
  [item("br-1", "business_requirement")],
  [{ from_key: "br-1", to_key: "fr-missing", type: "implemented_by" }],
);

/**
 * relation_error: the deprecated untyped edge list. Still parses — pre-6B raw output
 * is stored verbatim and must stay readable — but a *new* run may not use it, because
 * every entry became a `derives_from` row asserting a relationship nobody stated.
 */
export const untypedRelationKeys = envelope([
  item("br-1", "business_requirement"),
  item("fr-1", "functional_requirement", { related_item_keys: ["br-1"] }),
]);

/** relation_error: the relation type does not describe this pair of item types. */
export const invalidRelationPair = envelope(
  [item("br-1", "business_requirement"), item("ac-1", "acceptance_criterion", {
    attributes: { then: "ระบบยืนยันการจองทันที" },
  })],
  // `implemented_by` runs business_requirement → functional/non-functional requirement.
  // An acceptance criterion is validated_by territory, not implemented_by.
  [{ from_key: "br-1", to_key: "ac-1", type: "implemented_by" }],
);

/** relation_error: an item pointed at itself. */
export const selfRelation = envelope(
  [item("br-1", "business_requirement")],
  [{ from_key: "br-1", to_key: "br-1", type: "related_to" }],
);

/** relation_error: the same (from, to, type) triple twice. */
export const duplicateRelation = envelope(
  [item("br-1", "business_requirement"), item("fr-1", "functional_requirement")],
  [
    { from_key: "br-1", to_key: "fr-1", type: "implemented_by" },
    { from_key: "br-1", to_key: "fr-1", type: "implemented_by" },
  ],
);

/**
 * relation_error: the hierarchical spine loops.
 *
 * **This fixture cannot be produced by a conforming provider, and that is the point.**
 * The four authored hierarchical types form a DAG over item types —
 * `business_objective → business_requirement → functional/non-functional requirement →
 * user_story → acceptance_criterion`, and an acceptance criterion has no outgoing
 * hierarchical edge — so no combination of them can close a loop. The pair matrix
 * prevents the cycle before the cycle check ever sees it.
 *
 * A cycle is reachable only two ways, and both are why the check exists:
 *
 *   1. through a **legacy** `derives_from` row, whose pair rule is `any` because the
 *      relationship it was standing in for cannot be re-derived;
 *   2. through a direct `INSERT` into `item_relations`, which RLS permits to any
 *      project member and which never passes through this validator at all — the
 *      database trigger in migration 19 is what catches that one.
 *
 * So the fixture is built with `derives_from` and is deliberately *not* parseable by
 * `providerOutputSchema`. It exercises `checkHierarchyCycles()` directly, on the shape
 * legacy data actually has.
 */
export const legacyHierarchyCycle = envelope(
  [item("br-1", "business_requirement"), item("fr-1", "functional_requirement")],
  [
    // Authored: BR sits above FR.
    { from_key: "br-1", to_key: "fr-1", type: "implemented_by" },
    // Legacy, written child → parent, and therefore saying BR sits *beneath* FR.
    // Canonicalising both to parent → child is what makes the contradiction a loop.
    { from_key: "br-1", to_key: "fr-1", type: "derives_from" },
  ],
);

/**
 * NOT invalid — the counter-example. Two `related_to` rows pointing opposite ways are
 * two ordinary observations, not a cycle, because `related_to` makes no parent/child
 * claim. Exported from the invalid module so the pair sits next to `hierarchyCycle`
 * and the difference is visible in one place.
 */
export const relatedToBothWays = envelope(
  [item("br-1", "business_requirement"), item("br-2", "business_requirement")],
  [
    { from_key: "br-1", to_key: "br-2", type: "related_to" },
    { from_key: "br-2", to_key: "br-1", type: "related_to" },
  ],
);

/** schema_error: a new run may not author the legacy relation type. */
export const legacyRelationTypeAuthored = envelope(
  [item("br-1", "business_requirement"), item("fr-1", "functional_requirement")],
  [{ from_key: "fr-1", to_key: "br-1", type: "derives_from" }],
);

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
