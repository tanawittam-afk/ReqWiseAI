/**
 * The runtime mock strategy: arbitrary source text in, structured provider output out.
 *
 * This replaces the fixture-replay behaviour the mock shipped with in slice 4, which
 * only produced a usable analysis when the source happened to be byte-identical to
 * `fixtures/booking-smart-space.source.ts`. It is still a *mock*: rule-based, not a
 * model. What it now is, that it was not before, is **a function of its input**.
 *
 * Three properties it must keep, in order of importance:
 *
 *  1. **Deterministic.** No `Date.now`, no `Math.random`, no network, no environment.
 *     Same input → byte-identical output (AI-OUTPUT-CONTRACT.md §D.9).
 *  2. **Honest about evidence.** Anything traced to the text cites an exact span of
 *     the real text. Anything that comes from the domain profile is `assumed` or an
 *     open question, never `stated`, and never carries a citation — a profile knowing
 *     that booking systems usually have a refund policy is not a fact about *this*
 *     client (§D.6).
 *  3. **Untrusted.** Output goes through `validateAnalysis` exactly like a real
 *     provider's. There is no fast path, and this module never imports validation.
 *
 * Domain knowledge lives in `lexicon.ts` (strategy-local) and in the domain profile
 * row loaded from the database — never in the core engine.
 */

import type { AnalysisInput, OutputLang, SourceDocumentInput } from "../../../contracts/analysis-input";
import { PROVIDER_SCHEMA_VERSION } from "../../../contracts/provider-output.ts";
import {
  CLARIFIABLE,
  conceptsIn,
  matchesProfileVocabulary,
  profileVocabulary,
  type Concept,
} from "./lexicon.ts";
import { bestMatch, firstMatch, segmentSource, type Segment } from "./segments.ts";

// --- output shaping ---------------------------------------------------------

type Citation = {
  source_document_key: string;
  excerpt: string;
  start_offset: number;
  end_offset: number;
  evidence_strength?: number;
};

type Item = Record<string, unknown> & { key: string; type: string };

/** A typed edge, shaped for `providerRelationSchema`. Untyped here for the same reason
 *  `Item` is: this module emits raw provider output and is not trusted to type it. */
type Relation = { from_key: string; to_key: string; type: string };

const TITLE_MAX = 160;

function clip(value: string, max: number): string {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

/** A citation built from a real span. Offsets are the segment's own, never searched for. */
function cite(doc: SourceDocumentInput, segment: Segment, strength?: number): Citation {
  return {
    source_document_key: doc.key,
    excerpt: segment.excerpt,
    start_offset: segment.start,
    end_offset: segment.end,
    ...(strength === undefined ? {} : { evidence_strength: strength }),
  };
}

// --- language ---------------------------------------------------------------

type Labels = {
  problem: (s: string) => string;
  objective: string;
  objectiveBody: string;
  objectiveWhy: string;
  stakeholder: (role: string) => string;
  stakeholderRole: Record<"customer" | "staff", string>;
  requirement: (s: string) => string;
  functional: (s: string) => string;
  story: string;
  storyBody: (s: string) => string;
  storyWhy: string;
  asA: string;
  iWant: (s: string) => string;
  soThat: string;
  criterion: string;
  given: string;
  when: string;
  then: (s: string) => string;
  criterionWhy: string;
  questionStated: (topic: string) => string;
  questionStatedBody: string;
  questionProfile: (topic: string) => string;
  questionProfileBody: string;
  questionWhy: string;
  assumption: (topic: string) => string;
  assumptionBody: string;
  assumptionWhy: string;
  risk: (s: string) => string;
  riskWhy: string;
  nfr: (s: string) => string;
  nfrWhy: string;
  nfrCategory: string;
  rule: (s: string) => string;
  ruleWhy: string;
  findingIncomplete: string;
  findingAmbiguous: string;
  findingBody: string;
  findingWhy: string;
  topic: Record<Concept, string>;
  genericTopic: string;
};

const TH: Labels = {
  problem: (s) => `ปัญหาที่ต้องแก้: ${s}`,
  objective: "ทำให้ความต้องการหลักในเอกสารนี้เกิดขึ้นได้จริง",
  objectiveBody:
    "เป้าหมายทางธุรกิจที่อนุมานจากสิ่งที่ผู้มีส่วนได้เสียระบุไว้ในแหล่งข้อมูลนี้ ยังต้องยืนยันตัวชี้วัดความสำเร็จกับผู้มีส่วนได้เสีย",
  objectiveWhy: "อนุมานจากข้อความที่อ้างอิง ซึ่งบอกสิ่งที่ต้องการให้ระบบทำ แต่ไม่ได้ระบุเป้าหมายทางธุรกิจไว้ตรง ๆ",
  stakeholder: (role) => `ผู้มีส่วนได้เสีย: ${role}`,
  stakeholderRole: { customer: "ลูกค้า", staff: "พนักงาน" },
  requirement: (s) => `ความต้องการทางธุรกิจ: ${s}`,
  functional: (s) => `ความสามารถของระบบ: ${s}`,
  story: "เรื่องราวผู้ใช้จากความสามารถที่ระบุไว้",
  storyBody: (s) => `ในฐานะผู้ใช้ ฉันต้องการ ${s}`,
  storyWhy: "อนุมานจากความสามารถที่ระบุไว้ในข้อความที่อ้างอิง โดยแปลงเป็นมุมมองของผู้ใช้",
  asA: "ผู้ใช้",
  iWant: (s) => clip(s, 500),
  soThat: "ทำงานตามที่ระบุไว้ในแหล่งข้อมูลได้สำเร็จ",
  criterion: "เกณฑ์การยอมรับของความสามารถนี้",
  given: "ผู้ใช้อยู่ในระบบและมีสิทธิ์ใช้งานความสามารถนี้",
  when: "ผู้ใช้ทำงานตามที่ระบุไว้",
  then: (s) => clip(`ระบบทำงานได้ตามที่ระบุไว้ว่า ${s}`, 500),
  criterionWhy: "อนุมานเป็นเกณฑ์ที่ทดสอบได้จากความสามารถที่ระบุไว้ ยังต้องให้ผู้มีส่วนได้เสียยืนยันเกณฑ์ที่แท้จริง",
  questionStated: (topic) => `ยังไม่มีข้อสรุปเรื่อง${topic}`,
  questionStatedBody:
    "แหล่งข้อมูลระบุเองว่าประเด็นนี้ยังไม่ได้ข้อสรุป จึงต้องถามผู้มีส่วนได้เสียก่อนออกแบบขั้นตอนที่เกี่ยวข้อง",
  questionProfile: (topic) => `ต้องสอบถามเรื่อง${topic}`,
  questionProfileBody:
    "โดเมนนี้มักต้องมีนโยบายเรื่องดังกล่าว แต่แหล่งข้อมูลไม่ได้กล่าวถึง จึงเป็นคำถามที่ต้องถาม ไม่ใช่ข้อเท็จจริง",
  questionWhy: "มาจากหมวดที่ต้องสอบถามในโปรไฟล์โดเมน ไม่ใช่ข้อเท็จจริงจากลูกค้ารายนี้",
  assumption: (topic) => `สันนิษฐานเรื่อง${topic}จนกว่าจะได้ข้อสรุป`,
  assumptionBody:
    "ข้อสันนิษฐานชั่วคราวเพื่อให้ออกแบบต่อได้ ต้องยืนยันกับผู้มีส่วนได้เสียก่อนนำไปพัฒนา",
  assumptionWhy: "แหล่งข้อมูลไม่ได้ระบุเรื่องนี้ไว้ จึงเป็นข้อสันนิษฐาน ไม่ใช่ข้อเท็จจริง และไม่มีการอ้างอิงประกอบ",
  risk: (s) => `ความเสี่ยง: ${s}`,
  riskWhy: "มาจากความเสี่ยงที่พบบ่อยในโปรไฟล์โดเมน ยังไม่ได้รับการยืนยันว่าเกิดกับลูกค้ารายนี้",
  nfr: (s) => `ข้อกำหนดที่ไม่ใช่ฟังก์ชัน: ${s}`,
  nfrWhy: "มาจากข้อเสนอแนะในโปรไฟล์โดเมน แหล่งข้อมูลยังไม่ได้ระบุเกณฑ์นี้ไว้",
  nfrCategory: "แนวทางจากโดเมน",
  rule: (s) => `กฎทางธุรกิจที่ต้องยืนยัน: ${s}`,
  ruleWhy: "มาจากกฎที่พบบ่อยในโปรไฟล์โดเมน ต้องยืนยันกับผู้มีส่วนได้เสียก่อนถือเป็นข้อกำหนด",
  findingIncomplete: "ข้อมูลยังไม่ครบสำหรับออกแบบให้ทดสอบได้",
  findingAmbiguous: "ข้อความยังกำกวมเกินกว่าจะทดสอบได้",
  findingBody:
    "ข้อกำหนดที่อ้างอิงยังไม่มีเกณฑ์ที่วัดผลได้ชัดเจน ทำให้เขียนกรณีทดสอบที่ตรวจสอบได้ยาก",
  findingWhy: "กฎคุณภาพ: ข้อกำหนดที่ไม่มีเกณฑ์วัดผลถือว่ายังทดสอบไม่ได้",
  topic: {
    booking: "การจอง",
    staff: "งานของพนักงาน",
    customer: "ข้อมูลลูกค้า",
    payment: "การชำระเงิน",
    cancellation: "การยกเลิก",
    refund: "การคืนเงิน",
    notification: "การแจ้งเตือน",
    checkin: "การเช็กอิน",
    reporting: "การรายงานผล",
    unresolved: "ประเด็นที่ยังไม่สรุป",
    obligation: "สิ่งที่ระบบต้องทำ",
  },
  genericTopic: "ขอบเขตที่ยังไม่ชัดเจน",
};

const EN: Labels = {
  problem: (s) => `Problem to solve: ${s}`,
  objective: "Deliver the primary need described in this source",
  objectiveBody:
    "A business objective inferred from what stakeholders described in this source. Success measures still need to be confirmed with the stakeholders.",
  objectiveWhy:
    "Inferred from the cited text, which states what the system should do without stating the business goal behind it.",
  stakeholder: (role) => `Stakeholder: ${role}`,
  stakeholderRole: { customer: "Customer", staff: "Staff" },
  requirement: (s) => `Business requirement: ${s}`,
  functional: (s) => `System capability: ${s}`,
  story: "User story derived from the stated capability",
  storyBody: (s) => `As a user, I want ${s}`,
  storyWhy: "Inferred from the capability stated in the cited text, restated from the user's point of view.",
  asA: "User",
  iWant: (s) => clip(s, 500),
  soThat: "the task described in the source can be completed",
  criterion: "Acceptance criterion for this capability",
  given: "the user is signed in and permitted to use this capability",
  when: "the user performs the described task",
  then: (s) => clip(`the system behaves as described: ${s}`, 500),
  criterionWhy:
    "Inferred as a testable criterion from the stated capability. The real threshold still needs stakeholder confirmation.",
  questionStated: (topic) => `No decision yet on ${topic}`,
  questionStatedBody:
    "The source itself says this point is unresolved, so it must be confirmed with stakeholders before the related flow is designed.",
  questionProfile: (topic) => `Clarification needed on ${topic}`,
  questionProfileBody:
    "This domain normally requires a policy here, but the source does not mention it. That makes it a question to ask, not a fact.",
  questionWhy: "Raised from a required clarification category in the domain profile, not from anything this client said.",
  assumption: (topic) => `Assumption about ${topic} pending a decision`,
  assumptionBody:
    "A working assumption so design can continue. It must be confirmed with stakeholders before it is built.",
  assumptionWhy:
    "The source does not address this, so it is an assumption rather than a fact, and it carries no citation.",
  risk: (s) => `Risk: ${s}`,
  riskWhy: "Taken from the domain profile's common risks. It has not been confirmed for this client.",
  nfr: (s) => `Non-functional requirement: ${s}`,
  nfrWhy: "Suggested by the domain profile. The source does not state this threshold.",
  nfrCategory: "Domain guidance",
  rule: (s) => `Business rule to confirm: ${s}`,
  ruleWhy:
    "Taken from the domain profile's common business rules. It must be confirmed before it counts as a requirement.",
  findingIncomplete: "Not enough detail to design something testable",
  findingAmbiguous: "Wording is too ambiguous to test",
  findingBody:
    "The cited requirement has no measurable threshold, which makes a verifiable test case hard to write.",
  findingWhy: "Quality rule: a requirement with no measurable criterion is not yet testable.",
  topic: {
    booking: "booking",
    staff: "staff operations",
    customer: "customer data",
    payment: "payment",
    cancellation: "cancellation",
    refund: "refunds",
    notification: "notifications",
    checkin: "check-in",
    reporting: "reporting",
    unresolved: "the unresolved points",
    obligation: "what the system must do",
  },
  genericTopic: "the undefined scope",
};

function labelsFor(lang: OutputLang): Labels {
  return lang === "th" ? TH : EN;
}

// --- the strategy -----------------------------------------------------------

const EMPTY = { schema_version: PROVIDER_SCHEMA_VERSION, items: [] as Item[] };

/**
 * Builds raw provider output for whatever source text it is given.
 *
 * Returns the empty envelope when there is nothing to analyse. That fails the
 * schema's `items.min(1)` downstream and surfaces as an honest `invalid` run rather
 * than as an analysis of nothing — the mock does not invent content it has no basis
 * for.
 */
export function generateRuntimeAnalysis(input: AnalysisInput): unknown {
  const doc = input.sourceDocuments[0];
  if (!doc) return { ...EMPTY };

  const segments = segmentSource(doc.text);
  if (segments.length === 0) return { ...EMPTY };

  const L = labelsFor(input.outputLang);
  const profile = input.domainProfile;
  const vocabulary = profileVocabulary(profile);
  const concepts = new Map<number, Set<Concept>>(
    segments.map((segment) => [segment.index, conceptsIn(segment)]),
  );
  const has = (segment: Segment, concept: Concept) => concepts.get(segment.index)?.has(concept) ?? false;
  const conceptCount = (segment: Segment) => concepts.get(segment.index)?.size ?? 0;

  const items: Item[] = [];
  const assumedKeys: string[] = [];

  // --- 1. problem statement — the opening of the document, cited exactly --------
  const opening = segments[0];
  items.push({
    key: "ps-1",
    type: "problem_statement",
    title: clip(L.problem(opening.excerpt), TITLE_MAX),
    description: opening.excerpt,
    evidence_class: "stated",
    origin: "source_analysis",
    confidence: 0.72,
    source_references: [cite(doc, opening, 0.8)],
  });

  // --- 2. requirements — the segments that express an obligation ---------------
  // The business requirement is the *first* stated obligation: notes lead with the
  // primary need, and "the first thing the document asks for" is a rule a reader can
  // check by eye. The functional requirement then takes the strongest *other*
  // obligation, favouring operational language, so a document describing both a
  // customer-facing need and a staff-facing one yields both rather than one twice.
  const businessSegment = firstMatch(segments, (s) => has(s, "obligation")) ?? opening;

  const operationalScore = (segment: Segment) => {
    if (segment.index === businessSegment.index) return 0;
    return (
      (has(segment, "obligation") ? 4 : 0) +
      (has(segment, "staff") ? 3 : 0) +
      (matchesProfileVocabulary(segment, vocabulary) ? 2 : 0) +
      conceptCount(segment)
    );
  };
  const functionalSegment = bestMatch(segments, operationalScore) ?? businessSegment;

  items.push({
    key: "br-1",
    type: "business_requirement",
    title: clip(L.requirement(businessSegment.excerpt), TITLE_MAX),
    description: businessSegment.excerpt,
    evidence_class: "stated",
    origin: "source_analysis",
    confidence: 0.86,
    priority: "high",
    source_references: [cite(doc, businessSegment, 0.9)],
  });

  items.push({
    key: "fr-1",
    type: "functional_requirement",
    title: clip(L.functional(functionalSegment.excerpt), TITLE_MAX),
    description: functionalSegment.excerpt,
    evidence_class: "stated",
    origin: "source_analysis",
    confidence: 0.84,
    priority: "high",
    source_references: [cite(doc, functionalSegment, 0.88)],
  });

  // --- 3. business objective — inferred, so it needs a reason and a citation ---
  items.push({
    key: "obj-1",
    type: "business_objective",
    title: clip(L.objective, TITLE_MAX),
    description: L.objectiveBody,
    evidence_class: "inferred",
    origin: "source_analysis",
    confidence: 0.64,
    rationale: L.objectiveWhy,
    source_references: [cite(doc, businessSegment)],
  });

  // --- 4. stakeholders — only those the text actually names --------------------
  const actors: Array<{ concept: "customer" | "staff"; key: string }> = [
    { concept: "customer", key: "stk-customer" },
    { concept: "staff", key: "stk-staff" },
  ];
  for (const actor of actors) {
    // First mention, not strongest: an actor is introduced where they first appear,
    // and citing that keeps two different stakeholders pointing at two different
    // sentences instead of both at whichever line happens to be busiest.
    const segment = firstMatch(segments, (s) => has(s, actor.concept));
    if (!segment) continue;
    items.push({
      key: actor.key,
      type: "stakeholder",
      title: clip(L.stakeholder(L.stakeholderRole[actor.concept]), TITLE_MAX),
      description: segment.excerpt,
      evidence_class: "stated",
      origin: "source_analysis",
      confidence: 0.8,
      attributes: { role: L.stakeholderRole[actor.concept] },
      source_references: [cite(doc, segment, 0.75)],
    });
  }
  // A profile-derived stakeholder when the text names nobody — assumed, never stated.
  if (!items.some((i) => i.type === "stakeholder") && profile.typicalStakeholders.length > 0) {
    items.push({
      key: "stk-profile",
      type: "stakeholder",
      title: clip(L.stakeholder(profile.typicalStakeholders[0]), TITLE_MAX),
      description: L.assumptionBody,
      evidence_class: "assumed",
      origin: "domain_profile",
      confidence: 0.4,
      rationale: L.questionWhy,
      attributes: { role: clip(profile.typicalStakeholders[0], 120) },
    });
    assumedKeys.push("stk-profile");
  }

  // --- 5. user story and acceptance criterion — inferred from the capability ----
  items.push({
    key: "us-1",
    type: "user_story",
    title: clip(L.story, TITLE_MAX),
    description: clip(L.storyBody(functionalSegment.excerpt), 4000),
    evidence_class: "inferred",
    origin: "source_analysis",
    confidence: 0.7,
    rationale: L.storyWhy,
    attributes: {
      as_a: L.asA,
      i_want: L.iWant(functionalSegment.excerpt),
      so_that: L.soThat,
    },
    source_references: [cite(doc, functionalSegment)],
  });

  items.push({
    key: "ac-1",
    type: "acceptance_criterion",
    title: clip(L.criterion, TITLE_MAX),
    description: clip(L.then(functionalSegment.excerpt), 4000),
    evidence_class: "inferred",
    origin: "source_analysis",
    confidence: 0.66,
    rationale: L.criterionWhy,
    attributes: { given: L.given, when: L.when, then: L.then(functionalSegment.excerpt) },
    source_references: [cite(doc, functionalSegment)],
  });

  // --- 6. open questions ------------------------------------------------------
  // Two kinds, and the difference matters: a topic the source itself flags as
  // unresolved is `stated` and cites the sentence that says so; a topic only the
  // domain profile raises is `assumed` with no citation at all.
  const questionKeys: string[] = [];
  const raisedTopics = new Set<Concept>();

  for (const concept of CLARIFIABLE) {
    const segment = bestMatch(segments, (s) =>
      has(s, concept) ? (has(s, "unresolved") ? 10 : 1) : 0,
    );
    if (!segment || !has(segment, "unresolved")) continue;

    const key = `q-${concept}`;
    raisedTopics.add(concept);
    questionKeys.push(key);
    items.push({
      key,
      type: "open_question",
      title: clip(L.questionStated(L.topic[concept]), TITLE_MAX),
      description: L.questionStatedBody,
      evidence_class: "stated",
      origin: "source_analysis",
      confidence: 0.78,
      attributes: { category: clip(L.topic[concept], 60), blocks_keys: [] },
      source_references: [cite(doc, segment, 0.85)],
    });
  }

  // --- 7. domain-profile guidance — assumptions and the questions that pair them
  // A profile category is worth raising only when the source has not already raised
  // it. Coverage is decided by the category's own words, so editing a profile changes
  // which questions appear without touching this code.
  const alreadyRaised = [...raisedTopics].map((concept) => concept.toLowerCase());
  const unmentioned = profile.requiredClarificationCategories
    .filter((category) => {
      const text = category.toLowerCase();
      return !alreadyRaised.some((concept) => text.includes(concept));
    })
    .slice(0, 2);

  const assumptionTopic = unmentioned[0] ?? L.genericTopic;

  items.push({
    key: "asm-1",
    type: "assumption",
    title: clip(L.assumption(clip(assumptionTopic, 60)), TITLE_MAX),
    description: L.assumptionBody,
    evidence_class: "assumed",
    origin: profile.requiredClarificationCategories.length > 0 ? "domain_profile" : "source_analysis",
    confidence: 0.38,
    rationale: L.assumptionWhy,
  });
  assumedKeys.push("asm-1");

  for (const [index, category] of unmentioned.entries()) {
    const key = `q-profile-${index + 1}`;
    questionKeys.push(key);
    items.push({
      key,
      type: "open_question",
      title: clip(L.questionProfile(clip(category, 60)), TITLE_MAX),
      description: L.questionProfileBody,
      evidence_class: "assumed",
      origin: "domain_profile",
      confidence: 0.5,
      rationale: L.questionWhy,
      attributes: { category: clip(category, 60), blocks_keys: [] },
    });
  }

  if (profile.commonRisks.length > 0) {
    items.push({
      key: "risk-1",
      type: "risk",
      title: clip(L.risk(profile.commonRisks[0]), TITLE_MAX),
      description: clip(profile.commonRisks[0], 4000),
      evidence_class: "assumed",
      origin: "domain_profile",
      confidence: 0.45,
      rationale: L.riskWhy,
      attributes: { impact: 4, likelihood: 3, mitigation: clip(L.riskWhy, 1000) },
    });
    assumedKeys.push("risk-1");
  }

  if (profile.suggestedNonFunctionalRequirements.length > 0) {
    items.push({
      key: "nfr-1",
      type: "non_functional_requirement",
      title: clip(L.nfr(profile.suggestedNonFunctionalRequirements[0]), TITLE_MAX),
      description: clip(profile.suggestedNonFunctionalRequirements[0], 4000),
      evidence_class: "assumed",
      origin: "domain_profile",
      confidence: 0.42,
      rationale: L.nfrWhy,
      attributes: { category: clip(L.nfrCategory, 60) },
    });
    assumedKeys.push("nfr-1");
  }

  if (profile.commonBusinessRules.length > 0) {
    items.push({
      key: "rule-1",
      type: "business_rule",
      title: clip(L.rule(profile.commonBusinessRules[0]), TITLE_MAX),
      description: clip(profile.commonBusinessRules[0], 4000),
      evidence_class: "assumed",
      origin: "domain_profile",
      confidence: 0.44,
      rationale: L.ruleWhy,
    });
    assumedKeys.push("rule-1");
  }

  // --- 8. a quality finding on the requirement, from the quality rule ----------
  const incomplete = raisedTopics.size > 0;
  items.push({
    key: "qf-1",
    type: "quality_finding",
    title: clip(incomplete ? L.findingIncomplete : L.findingAmbiguous, TITLE_MAX),
    description: L.findingBody,
    evidence_class: "inferred",
    origin: "quality_rule",
    confidence: 0.45,
    rationale: L.findingWhy,
    attributes: {
      finding: incomplete ? "incomplete" : "ambiguous",
      target_keys: ["br-1"],
    },
    source_references: [cite(doc, businessSegment)],
  });

  // --- 9. pair every assumption with a question -------------------------------
  // AI-OUTPUT-CONTRACT.md §D.6: an unsupported claim must always leave a question
  // behind for a stakeholder. If nothing above raised one, raise one now rather than
  // shipping an orphaned assumption.
  if (questionKeys.length === 0) {
    const key = "q-scope";
    questionKeys.push(key);
    items.push({
      key,
      type: "open_question",
      title: clip(L.questionProfile(L.genericTopic), TITLE_MAX),
      description: L.questionProfileBody,
      evidence_class: "assumed",
      origin: "domain_profile",
      confidence: 0.5,
      rationale: L.questionWhy,
      attributes: { category: clip(L.genericTopic, 60), blocks_keys: [] },
    });
  }

  // Prefer a profile-raised question as the blocker: the assumptions above came from
  // profile guidance, so the question that pairs them should be the one asking about
  // that guidance, not a topic the source happened to flag itself.
  const blockerKey = questionKeys.find((key) => key.startsWith("q-profile-")) ?? questionKeys[0];
  const blocker = items.find((i) => i.key === blockerKey);
  if (blocker) {
    const attributes = blocker.attributes as { category: string; blocks_keys: string[] };
    attributes.blocks_keys = assumedKeys.filter((key) => key !== blocker.key);
  }

  // --- 10. typed traceability (slice 6B) --------------------------------------
  // Every edge is authored parent → child, in the direction its label reads. The
  // pre-6B mock emitted the same chain the other way round as `related_item_keys`,
  // which the persistence layer then stored as `derives_from` — a relationship name
  // the strategy had never chosen. Choosing it here is the point of the slice.
  //
  // Nothing is emitted speculatively: `relate()` drops an edge whose endpoints this
  // particular source did not produce. A source that names no business rule gets no
  // `constrained_by` row, and inventing one to make the map look fuller would be the
  // same failure as inventing the item.
  const present = new Set(items.map((i) => i.key));
  const relations: Relation[] = [];
  const emitted = new Set<string>();

  function relate(fromKey: string, toKey: string, type: string): void {
    if (fromKey === toKey) return;
    if (!present.has(fromKey) || !present.has(toKey)) return;
    const signature = `${fromKey} ${toKey} ${type}`;
    if (emitted.has(signature)) return;
    emitted.add(signature);
    relations.push({ from_key: fromKey, to_key: toKey, type });
  }

  // The spine.
  relate("obj-1", "br-1", "supports");
  relate("br-1", "fr-1", "implemented_by");
  relate("br-1", "nfr-1", "implemented_by");
  relate("fr-1", "us-1", "expressed_as");
  relate("us-1", "ac-1", "validated_by");

  // What limits the spine, and what makes the profile's risk less likely.
  relate("fr-1", "rule-1", "constrained_by");
  relate("rule-1", "risk-1", "mitigates");

  // Observations, raised by the observation itself. A question's own `blocks_keys`
  // already names what it holds up, so the relation is read from there rather than
  // invented alongside it — one decision, two representations, no way to disagree.
  for (const key of questionKeys) {
    const question = items.find((i) => i.key === key);
    const blocks = (question?.attributes as { blocks_keys?: string[] } | undefined)?.blocks_keys ?? [];
    for (const target of blocks) relate(key, target, "raises_question");
  }

  const finding = items.find((i) => i.key === "qf-1");
  const targets = (finding?.attributes as { target_keys?: string[] } | undefined)?.target_keys ?? [];
  for (const target of targets) relate("qf-1", target, "flags_quality_issue");

  return { schema_version: PROVIDER_SCHEMA_VERSION, items, relations };
}
