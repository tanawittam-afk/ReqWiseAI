-- ReqWiseAI — Slice 6A, part 1 of 2
--
-- The eight activity types the question and quality workflows record.
--
-- Why this is its own migration: Postgres will not let a transaction *use* an enum
-- value it added itself. `supabase db push` runs each migration file in one
-- transaction, so adding these labels and then writing a function that references them
-- in the same file fails with "unsafe use of new value of enum type". Splitting the
-- ALTER TYPE out is the standard remedy, not a stylistic choice.
--
-- 20260724000001..14 are applied to the live project and are never edited.

alter type review_activity_type add value if not exists 'question_answered';
alter type review_activity_type add value if not exists 'question_deferred';
alter type review_activity_type add value if not exists 'question_not_applicable';
alter type review_activity_type add value if not exists 'question_reopened';

alter type review_activity_type add value if not exists 'quality_acknowledged';
alter type review_activity_type add value if not exists 'quality_resolved';
alter type review_activity_type add value if not exists 'quality_dismissed';
alter type review_activity_type add value if not exists 'quality_reopened';
