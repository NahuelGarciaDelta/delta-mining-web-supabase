-- Allow the web clients that use the Supabase publishable/anon key to read RABA03.
-- RLS remains enabled and the existing abastecimiento_raba03_read policy still applies.

grant select on table public.abastecimiento_raba03 to anon, authenticated;
