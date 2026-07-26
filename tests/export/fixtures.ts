/**
 * One hand-built `ExportInput`, small enough to reason about by eye and deliberately
 * containing every case the export has an opinion about.
 *
 * Built by hand rather than produced by the mock provider, for the same reason
 * `tests/traceability/fixtures.ts` is: these tests assert what the *document* says, so the
 * input has to be readable at a glance and has to hold the exact awkward cases — a Thai
 * multi-line description, a value that looks like a spreadsheet formula, a citation whose
 * offsets are wrong, a domain-profile item with no evidence, a legacy relation, an item in
 * every review status.
 *
 * Shape:
 *
 *   OBJ-001 (approved) ──supports──► BR-001 (approved) ──implemented_by──► FR-001 (reviewed)
 *   BR-002 (draft)          FR-002 (rejected, formula-looking title)
 *   NFR-001 (needs_clarification, from domain guidance — no citation)
 *   US-001 (approved) ──validated_by──► AC-001 (approved)
 *   BR-003 (approved) ──derives_from (legacy)──► OBJ-001
 *   Q-001 open · Q-002 answered · Q-003 deferred
 *   QF-001 open (ambiguous) · QF-002 resolved
 *   RISK-001 orphan
 */

import type {
  ExportActivityInput,
  ExportInput,
  ExportItemInput,
  ExportReferenceInput,
  ExportRelationInput,
  ExportSourceInput,
  ExportVersionInput,
} from "../../lib/export/types";
import type { ItemType } from "../../lib/contracts/item-types";
import type { RelationType } from "../../lib/contracts/relations";

export const PROJECT_ID = "11111111-1111-4111-8111-111111111111";
export const RUN_ID = "22222222-2222-4222-8222-222222222222";
export const SOURCE_ID = "33333333-3333-4333-8333-333333333333";
export const SOURCE_2_ID = "44444444-4444-4444-8444-444444444444";
export const GENERATED_AT = "2026-07-26T09:00:00.000Z";

/**
 * Thai source text with the excerpts at known offsets. Written as one string with explicit
 * newlines so an offset in a test is a fact about this constant and not about an editor.
 */
export const SOURCE_TEXT =
  "ลูกค้าต้องการจองห้องประชุมผ่านเว็บไซต์\n" + // 0–38 (39 chars incl. newline)
  "พนักงานต้องเห็นรายการจองและตรวจสอบลูกค้าที่มาเช็กอิน\n" +
  "ยังไม่ได้ข้อสรุปเรื่องการยกเลิกและการคืนเงิน";

/** The first line, sliced the way the citation claims. */
export const EXCERPT_ONE = SOURCE_TEXT.slice(0, 38);
export const EXCERPT_TWO = SOURCE_TEXT.slice(39, 91);

export function item(
  id: string,
  displayId: string,
  type: ItemType,
  overrides: Partial<ExportItemInput> = {},
): ExportItemInput {
  return {
    id,
    displayId,
    type,
    title: `${displayId} statement`,
    description: `${displayId} description`,
    priority: "medium",
    status: "draft",
    evidenceClass: "stated",
    origin: "source_analysis",
    confidence: 0.8,
    rationale: null,
    attributes: null,
    versionNo: 1,
    createdAt: "2026-07-20T10:00:00.000Z",
    workflowState: null,
    resolutionText: null,
    resolvedAt: null,
    followUpOn: null,
    analysisRunId: RUN_ID,
    ...overrides,
  };
}

export function relation(
  fromItemId: string,
  toItemId: string,
  type: RelationType,
): ExportRelationInput {
  return { fromItemId, toItemId, type, legacy: type === "derives_from" };
}

export function reference(
  itemId: string,
  overrides: Partial<ExportReferenceInput> = {},
): ExportReferenceInput {
  return {
    itemId,
    sourceDocumentId: SOURCE_ID,
    excerpt: EXCERPT_ONE,
    startOffset: 0,
    endOffset: 38,
    offsetVerified: true,
    ...overrides,
  };
}

const SOURCES: ExportSourceInput[] = [
  {
    id: SOURCE_ID,
    title: "ประชุมเก็บความต้องการ",
    kind: "meeting_notes",
    revisionNumber: 1,
    locked: true,
    sourceDate: "2026-07-18",
    createdAt: "2026-07-18T09:00:00.000Z",
    rawText: SOURCE_TEXT,
  },
  {
    id: SOURCE_2_ID,
    title: "Front desk follow-up",
    kind: "interview",
    revisionNumber: 2,
    locked: false,
    sourceDate: null,
    createdAt: "2026-07-19T09:00:00.000Z",
    rawText: "Staff asked for a same-day cancellation rule.",
  },
];

const ITEMS: ExportItemInput[] = [
  item("i-obj-1", "OBJ-001", "business_objective", { status: "approved", priority: "high" }),
  item("i-br-1", "BR-001", "business_requirement", {
    status: "approved",
    priority: "high",
    // Multi-line, Thai, and containing a comma and a quote — the CSV's whole problem set
    // in one field.
    description: 'ระบบต้องรองรับการจอง "ออนไลน์"\nและต้องยืนยันทันที, ไม่เกิน 3 วินาที',
    versionNo: 3,
  }),
  item("i-fr-1", "FR-001", "functional_requirement", {
    status: "reviewed",
    evidenceClass: "inferred",
    rationale: "The notes describe staff checking arrivals, which implies a list view.",
    confidence: 0.91,
  }),
  item("i-br-2", "BR-002", "business_requirement", { status: "draft" }),
  item("i-fr-2", "FR-002", "functional_requirement", {
    status: "rejected",
    // A leading "=" is what a spreadsheet would execute. It is legitimate requirement
    // text and must survive as text.
    title: "=SUM(A1:A9) must not be executed",
    description: "-1 discount is out of scope",
  }),
  item("i-nfr-1", "NFR-001", "non_functional_requirement", {
    status: "needs_clarification",
    origin: "domain_profile",
    evidenceClass: "assumed",
  }),
  item("i-us-1", "US-001", "user_story", { status: "approved" }),
  item("i-ac-1", "AC-001", "acceptance_criterion", { status: "approved" }),
  item("i-br-3", "BR-003", "business_requirement", { status: "approved" }),
  item("i-risk-1", "RISK-001", "risk", { status: "draft" }),
  item("i-q-1", "Q-001", "open_question", { workflowState: "open", origin: "quality_rule" }),
  item("i-q-2", "Q-002", "open_question", {
    workflowState: "answered",
    resolutionText: "ยกเลิกฟรีก่อน 24 ชั่วโมง",
    resolvedAt: "2026-07-24T08:00:00.000Z",
  }),
  item("i-q-3", "Q-003", "open_question", {
    workflowState: "deferred",
    resolutionText: "รอฝ่ายการเงินยืนยันนโยบายคืนเงิน",
    resolvedAt: "2026-07-24T09:00:00.000Z",
    followUpOn: "2026-08-15",
  }),
  item("i-qf-1", "QF-001", "quality_finding", {
    workflowState: "open",
    attributes: { finding_kind: "ambiguous" },
  }),
  item("i-qf-2", "QF-002", "quality_finding", {
    workflowState: "resolved",
    attributes: { finding_kind: "incomplete" },
    resolutionText: "Rewritten with a measurable threshold.",
    resolvedAt: "2026-07-25T10:00:00.000Z",
  }),
];

const RELATIONS: ExportRelationInput[] = [
  relation("i-obj-1", "i-br-1", "supports"),
  relation("i-br-1", "i-fr-1", "implemented_by"),
  relation("i-us-1", "i-ac-1", "validated_by"),
  // Written before typed relations existed: child → parent, and it stays that way.
  relation("i-br-3", "i-obj-1", "derives_from"),
  relation("i-q-1", "i-br-3", "raises_question"),
  relation("i-qf-1", "i-fr-1", "flags_quality_issue"),
];

const REFERENCES: ExportReferenceInput[] = [
  reference("i-br-1"),
  reference("i-fr-1", { excerpt: EXCERPT_TWO, startOffset: 39, endOffset: 91 }),
  reference("i-us-1", {
    sourceDocumentId: SOURCE_2_ID,
    excerpt: "same-day cancellation rule",
    startOffset: 18,
    endOffset: 44,
    offsetVerified: false,
  }),
  reference("i-q-2", { excerpt: EXCERPT_ONE, startOffset: 0, endOffset: 38 }),
];

const ACTIVITIES: ExportActivityInput[] = [
  { itemId: "i-br-1", label: "Marked as reviewed", comment: null, createdAt: "2026-07-22T10:00:00.000Z" },
  { itemId: "i-br-1", label: "Approved", comment: "Signed off with the client.", createdAt: "2026-07-23T10:00:00.000Z" },
  { itemId: "i-fr-1", label: "Marked as reviewed", comment: null, createdAt: "2026-07-22T11:00:00.000Z" },
  { itemId: "i-q-2", label: "Answered the question", comment: null, createdAt: "2026-07-24T08:00:00.000Z" },
];

const VERSIONS: ExportVersionInput[] = [
  { itemId: "i-br-1", versionNo: 1, changeReason: null, createdAt: "2026-07-20T10:00:00.000Z" },
  { itemId: "i-br-1", versionNo: 2, changeReason: "Tightened the wording", createdAt: "2026-07-21T10:00:00.000Z" },
];

export function exportInput(overrides: Partial<ExportInput> = {}): ExportInput {
  return {
    project: {
      id: PROJECT_ID,
      name: "Smart Space intake",
      description: "Booking and front-desk requirements",
      businessObjective: "ให้ลูกค้าจองเองได้",
      knownStakeholders: ["Front desk", "Finance"],
      domain: { key: "booking-smart-space", name: "Booking and Smart Space" },
      outputLang: "th",
      status: "active",
      archiveReason: null,
      createdAt: "2026-07-18T08:00:00.000Z",
      sourceCount: 2,
      analysisRunCount: 1,
    },
    sources: SOURCES,
    items: ITEMS,
    references: REFERENCES,
    relations: RELATIONS,
    activities: ACTIVITIES,
    versions: VERSIONS,
    ...overrides,
  };
}

/** The same project, archived — for the notice and the read-only behaviour. */
export function archivedInput(): ExportInput {
  const base = exportInput();
  return {
    ...base,
    project: {
      ...base.project,
      status: "archived",
      archiveReason: "Superseded by the 2027 intake",
    },
  };
}
