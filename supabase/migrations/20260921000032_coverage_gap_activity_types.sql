-- Phase 3 (Gap check), Slice 3, part 2 of 3 — the four activity types
-- `update_coverage_gap()` records, mirroring `20260725000015_workflow_activity_types.sql`'s
-- `quality_*` block exactly.
--
-- Its own migration for the same reason as 20260921000031 and every prior batch of
-- these: a transaction cannot use an enum value it just added.

alter type review_activity_type add value if not exists 'gap_acknowledged';
alter type review_activity_type add value if not exists 'gap_resolved';
alter type review_activity_type add value if not exists 'gap_dismissed';
alter type review_activity_type add value if not exists 'gap_reopened';
