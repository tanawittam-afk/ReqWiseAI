-- ReqWiseAI — Change requests, part 2 of 3
--
-- Four activity types the change-request workflow records, in their own migration for
-- the same reason 20260725000015 was: a transaction cannot use an enum label it just
-- added, and 20260727000023 both adds these labels' uses (in RPC bodies) and would
-- otherwise need to add them in the same file.

alter type review_activity_type add value if not exists 'change_request_opened';
alter type review_activity_type add value if not exists 'change_request_approved';
alter type review_activity_type add value if not exists 'change_request_rejected';
alter type review_activity_type add value if not exists 'change_request_withdrawn';
