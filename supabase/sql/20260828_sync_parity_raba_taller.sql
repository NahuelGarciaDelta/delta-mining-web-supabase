-- Sincronización incremental 2026-08-28
-- RABA03: la hoja física es fuente autoritativa para las filas de solicitud.
-- Taller: importa en lote movimientos creados desde la app original/Sheets.

create or replace function public.sync_abastecimiento_raba03_authoritative(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $$
declare v_upserted integer:=0; v_deleted integer:=0;
begin
  p_rows:=coalesce(p_rows,'[]'::jsonb);
  if jsonb_typeof(p_rows)<>'array' then raise exception 'p_rows debe ser array'; end if;
  insert into public.abastecimiento_raba03(source_row,row_data,synced_at,updated_at)
  select (x->>'source_row')::integer,coalesce(x->'row_data','{}'::jsonb),now(),now()
  from jsonb_array_elements(p_rows) x
  where coalesce(x->>'source_row','') ~ '^[0-9]+$'
  on conflict(source_row) do update set row_data=excluded.row_data,synced_at=now(),updated_at=now();
  get diagnostics v_upserted=row_count;
  delete from public.abastecimiento_raba03 r
  where not exists(select 1 from jsonb_array_elements(p_rows) x where coalesce(x->>'source_row','') ~ '^[0-9]+$' and (x->>'source_row')::integer=r.source_row);
  get diagnostics v_deleted=row_count;
  return jsonb_build_object('ok',true,'dataset','abastecimiento_raba03','upserted',v_upserted,'deleted',v_deleted,'total',(select count(*) from public.abastecimiento_raba03),'syncedAt',now());
end$$;

create or replace function public.app_taller_movements_import(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path='public'
as $$
declare x jsonb; v_count integer:=0; v_result jsonb;
begin
  p_rows:=coalesce(p_rows,'[]'::jsonb);
  if jsonb_typeof(p_rows)<>'array' then raise exception 'p_rows debe ser array'; end if;
  for x in select value from jsonb_array_elements(p_rows) loop
    if trim(coalesce(x->>'id',''))='' then continue; end if;
    v_result:=public.app_taller_movement_save(x,coalesce(nullif(x->>'usuario',''),'SHEETS'));
    v_count:=v_count+1;
  end loop;
  return jsonb_build_object('ok',true,'rows',v_count,'syncedAt',now());
end$$;

grant execute on function public.sync_abastecimiento_raba03_authoritative(jsonb) to service_role;
grant execute on function public.app_taller_movements_import(jsonb) to service_role;
