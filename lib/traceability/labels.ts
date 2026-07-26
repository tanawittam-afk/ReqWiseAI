/**
 * How a relation reads in a sentence.
 *
 * In `lib/` rather than beside the components that render it, for the same reason
 * `lib/analysis/workspace-view.ts` is: the direction a label reads is a *contract*
 * claim, not a styling one, and it has to be assertable without a browser. A label
 * that drifted out of step with `HIERARCHY_DIRECTION` would make the map state the
 * opposite of what the database holds.
 */

import {
  RELATION_INVERSE_LABEL_EN,
  RELATION_INVERSE_LABEL_TH,
  RELATION_LABEL_EN,
  RELATION_LABEL_TH,
  type RelationType,
} from "../contracts/relations.ts";

export type RelationDirection = "out" | "in";

/** How an edge reads from the selected item's point of view. */
export function relationPhrase(
  type: RelationType,
  direction: RelationDirection,
  lang: "en" | "th" = "en",
): string {
  if (lang === "th") {
    return direction === "out" ? RELATION_LABEL_TH[type] : RELATION_INVERSE_LABEL_TH[type];
  }
  return direction === "out" ? RELATION_LABEL_EN[type] : RELATION_INVERSE_LABEL_EN[type];
}

export const LEGACY_BADGE = "Legacy relation";

export const LEGACY_EXPLANATION =
  "Stored before typed relations existed. The analysis stated no relationship kind, so none is claimed here.";
