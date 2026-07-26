# Smart Space intake — requirements

## Project summary

- **Project:** Smart Space intake
- **Business objective:** ให้ลูกค้าจองเองได้
- **Domain profile:** Booking and Smart Space
- **Output language:** Thai
- **Project status:** Active
- **Export scope:** Reviewed and approved
- **Generated at:** 2026-07-26T09:00:00.000Z
- **Source documents:** 2
- **Analysis runs:** 1
- **Requirements in this export:** 6
- **Approved:** 5
- **Outstanding questions:** 2
- **Unresolved quality findings:** 1
- **Export schema:** reqwise-export/1.0
- **Known stakeholders:** Front desk · Finance

## Contents

- [Business objectives](#business-objectives)
- [Business requirements](#business-requirements)
- [Functional requirements](#functional-requirements)
- [User stories](#user-stories)
- [Acceptance criteria](#acceptance-criteria)
- [Outstanding stakeholder questions](#outstanding-stakeholder-questions)
- [Resolved stakeholder questions](#resolved-stakeholder-questions)
- [Unresolved quality findings](#unresolved-quality-findings)
- [Resolved or dismissed findings](#resolved-or-dismissed-findings)
- [Traceability](#traceability)
- [Coverage summary](#coverage-summary)
- [Source appendix](#source-appendix)

## Business objectives

### OBJ-001 — OBJ-001 statement

- **Type:** Business objective
- **Priority:** High
- **Status:** Approved
- **Version:** 1
- **Evidence:** Stated
- **Origin:** Source analysis
- **Confidence:** 80%

OBJ-001 description

**Relations**

- is supported by BR-001
- is derived from by BR-003 *(legacy relation)*

**Review:** no review activity recorded

## Business requirements

### BR-001 — BR-001 statement

- **Type:** Business requirement
- **Priority:** High
- **Status:** Approved
- **Version:** 3 (human-edited)
- **Evidence:** Stated
- **Origin:** Source analysis
- **Confidence:** 80%

ระบบต้องรองรับการจอง "ออนไลน์"
และต้องยืนยันทันที, ไม่เกิน 3 วินาที

**Source evidence**

> ลูกค้าต้องการจองห้องประชุมผ่านเว็บไซต์

Source: ประชุมเก็บความต้องการ, meeting notes, revision 1, characters 0–38

**Relations**

- is implemented by FR-001
- supports OBJ-001

**Review:** Approved on 2026-07-23 · 2 recorded activities

### BR-003 — BR-003 statement

- **Type:** Business requirement
- **Priority:** Medium
- **Status:** Approved
- **Version:** 1
- **Evidence:** Stated
- **Origin:** Source analysis
- **Confidence:** 80%

BR-003 description

**Relations**

- derives from OBJ-001 *(legacy relation)*
- has a question raised by Q-001

**Review:** no review activity recorded

## Functional requirements

### FR-001 — FR-001 statement

- **Type:** Functional requirement
- **Priority:** Medium
- **Status:** Reviewed
- **Version:** 1
- **Evidence:** Inferred
- **Origin:** Source analysis
- **Confidence:** 91%

FR-001 description

**Why this was inferred:** The notes describe staff checking arrivals, which implies a list view.

**Source evidence**

> พนักงานต้องเห็นรายการจองและตรวจสอบลูกค้าที่มาเช็กอิน

Source: ประชุมเก็บความต้องการ, meeting notes, revision 1, characters 39–91

**Relations**

- implements BR-001
- has a quality issue flagged by QF-001

**Review:** Marked as reviewed on 2026-07-22 · 1 recorded activity

## User stories

### US-001 — US-001 statement

- **Type:** User story
- **Priority:** Medium
- **Status:** Approved
- **Version:** 1
- **Evidence:** Stated
- **Origin:** Source analysis
- **Confidence:** 80%

US-001 description

**Source evidence**

> same-day cancellation rule

Source: Front desk follow-up, stakeholder interview, revision 2, characters 18–44, span unverified

**Relations**

- is validated by AC-001

**Review:** no review activity recorded

## Acceptance criteria

### AC-001 — AC-001 statement

- **Type:** Acceptance criterion
- **Priority:** Medium
- **Status:** Approved
- **Version:** 1
- **Evidence:** Stated
- **Origin:** Source analysis
- **Confidence:** 80%

AC-001 description

**Relations**

- validates US-001

**Review:** no review activity recorded

## Outstanding stakeholder questions

### Q-001 — Q-001 statement

- **State:** Open
- **Origin:** Quality rule
- **Confidence:** 80%

Q-001 description

*Generated from domain guidance; no direct source evidence.*

**Relations**

- raises a question about BR-003

### Q-003 — Q-003 statement

- **State:** Deferred
- **Origin:** Source analysis
- **Confidence:** 80%
- **Follow up on:** 2026-08-15

Q-003 description

**Deferred because**

> รอฝ่ายการเงินยืนยันนโยบายคืนเงิน

Recorded 2026-07-24

## Resolved stakeholder questions

### Q-002 — Q-002 statement

- **State:** Answered
- **Origin:** Source analysis
- **Confidence:** 80%

Q-002 description

**Answer**

> ยกเลิกฟรีก่อน 24 ชั่วโมง

Recorded 2026-07-24

**Source evidence**

> ลูกค้าต้องการจองห้องประชุมผ่านเว็บไซต์

Source: ประชุมเก็บความต้องการ, meeting notes, revision 1, characters 0–38

## Unresolved quality findings

### QF-001 — QF-001 statement

- **Finding:** Ambiguous
- **State:** Open
- **Confidence:** 80%

QF-001 description

**Relations**

- flags a quality issue in FR-001

## Resolved or dismissed findings

### QF-002 — QF-002 statement

- **Finding:** Incomplete
- **State:** Resolved
- **Confidence:** 80%

QF-002 description

**Resolution**

> Rewritten with a measurable threshold.

Recorded 2026-07-25

## Traceability

| From | Relation | To | From status | To status |
| --- | --- | --- | --- | --- |
| BR-001 | is implemented by | FR-001 | approved | reviewed |
| BR-003 | derives from (legacy relation) | OBJ-001 | approved | approved |
| OBJ-001 | is supported by | BR-001 | approved | approved |
| Q-001 | raises a question about | BR-003 | draft | approved |
| QF-001 | flags a quality issue in | FR-001 | draft | reviewed |
| US-001 | is validated by | AC-001 | approved | approved |

## Coverage summary

Coverage is computed over the **whole project**, not over the exported scope.

| Indicator | Count |
| --- | --- |
| Total items | 15 |
| Linked items | 8 |
| Orphan items | 7 |
| Missing acceptance criteria | 0 |
| Items with source evidence | 4 |
| Approved requirements in this export | 5 |
| Open questions | 2 |
| Unresolved quality findings | 1 |

**Missing links and conflicts**

- **Functional requirements with no user story** (2) — This capability has not been expressed from a user's point of view.
  - FR-001, FR-002
- **Unresolved questions on approved items** (1) — This question is still open against an item already approved.
  - Q-001
- **Orphan items** (7) — No relation reaches this item in either direction.
  - BR-002, FR-002, NFR-001, Q-002, Q-003, QF-002, RISK-001
- **Requirements with no source evidence** (4) — No citation ties this requirement to the text it came from.
  - BR-002, BR-003, FR-002, NFR-001
- **Business requirements with no functional requirement** (2) — Nothing beneath this requirement says how the system delivers it.
  - BR-002, BR-003
- **Unresolved quality findings** (1) — This finding is still open or only acknowledged.
  - QF-001
- **Unresolved findings on reviewed or approved items** (1) — A quality issue is still outstanding on an item already signed off.
  - QF-001
- **Unresolved questions** (2) — This question is still open or deferred.
  - Q-001, Q-003

*Coverage indicators assist review and do not replace human judgment.*

## Source appendix

| Document | Type | Revision | Characters | Locked |
| --- | --- | --- | --- | --- |
| ประชุมเก็บความต้องการ | Meeting notes | 1 | 136 | Yes |
| Front desk follow-up | Stakeholder interview | 2 | 45 | No |

*Source documents are quoted only where an item cites them. The full text is not reproduced here.*

---

Generated by ReqWise AI · export schema reqwise-export/1.0 · 2026-07-26T09:00:00.000Z
