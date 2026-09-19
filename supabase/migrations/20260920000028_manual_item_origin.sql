-- ReqWiseAI — Phase 2, Slice 4 (part 1 of 2): the 'manual' item_origin value.
--
-- Its own migration, ahead of anything that references it: Postgres will not let a
-- transaction USE an enum value it added itself in the same transaction, and Supabase
-- applies each migration file as one transaction. `add_manual_requirement()` (next
-- migration) is the first thing to write this value.

alter type item_origin add value 'manual';
