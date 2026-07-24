/**
 * The valid mock analysis for Booking and Smart Space.
 *
 * Constructed to exercise every branch downstream of it — all 14 item types,
 * all three evidence classes, all three origins, a low-confidence item, both
 * flavours of open question, a quality finding, and a full BR→FR→US→AC relation
 * chain. Its citations use exact offsets derived from the real source text.
 *
 * This object is raw, untrusted provider output. It is typed as `unknown` at the
 * boundary and must pass the same validation as any real provider — the tests
 * assert that it does.
 */

import { PROVIDER_SCHEMA_VERSION } from "../../../contracts/provider-output.ts";
import { citation } from "./booking-smart-space.source.ts";

export const bookingValidOutput = {
  schema_version: PROVIDER_SCHEMA_VERSION,
  items: [
    // --- problem_statement (stated) ---
    {
      key: "ps-manual-booking",
      type: "problem_statement",
      title: "การจองด้วยมือทำให้เกิดการจองซ้ำและงานซ้ำซ้อน",
      description:
        "ปัจจุบันรับจองผ่านไลน์และคีย์เข้า Excel ภายหลัง ทำให้เคยเกิดการจองซ้ำห้องเดียวกันจนต้องคืนเงินและเสียลูกค้า",
      evidence_class: "stated",
      origin: "source_analysis",
      confidence: 0.92,
      source_references: [
        citation(
          "เดือนที่แล้วจองซ้ำห้องเดียวกันสองรายในเวลาเดียวกัน ต้องคืนเงินลูกค้าและเสียลูกค้าประจำไปหนึ่งราย",
          0.95,
        ),
      ],
    },

    // --- business_objective (inferred) ---
    {
      key: "obj-self-service",
      type: "business_objective",
      title: "ให้ลูกค้าจองเองได้แบบเรียลไทม์เพื่อลดภาระหน้าร้าน",
      description:
        "เปิดให้ลูกค้าจองผ่านมือถือและเห็นห้องว่างทันที เพื่อลดงานคีย์ข้อมูลของพนักงานและความผิดพลาดจากการจองด้วยมือ",
      evidence_class: "inferred",
      origin: "source_analysis",
      confidence: 0.78,
      rationale:
        "อนุมานจากความต้องการให้ลูกค้าจองเองได้และเห็นห้องว่างเรียลไทม์ ประกอบกับปัญหางานคีย์ข้อมูลด้วยมือ",
      source_references: [citation("อยากให้ลูกค้าจองเองได้จากมือถือ และเห็นห้องว่างแบบเรียลไทม์")],
    },

    // --- stakeholder (stated, with attributes) ---
    {
      key: "stk-walkin",
      type: "stakeholder",
      title: "ลูกค้า Walk-in",
      description: "ลูกค้าที่เดินเข้ามาใช้บริการโดยไม่ได้จองล่วงหน้า คิดเป็นประมาณ 30% ของลูกค้า",
      evidence_class: "stated",
      origin: "source_analysis",
      confidence: 0.88,
      attributes: { role: "ลูกค้าที่ไม่ได้จองล่วงหน้า", interest: "ใช้บริการได้ทันทีที่หน้าร้าน", influence: "medium" },
      source_references: [
        citation("หน้าร้านยังต้องรับลูกค้า walk-in ได้อยู่ เพราะประมาณสามในสิบของลูกค้าเดินเข้ามาเลยไม่ได้จองล่วงหน้า"),
      ],
    },

    // --- business_requirement (stated) — head of the relation chain ---
    {
      key: "br-online-booking",
      type: "business_requirement",
      title: "ระบบต้องรองรับการจองออนไลน์แบบยืนยันทันที",
      description: "ลูกค้าต้องจองผ่านมือถือและได้รับการยืนยันห้องทันทีโดยไม่ต้องรอพนักงาน",
      evidence_class: "stated",
      origin: "source_analysis",
      confidence: 0.9,
      priority: "high",
      source_references: [
        citation("ถ้าลูกค้าจองแล้วต้องรู้ทันทีว่าได้ห้อง ไม่ต้องรอพนักงานยืนยัน"),
      ],
    },

    // --- functional_requirement (stated) — derives_from BR ---
    {
      key: "fr-realtime-availability",
      type: "functional_requirement",
      title: "แสดงห้องว่างแบบเรียลไทม์",
      description: "ระบบต้องแสดงสถานะห้องว่างตามการจองที่ยืนยันแล้วแบบเรียลไทม์",
      evidence_class: "stated",
      origin: "source_analysis",
      confidence: 0.9,
      priority: "high",
      related_item_keys: ["br-online-booking"],
      source_references: [citation("เห็นห้องว่างแบบเรียลไทม์")],
    },

    // --- non_functional_requirement (inferred, with attributes) ---
    {
      key: "nfr-mobile-checkin",
      type: "non_functional_requirement",
      title: "รองรับการใช้งานบนมือถือของพนักงาน",
      description: "ขั้นตอนเช็คอินต้องทำงานได้บนมือถือของพนักงานหน้าร้าน",
      evidence_class: "inferred",
      origin: "source_analysis",
      confidence: 0.72,
      attributes: { category: "usability", metric: "device support", target: "mobile web" },
      rationale: "อนุมานจากคำขอให้เช็คอินเร็วและระบบทำงานบนมือถือพนักงานได้",
      source_references: [citation("ระบบควรทำงานได้บนมือถือของพนักงานด้วย")],
    },

    // --- user_story (stated, with attributes) — derives_from FR ---
    {
      key: "us-customer-book",
      type: "user_story",
      title: "ลูกค้าจองห้องจากมือถือ",
      description: "ในฐานะลูกค้า ฉันต้องการจองห้องจากมือถือ เพื่อไม่ต้องรอพนักงานยืนยัน",
      evidence_class: "stated",
      origin: "source_analysis",
      confidence: 0.85,
      priority: "high",
      related_item_keys: ["fr-realtime-availability"],
      attributes: {
        as_a: "ลูกค้า",
        i_want: "จองห้องจากมือถือและรู้ผลทันที",
        so_that: "ไม่ต้องรอพนักงานยืนยัน",
      },
      source_references: [citation("อยากให้ลูกค้าจองเองได้จากมือถือ")],
    },

    // --- acceptance_criterion (stated, with attributes) — verifies US ---
    {
      key: "ac-instant-confirm",
      type: "acceptance_criterion",
      title: "ยืนยันการจองทันที",
      description: "เมื่อจองสำเร็จ ระบบยืนยันห้องให้ลูกค้าทันทีโดยไม่ต้องรอการยืนยันจากพนักงาน",
      evidence_class: "stated",
      origin: "source_analysis",
      confidence: 0.83,
      related_item_keys: ["us-customer-book"],
      attributes: {
        given: "ลูกค้าเลือกห้องว่างและยืนยันการจอง",
        when: "กดยืนยัน",
        then: "ระบบแสดงการยืนยันห้องทันทีโดยไม่ต้องรอพนักงาน",
      },
      source_references: [citation("ต้องรู้ทันทีว่าได้ห้อง ไม่ต้องรอพนักงานยืนยัน")],
    },

    // --- business_rule (stated) ---
    {
      key: "rule-no-double-book",
      type: "business_rule",
      title: "ห้ามจองซ้ำห้องเดียวกันในช่วงเวลาทับซ้อน",
      description: "ระบบต้องป้องกันไม่ให้ห้องเดียวกันถูกจองซ้ำในช่วงเวลาที่ทับซ้อนกัน",
      evidence_class: "stated",
      origin: "source_analysis",
      confidence: 0.87,
      source_references: [citation("จองซ้ำห้องเดียวกันสองรายในเวลาเดียวกัน")],
    },

    // --- assumption (assumed, no source, rationale required) ---
    {
      key: "asm-payment-online",
      type: "assumption",
      title: "สันนิษฐานว่าการชำระเงินจะทำผ่านช่องทางออนไลน์",
      description:
        "สันนิษฐานว่าระบบจะรองรับการชำระเงินออนไลน์ แม้ลูกค้ายังไม่ยืนยันจังหวะการเก็บเงิน",
      evidence_class: "assumed",
      origin: "source_analysis",
      confidence: 0.4,
      rationale:
        "ลูกค้ายังไม่ตัดสินใจเรื่องจังหวะการเก็บเงิน จึงเป็นข้อสันนิษฐาน ไม่ใช่ข้อเท็จจริง ต้องยืนยันกับผู้มีส่วนได้เสีย",
      related_item_keys: ["q-payment-timing"],
    },

    // --- risk (inferred, with attributes) ---
    {
      key: "risk-double-booking",
      type: "risk",
      title: "ความเสี่ยงการจองซ้ำภายใต้การจองพร้อมกัน",
      description: "หากไม่จัดการการจองพร้อมกัน อาจเกิดการจองซ้ำและต้องคืนเงินเหมือนที่เคยเกิด",
      evidence_class: "inferred",
      origin: "source_analysis",
      confidence: 0.7,
      attributes: { impact: 4, likelihood: 3, mitigation: "ล็อกสล็อตแบบ transactional ตอนยืนยันการจอง" },
      rationale: "อนุมานจากเหตุการณ์จองซ้ำที่เคยเกิดขึ้นและความต้องการยืนยันแบบเรียลไทม์",
      source_references: [citation("ต้องคืนเงินลูกค้าและเสียลูกค้าประจำไปหนึ่งราย")],
    },

    // --- constraint (stated) ---
    {
      key: "con-support-walkin",
      type: "constraint",
      title: "ต้องรองรับลูกค้า walk-in ต่อไป",
      description: "ระบบใหม่ต้องไม่ตัดความสามารถในการรับลูกค้า walk-in ที่หน้าร้าน",
      evidence_class: "stated",
      origin: "source_analysis",
      confidence: 0.86,
      source_references: [citation("หน้าร้านยังต้องรับลูกค้า walk-in ได้อยู่")],
    },

    // --- open_question A: from ambiguity in the source (has a reference) ---
    {
      key: "q-payment-timing",
      type: "open_question",
      title: "จะเก็บเงินตอนจองหรือตอนเข้าใช้?",
      description: "ลูกค้ายังไม่ตัดสินใจจังหวะการเก็บเงิน ต้องยืนยันก่อนออกแบบขั้นตอนการชำระเงิน",
      evidence_class: "stated",
      origin: "source_analysis",
      confidence: 0.8,
      attributes: { category: "การชำระเงิน", blocks_keys: ["asm-payment-online"] },
      source_references: [
        citation("อาจจะเก็บเงินตอนจองหรือตอนเข้าใช้ก็ได้ ขอกลับไปคุยกับหุ้นส่วนก่อน"),
      ],
    },

    // --- open_question B: raised by the domain profile (no reference) ---
    {
      key: "q-refund-policy",
      type: "open_question",
      title: "ยังไม่มีนโยบายการคืนเงินที่ชัดเจน",
      description:
        "โดเมนการจองมักต้องมีนโยบายคืนเงินที่ชัดเจน แต่ลูกค้ายังใช้ดุลพินิจหน้าร้านเป็นรายกรณี ต้องกำหนดให้ชัด",
      evidence_class: "assumed",
      origin: "domain_profile",
      confidence: 0.5,
      rationale:
        "โปรไฟล์โดเมนระบุว่านโยบายการคืนเงินเป็นหมวดที่ต้องสอบถาม คำถามนี้มาจากความรู้โดเมน ไม่ใช่ข้อเท็จจริงจากลูกค้ารายนี้",
      attributes: { category: "การคืนเงิน", blocks_keys: [] },
    },

    // --- quality_finding (quality_rule origin, low confidence, targets FR) ---
    {
      key: "qf-availability-untestable",
      type: "quality_finding",
      title: "\"เรียลไทม์\" ยังไม่มีเกณฑ์ที่วัดได้",
      description:
        "ข้อกำหนดเรื่องห้องว่างแบบเรียลไทม์ยังไม่ระบุเวลาหน่วงที่ยอมรับได้ ทำให้ทดสอบไม่ได้",
      evidence_class: "inferred",
      origin: "quality_rule",
      confidence: 0.45,
      rationale: "กฎคุณภาพ: ข้อกำหนดที่ไม่มีเกณฑ์วัดผลถือว่าไม่สามารถทดสอบได้",
      attributes: { finding: "untestable", target_keys: ["fr-realtime-availability"] },
      source_references: [citation("เห็นห้องว่างแบบเรียลไทม์")],
    },
  ],
} as const;
