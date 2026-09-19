-- Phase 3 (Gap check), Slice 3 — adds the `coverage_gap` item type.
--
-- A newly added enum value must commit before anything in the same session can
-- reference it (Postgres restriction on `ALTER TYPE ... ADD VALUE`), so this is its
-- own migration, applied before 20260921000033 references it. Same two-step dance
-- already used for `item_origin`'s `'manual'` value
-- (20260920000028_manual_item_origin.sql).
--
-- `coverage_gap` is a first-class item type, full parity with `quality_finding`'s own
-- workflow (open/acknowledged/resolved/dismissed) — not a lightweight snapshot. It
-- represents a source-text statement the code+AI gap-check pipeline found discussed
-- but not written into any requirement. See 20260921000033 for the workflow wiring and
-- `lib/contracts/item-types.ts` for the TypeScript side.

alter type item_type add value if not exists 'coverage_gap';
