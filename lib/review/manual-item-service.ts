/**
 * Adding a requirement manually (Phase 2, Slice 4).
 *
 * One RPC call, on a **user-scoped** client — no service-role client here, same
 * discipline as `service.ts`'s `editItem()`/`reviewItem()`. `add_manual_requirement()`
 * is SECURITY DEFINER precisely so it can allocate a display id and write the item (and
 * an optional source reference) in one transaction; it re-derives membership, project
 * status and item-type eligibility from the database, never from what this layer sends.
 *
 * This layer's own job stays small: parse what the form sent, refuse what the contract
 * forbids, and turn a Postgres refusal into a sentence a person can act on.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addManualRequirementSchema,
  manualRequirementFieldErrors,
  type AddManualRequirementInput,
} from "../contracts/manual-item";
import type { ServiceResult } from "./service";

export type AddManualRequirementResult = { itemId: string; displayId: string };

export const MANUAL_ADD_MESSAGES = {
  readOnlyProject: "This project is archived and read-only. Restore it to make changes.",
  wrongWorkflow: "Open questions and quality findings can't be added this way.",
  sourceUnavailable: "That source could not be found in this project.",
  assumedWithCitation: "An assumed item may not cite a source excerpt.",
  addFailed: "The requirement could not be added. Try again.",
  invalid: "Some fields need attention.",
  expired: "Your session has expired. Sign in again.",
  unavailable: "This project is unavailable.",
} as const;

/** Postgres errors are for the log. The user gets a sentence, never a policy name. */
function translateManualAddError(detail: string): string {
  if (/archived/i.test(detail)) return MANUAL_ADD_MESSAGES.readOnlyProject;
  if (/different workflow/i.test(detail)) return MANUAL_ADD_MESSAGES.wrongWorkflow;
  if (/source not found/i.test(detail)) return MANUAL_ADD_MESSAGES.sourceUnavailable;
  if (/may not cite|may not carry a source excerpt/i.test(detail)) {
    return MANUAL_ADD_MESSAGES.assumedWithCitation;
  }
  if (/not found|not visible/i.test(detail)) return MANUAL_ADD_MESSAGES.unavailable;
  if (/authentication required/i.test(detail)) return MANUAL_ADD_MESSAGES.expired;
  return MANUAL_ADD_MESSAGES.addFailed;
}

export async function addManualRequirement(
  client: SupabaseClient,
  projectId: string,
  rawInput: AddManualRequirementInput | unknown,
): Promise<ServiceResult<AddManualRequirementResult>> {
  const parsed = addManualRequirementSchema.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: MANUAL_ADD_MESSAGES.invalid, fieldErrors: manualRequirementFieldErrors(parsed.error) };
  }
  const input = parsed.data;

  const { data, error } = await client.rpc("add_manual_requirement", {
    p_project: projectId,
    p_item_type: input.itemType,
    p_title: input.title,
    p_description: input.description,
    p_priority: input.priority,
    p_source: input.sourceId,
    p_excerpt: input.excerpt,
    p_evidence_class: input.evidenceClass,
  });

  if (error) {
    console.error(`[manual-item] add failed: ${error.message}`);
    return { ok: false, error: translateManualAddError(error.message) };
  }

  const row = (data ?? {}) as Record<string, unknown>;
  return {
    ok: true,
    data: {
      itemId: String(row.item_id ?? ""),
      displayId: String(row.display_id ?? ""),
    },
  };
}
