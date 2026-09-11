-- "Ready for Processing" — cleared by STS to be lodged — is a distinct state
-- from "Processing" — actually lodged with the authority or the partner. The
-- enum collapsed both into 'processing', so an admin could not record that an
-- application had passed review but was not yet with anyone.
--
-- Its own migration on purpose: a newly added enum value cannot be *used* in
-- the same transaction that adds it, and 20260908000002 uses it in a check
-- constraint-shaped comparison at install time.
alter type public.visa_status add value if not exists 'ready_for_processing' before 'processing';
