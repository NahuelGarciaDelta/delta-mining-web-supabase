-- Aplicado al proyecto Supabase jwfocqaxlckuxoklwyxs el 2026-08-14.
-- Evita que filas legacy de ROP02 sin source_dataset/source_row entren a la UI
-- y reconcilia periódicamente las cuatro Sheets contra la identidad física.

create or replace view public.rop02_frontend
with (security_invoker=true)
as
select
  r.id,r.fecha,r.interno,r.equipo,r.operador,r.supervisor_delta,r.supervisor_vial_cliente,
  r.turno_trabajo,r.numero_parte,r.proyecto,r.horometro_inicial,r.horometro_final,
  r.cantidad_horas,r.combustible,r.aceite,r.descripcion_trabajos,r.informacion_desgaste,
  r.observaciones,r.source_key,r.created_at,r.updated_at,r.synced_at,
  public.rop02_classify_state(r.cantidad_horas,r.descripcion_trabajos,r.observaciones) as estado
from public.rop02 r
where r.source_dataset in ('rop02_fs','rop02_jm','rop02_filosur','rop02_zorro')
  and r.source_row is not null;

grant select on public.rop02_frontend to anon,authenticated;

create or replace function private.refresh_rop02_canonical_from_appscript()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  ds text; off integer; page_result jsonb; returned integer; final_result jsonb;
begin
  truncate table private.rop02_sync_stage;
  truncate table private.rop02_hash_stage;
  foreach ds in array array['rop02_jm','rop02_fs','rop02_filosur','rop02_zorro'] loop
    off := 0;
    loop
      page_result := private.stage_rop02_page(ds,off,500);
      returned := coalesce((page_result->>'returned')::integer,0);
      exit when returned < 500 or page_result->'nextOffset' is null or page_result->>'nextOffset' is null;
      off := (page_result->>'nextOffset')::integer;
    end loop;
  end loop;
  final_result := private.finalize_rop02_drive_reconciliation();
  return jsonb_build_object('ok',true,'final',final_result,'at',now());
end
$$;
revoke all on function private.refresh_rop02_canonical_from_appscript() from public,anon,authenticated;
grant execute on function private.refresh_rop02_canonical_from_appscript() to postgres,service_role;

do $$ begin
  perform cron.unschedule(jobid) from cron.job where jobname='delta-refresh-rop02-canonical';
exception when undefined_table then null; end $$;
select cron.schedule('delta-refresh-rop02-canonical','*/5 * * * *',$$select private.refresh_rop02_canonical_from_appscript();$$);
