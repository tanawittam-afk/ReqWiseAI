-- ReqWiseAI — Slice 3
-- One more kind of raw input: operational notes (shift handovers, incident logs,
-- process write-ups). It was in the intake list but not in the enum, and the enum is
-- the authority — lib/contracts/source.ts SOURCE_KINDS mirrors exactly these values.
--
-- Its own migration because 20260724000008 is already applied to the live project.

alter type source_kind add value if not exists 'operational_notes';
