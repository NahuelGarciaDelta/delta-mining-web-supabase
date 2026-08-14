-- Aplicado al proyecto Supabase jwfocqaxlckuxoklwyxs el 2026-08-14.
-- Objetivo: Supabase como backend primario de lectura; Apps Script conserva
-- autenticación/escrituras y actúa como fuente de sincronización desde Sheets.

-- Seguridad: nunca exponer la planilla de usuarios/contraseñas al frontend.
drop policy if exists delta_dataset_rows_read on public.delta_dataset_rows;
drop policy if exists delta_dataset_rows_read_safe on public.delta_dataset_rows;
create policy delta_dataset_rows_read_safe
on public.delta_dataset_rows
for select
to anon, authenticated
using (dataset <> 'usuarios');

revoke insert, update, delete, truncate, references, trigger
on public.delta_dataset_rows from anon, authenticated;
grant select on public.delta_dataset_rows to anon, authenticated;

create or replace function public.read_delta_dataset(p_dataset text)
returns table(source_row integer, row_data jsonb, source_version bigint, synced_at timestamptz)
language sql
security invoker
set search_path = ''
as $$
  select d.source_row,d.row_data,d.source_version,d.synced_at
  from public.delta_dataset_rows d
  where d.dataset=p_dataset and p_dataset <> 'usuarios'
  order by d.source_row;
$$;
revoke all on function public.read_delta_dataset(text) from public;
grant execute on function public.read_delta_dataset(text) to anon, authenticated, service_role;

create or replace function public.delta_source_versions()
returns table(source_key text, server_version bigint, synced_at timestamptz, rows bigint)
language sql
security invoker
set search_path = ''
as $$
  with typed as (
    select 'rop05'::text source_key,(extract(epoch from coalesce(max(synced_at),'epoch'::timestamptz))*1000)::bigint server_version,max(synced_at) synced_at,count(*)::bigint rows from public.rop05
    union all select 'rma15_fs',(extract(epoch from coalesce(max(synced_at),'epoch'::timestamptz))*1000)::bigint,max(synced_at),count(*)::bigint from public.rma15 where source_dataset='rma15_fs'
    union all select 'rma15_jm',(extract(epoch from coalesce(max(synced_at),'epoch'::timestamptz))*1000)::bigint,max(synced_at),count(*)::bigint from public.rma15 where source_dataset='rma15_jm'
    union all select 'lista_equipos',(extract(epoch from coalesce(max(synced_at),'epoch'::timestamptz))*1000)::bigint,max(synced_at),count(*)::bigint from public.lista_equipos
    union all select 'insumos',(extract(epoch from coalesce(max(synced_at),'epoch'::timestamptz))*1000)::bigint,max(synced_at),count(*)::bigint from public.insumos
  ), generic as (
    select d.dataset source_key,
      coalesce(nullif(max(d.source_version),0),(extract(epoch from coalesce(max(d.synced_at),'epoch'::timestamptz))*1000)::bigint) server_version,
      max(d.synced_at) synced_at,count(*)::bigint rows
    from public.delta_dataset_rows d
    where d.dataset <> 'usuarios'
      and d.dataset not in ('rop05','rma15_fs','rma15_jm','lista_equipos','insumos')
    group by d.dataset
  )
  select * from typed union all select * from generic;
$$;
revoke all on function public.delta_source_versions() from public;
grant execute on function public.delta_source_versions() to anon, authenticated, service_role;

-- Caché de acciones legacy que agregan varias hojas o estados auxiliares.
create or replace function private.refresh_delta_special_cache()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  base_url constant text := 'https://script.google.com/macros/s/AKfycbxHyZPSNlYFI0LhMhdeByEfYygtMvA-sVEFpCaMAvCLpjLt8VnhWNB2t0cz7mmUomH9/exec?action=';
  action_name text; cache_name text; response extensions.http_response; body jsonb;
  refreshed jsonb := '{}'::jsonb;
begin
  for action_name,cache_name in select * from (values
    ('mantenimiento_programado','mantenimiento_programado'),
    ('estados_solicitudes','estados_solicitudes'),
    ('licitaciones_compartidas','licitaciones_compartidas'),
    ('stock_excel_status','stock_excel_status'),
    ('stock_excel_data','stock_excel_data'),
    ('get_equipment_movements','equipment_movements_all'),
    ('get_active_equipment_movements','equipment_movements_active')
  ) as x(action_name,cache_name)
  loop
    begin
      select * into response from extensions.http_get(base_url||action_name||'&force=1&_='||floor(extract(epoch from clock_timestamp())*1000)::bigint::text);
      if response.status between 200 and 299 then
        body:=response.content::jsonb;
        if coalesce((body->>'ok')::boolean,false) then
          insert into public.delta_special_cache(cache_key,payload,updated_at)
          values(cache_name,body,now())
          on conflict(cache_key) do update set payload=excluded.payload,updated_at=excluded.updated_at;
          refreshed:=refreshed||jsonb_build_object(cache_name,'ok');
        end if;
      end if;
    exception when others then
      refreshed:=refreshed||jsonb_build_object(cache_name,sqlerrm);
    end;
  end loop;
  return jsonb_build_object('ok',true,'refreshed',refreshed,'at',now());
end
$$;
revoke all on function private.refresh_delta_special_cache() from public,anon,authenticated;
grant execute on function private.refresh_delta_special_cache() to postgres,service_role;

create extension if not exists pg_cron with schema pg_catalog;
do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname='delta-refresh-special-cache';
exception when undefined_table then null; end $$;
select cron.schedule('delta-refresh-special-cache','*/5 * * * *',$$select private.refresh_delta_special_cache();$$);
