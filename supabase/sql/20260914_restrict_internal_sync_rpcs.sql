-- Internal synchronization endpoints must never be callable with the browser anon key.
revoke all on function public.app_sync_outbox_enrich_sheet_identity() from public,anon,authenticated;
revoke all on function public.sync_abastecimiento_raba03_authoritative(jsonb) from public,anon,authenticated;
revoke all on function public.sync_rop02_sheet_dataset(text,jsonb) from public,anon,authenticated;
revoke all on function public.sync_sheet_storage_dataset(text,jsonb,jsonb) from public,anon,authenticated;

grant execute on function public.app_sync_outbox_enrich_sheet_identity() to service_role;
grant execute on function public.sync_abastecimiento_raba03_authoritative(jsonb) to service_role;
grant execute on function public.sync_rop02_sheet_dataset(text,jsonb) to service_role;
grant execute on function public.sync_sheet_storage_dataset(text,jsonb,jsonb) to service_role;
