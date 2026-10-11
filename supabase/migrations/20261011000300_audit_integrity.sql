begin;

drop policy if exists audit_events_insert_self on public.audit_events;
revoke insert on public.audit_events from public, anon, authenticated;

commit;
