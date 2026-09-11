-- Fixes a real authorization hole found while verifying M4: revoking EXECUTE
-- from anon/authenticated on a SECURITY DEFINER function is not enough.
-- PostgreSQL grants EXECUTE on every newly created function to PUBLIC by
-- default, and every role implicitly carries whatever PUBLIC has regardless
-- of what is revoked from that role by name — confirmed via pg_proc.proacl,
-- which still showed `=X/postgres` (the PUBLIC entry) on both functions
-- below after their "revoke ... from anon, authenticated" ran. An
-- authenticated session could call either one directly via RPC and skip the
-- authorization check its public wrapper performs (though not skip the
-- transition-map legality check inside apply_visa_status_transition_internal
-- itself, which is why this sat unnoticed until a direct-call test in M4).
--
-- The fix is the same for both: also revoke from PUBLIC, not just from the
-- named roles. Applies to apply_visa_status_transition_internal (from M1,
-- 20260908000002) and apply_visa_partner_status_update (from M4,
-- 20260908000005) — both grant public access on creation by default.
revoke execute on function public.apply_visa_status_transition_internal(uuid, public.visa_status, uuid, text)
  from public;

revoke execute on function public.apply_visa_partner_status_update(uuid, public.visa_status, text)
  from public;
