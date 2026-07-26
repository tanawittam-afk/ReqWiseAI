-- ReqWiseAI — Slice 6B, part 1 of 2: the enum labels, and nothing else.
--
-- Why this is its own file.
--
-- PostgreSQL refuses to *use* an enum label in the same transaction that added it
-- ("unsafe use of new value of enum type"), because the label is not yet visible to
-- other snapshots. Every Supabase migration file runs in one transaction, so a single
-- file that both adds `implemented_by` and writes a CHECK or a seed row mentioning it
-- fails on a clean database — and, worse, may succeed on a database where the label
-- already exists, which is the shape of bug that only appears on the first real deploy.
--
-- So: labels here, everything that uses them in 20260726000019.
--
-- What is deliberately NOT done here:
--
--   * No existing row is retyped. All 189 `item_relations` rows written before this
--     slice carry `derives_from`, and they keep it. Re-labelling them would be a
--     guess about a relationship the provider never stated — see DATA-MODEL §C.13.
--   * No label is dropped. `refines`, `satisfies`, `verifies`, `conflicts_with` and
--     `duplicates` came from Phase 3A and no code path has ever written one. Dropping
--     an enum label rewrites every dependent row, so they stay and stay unreachable,
--     exactly as the `implemented` status label does (§C.5).
--
-- 20260724000001..20260725000017 are applied to the live project and are never edited.

alter type item_relation_type add value if not exists 'supports';
alter type item_relation_type add value if not exists 'implemented_by';
alter type item_relation_type add value if not exists 'expressed_as';
alter type item_relation_type add value if not exists 'validated_by';
alter type item_relation_type add value if not exists 'constrained_by';
alter type item_relation_type add value if not exists 'raises_question';
alter type item_relation_type add value if not exists 'flags_quality_issue';
alter type item_relation_type add value if not exists 'mitigates';
alter type item_relation_type add value if not exists 'related_to';
