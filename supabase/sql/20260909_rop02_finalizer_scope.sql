-- The scheduled canonical job excludes Jose Maria because it is synchronized by
-- the Apps Script batch path.  Prune only datasets actually staged in this run.
create or replace function private.finalize_rop02_drive_reconciliation()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare v_upserted integer := 0; v_deleted integer := 0;
begin
  insert into public.rop02(source_dataset,source_row,fecha,interno,equipo,operador,supervisor_delta,supervisor_vial_cliente,
    turno_trabajo,numero_parte,proyecto,horometro_inicial,horometro_final,cantidad_horas,combustible,aceite,aceite_text,
    descripcion_trabajos,informacion_desgaste,observaciones,source_key,synced_at,updated_at)
  select source_dataset,source_row,fecha,interno,equipo,operador,supervisor_delta,supervisor_vial_cliente,
    turno_trabajo,numero_parte,proyecto,horometro_inicial,horometro_final,cantidad_horas,combustible,aceite,aceite_text,
    descripcion_trabajos,informacion_desgaste,observaciones,source_key,now(),now()
  from private.rop02_sync_stage
  on conflict(source_dataset,source_row) do update set
    fecha=excluded.fecha,interno=excluded.interno,equipo=excluded.equipo,operador=excluded.operador,
    supervisor_delta=excluded.supervisor_delta,supervisor_vial_cliente=excluded.supervisor_vial_cliente,
    turno_trabajo=excluded.turno_trabajo,numero_parte=excluded.numero_parte,proyecto=excluded.proyecto,
    horometro_inicial=excluded.horometro_inicial,horometro_final=excluded.horometro_final,cantidad_horas=excluded.cantidad_horas,
    combustible=excluded.combustible,aceite=excluded.aceite,aceite_text=excluded.aceite_text,
    descripcion_trabajos=excluded.descripcion_trabajos,informacion_desgaste=excluded.informacion_desgaste,
    observaciones=excluded.observaciones,source_key=excluded.source_key,synced_at=now(),updated_at=now();
  get diagnostics v_upserted = row_count;
  delete from public.rop02 r
  where r.source_dataset in (select distinct source_dataset from private.rop02_hash_stage)
    and not exists(select 1 from private.rop02_hash_stage h where h.source_dataset=r.source_dataset and h.source_row=r.source_row);
  get diagnostics v_deleted = row_count;
  return jsonb_build_object('ok',true,'upserted',v_upserted,'deleted',v_deleted,'sync_stage_rows',(select count(*) from private.rop02_sync_stage));
end
$$;
