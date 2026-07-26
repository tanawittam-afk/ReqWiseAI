/**
 * The document's vocabulary must not drift from the screen's.
 *
 * `lib/export/labels.ts` is a deliberate copy of the presentation labels — the reasoning is
 * in that file's header — and a deliberate copy needs a guard, or it becomes an accidental
 * divergence the first time somebody renames a type on screen and not in the document.
 */

import { describe, expect, it } from "vitest";
import { ITEM_TYPES } from "../../lib/contracts/item-types";
import { ITEM_STATUSES } from "../../lib/contracts/review";
import { WORKFLOW_STATES } from "../../lib/contracts/workflow";
import { WORKFLOW_STATE_LABEL } from "../../lib/contracts/workflow";
import {
  EVIDENCE_LABEL as SCREEN_EVIDENCE,
  ORIGIN_LABEL as SCREEN_ORIGIN,
  PRIORITY_LABEL as SCREEN_PRIORITY,
  STATUS_LABEL as SCREEN_STATUS,
  TYPE_LABEL as SCREEN_TYPE,
} from "../../app/workspace/projects/[projectId]/analyses/[runId]/_components/labels";
import {
  EVIDENCE_LABEL,
  FINDING_KIND_LABEL,
  labelFor,
  ORIGIN_LABEL,
  PRIORITY_LABEL,
  SOURCE_KIND_LABEL,
  STATUS_LABEL,
  TYPE_LABEL,
} from "../../lib/export/labels";
import { QUALITY_FINDING_KINDS } from "../../lib/contracts/item-types";
import { SOURCE_KINDS, SOURCE_KIND_LABELS } from "../../lib/contracts/source";

describe("the export labels agree with the screen labels", () => {
  it("for every item type", () => {
    expect(TYPE_LABEL).toEqual(SCREEN_TYPE);
  });

  it("for every status, priority, evidence class and origin", () => {
    expect(STATUS_LABEL).toEqual(SCREEN_STATUS);
    expect(PRIORITY_LABEL).toEqual(SCREEN_PRIORITY);
    expect(EVIDENCE_LABEL).toEqual(SCREEN_EVIDENCE);
    expect(ORIGIN_LABEL).toEqual(SCREEN_ORIGIN);
  });
});

describe("every vocabulary is covered", () => {
  it("names all fourteen item types", () => {
    for (const type of ITEM_TYPES) expect(TYPE_LABEL[type]).toBeTruthy();
  });

  it("names all five statuses", () => {
    for (const status of ITEM_STATUSES) expect(STATUS_LABEL[status]).toBeTruthy();
  });

  it("names all six source kinds, reusing the contract's own table", () => {
    for (const kind of SOURCE_KINDS) expect(SOURCE_KIND_LABEL[kind]).toBeTruthy();
    expect(SOURCE_KIND_LABEL).toBe(SOURCE_KIND_LABELS);
  });

  it("names all five finding kinds, and invents no sixth", () => {
    for (const kind of QUALITY_FINDING_KINDS) expect(FINDING_KIND_LABEL[kind]).toBeTruthy();
    expect(Object.keys(FINDING_KIND_LABEL).sort()).toEqual([...QUALITY_FINDING_KINDS].sort());
  });

  it("names every workflow state, via the contract's own table", () => {
    for (const state of WORKFLOW_STATES) expect(WORKFLOW_STATE_LABEL[state]).toBeTruthy();
  });
});

describe("labelFor", () => {
  it("falls back to the raw value rather than to an empty string", () => {
    expect(labelFor(STATUS_LABEL, "some_future_status")).toBe("some_future_status");
  });
});
