-- Two states the payout flow was missing, split into their own migration
-- because Postgres refuses to USE a new enum value in the same transaction
-- that adds it — the partial index and functions in 20260903000004 read
-- 'processing' as a literal, so the value has to be committed first.
--
-- 'processing' is the honest middle of an offline payout: admin has been to
-- the bank and sent the money, but it hasn't landed yet. Without it the
-- request has to sit on 'approved' (looks unpaid, invites a double
-- transfer) or jump to 'paid' (claims settled money that is still moving).
-- It is also exactly the state an online rail needs later: a disbursement
-- API accepts the transfer, and a webhook confirms settlement afterwards.
--
-- 'failed' is the other half of that reality — a transfer bounces on a
-- wrong account number or a closed account. Marking it failed releases the
-- amount back to the agency's available balance (see agency_earnings_summary
-- in the next migration) so the agent can fix their bank details and ask
-- again, instead of the money being stranded in a request nobody can close.

alter type public.payout_request_status add value if not exists 'processing' after 'approved';
alter type public.payout_request_status add value if not exists 'failed' after 'rejected';
