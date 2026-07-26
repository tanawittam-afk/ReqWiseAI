/**
 * Presentation words for the traceability screens.
 *
 * A thin re-export: the words themselves live in `lib/traceability/labels.ts`, where
 * the pure tests can reach them without pulling a React tree in. Nothing new is
 * defined here, so there is no second place for a label to drift.
 */

export {
  LEGACY_BADGE,
  LEGACY_EXPLANATION,
  relationPhrase,
  type RelationDirection,
} from "@/lib/traceability/labels";

export {
  RELATION_INVERSE_LABEL_EN,
  RELATION_LABEL_EN,
} from "@/lib/contracts/relations";
