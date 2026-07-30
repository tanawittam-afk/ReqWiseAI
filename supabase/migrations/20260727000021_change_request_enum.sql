-- ReqWiseAI — Change requests, part 1 of 3
--
-- The lifecycle a change request itself moves through. Split into its own migration
-- because 20260727000023 both creates the change_requests table (which uses this type
-- as a column type) and writes functions that reference its labels — Postgres refuses
-- to use a freshly added enum value in the same transaction that added the type, the
-- same restriction already hit in slices 6A and 6B.
--
-- 'withdrawn' is included from day one, not bolted on later: the requester cancelling
-- their own still-pending request is cheap to support now and expensive to add as a
-- further enum-splitting migration once data already exists.

create type change_request_status as enum ('pending', 'approved', 'rejected', 'withdrawn');
