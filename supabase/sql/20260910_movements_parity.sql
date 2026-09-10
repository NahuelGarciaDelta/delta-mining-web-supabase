-- DELTA MINING OPS — paridad de movimientos, Taller y justificaciones.
create or replace function public.sync_app_equipment_movements_from_sheet(p_rows jsonb,p_meta jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_item jsonb; v_id text; v_payload jsonb; v_active boolean;
  v_current_data jsonb; v_current_active boolean;
  v_source_rows integer:=0; v_destination_rows integer:=0; v_inserted integer:=0; v_updated integer:=0; v_deleted integer:=0;
  v_authoritative boolean:=lower(coalesce(p_meta->>'authoritative','true')) not in ('false','0','no');
begin
  if coalesce(jsonb_typeof(p_rows),'null')<>'array' then raise exception 'p_rows debe ser un array JSON'; end if;
  for v_item in select value from jsonb_array_elements(p_rows) loop
    v_id:=nullif(btrim(v_item->>'id'),'');
    if v_id is null then continue; end if;
    v_source_rows:=v_source_rows+1;
    v_active:=not(lower(coalesce(v_item->>'activo','true')) in ('false','0','no') or upper(coalesce(v_item->>'estado','')) in ('CANCELADO','SUPERADO','ELIMINADO','INACTIVO'));
    v_payload:=jsonb_set(jsonb_set(v_item,'{id}',to_jsonb(v_id),true),'{activo}',to_jsonb(v_active),true)||jsonb_build_object('estado',coalesce(nullif(v_item->>'estado',''),'ACEPTADO'));
    select data,activo into v_current_data,v_current_active from public.app_equipment_movements where id=v_id;
    if not found then
      insert into public.app_equipment_movements(id,data,activo,updated_by) values(v_id,v_payload,v_active,'SHEETS_SYNC') on conflict(id) do nothing;
      v_inserted:=v_inserted+1;
    elsif v_current_data is distinct from v_payload or v_current_active is distinct from v_active then
      update public.app_equipment_movements set data=v_payload,activo=v_active,updated_at=now(),updated_by='SHEETS_SYNC' where id=v_id;
      v_updated:=v_updated+1;
    end if;
  end loop;
  if v_authoritative then
    delete from public.app_equipment_movements target where not exists (select 1 from jsonb_array_elements(p_rows) item where nullif(btrim(item->>'id'),'')=target.id);
    get diagnostics v_deleted=row_count;
  end if;
  select count(*) into v_destination_rows from public.app_equipment_movements;
  return jsonb_build_object('ok',true,'sourceRows',v_source_rows,'destinationRows',v_destination_rows,'inserted',v_inserted,'updated',v_updated,'deleted',v_deleted,'syncedAt',now());
end;
$function$;

create or replace function public.sync_app_taller_movements_from_sheet(p_rows jsonb,p_meta jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare
  v_item jsonb; v_id text; v_tipo text; v_estado text; v_active boolean; v_source_sheet text;
  v_fecha timestamptz; v_horometro numeric; v_horometro_entra numeric;
  v_exists boolean; v_changed boolean;
  v_source_rows integer:=0; v_destination_rows integer:=0; v_inserted integer:=0; v_updated integer:=0; v_deleted integer:=0;
  v_authoritative boolean:=lower(coalesce(p_meta->>'authoritative','true')) not in ('false','0','no');
begin
  if coalesce(jsonb_typeof(p_rows),'null')<>'array' then raise exception 'p_rows debe ser un array JSON'; end if;
  for v_item in select value from jsonb_array_elements(p_rows) loop
    v_id:=nullif(btrim(v_item->>'ID'),''); if v_id is null then continue; end if;
    v_source_rows:=v_source_rows+1;
    v_tipo:=upper(coalesce(nullif(v_item->>'TIPO',''),'OTRO'));
    v_estado:=coalesce(nullif(v_item->>'ESTADO',''),'ACTIVO');
    v_active:=not(lower(coalesce(v_item->>'ACTIVO','true')) in ('false','0','no') or upper(v_estado) in ('CANCELADO','SUPERADO','ELIMINADO','INACTIVO'));
    v_fecha:=coalesce(nullif(v_item->>'FECHA_HORA','')::timestamptz,now());
    v_horometro:=coalesce(nullif(replace(v_item->>'HOROMETRO',',','.') ,'')::numeric,0);
    v_horometro_entra:=coalesce(nullif(replace(v_item->>'HOROMETRO_ENTRA',',','.'),'')::numeric,0);
    v_source_sheet:=case v_tipo when 'SUBIDA' then 'MOVIMIENTOS_SUBIDAS' when 'BAJA' then 'MOVIMIENTOS_BAJADAS' when 'MOVILIZACION' then 'MOVIMIENTOS_MOVILIZACIONES' when 'CAMBIO_EQUIPO' then 'MOVIMIENTOS_CAMBIO_EQUIPO' else 'MOVIMIENTOS_TALLER' end;
    select true, row(fecha_hora,tipo,equipo,marca,modelo,propiedad,interno_origen,horometro,proyecto_origen,proyecto_destino,interno_destino,interno_entra,equipo_entra,marca_entra,modelo_entra,propiedad_entra,horometro_entra,motivo,observacion,usuario,estado,activo,source_sheet) is distinct from row(v_fecha,v_tipo,coalesce(v_item->>'EQUIPO',''),coalesce(v_item->>'MARCA',''),coalesce(v_item->>'MODELO',''),coalesce(v_item->>'PROPIEDAD',''),coalesce(v_item->>'INTERNO_ORIGEN',v_item->>'INTERNO',''),v_horometro,coalesce(v_item->>'PROYECTO_ORIGEN',''),coalesce(v_item->>'PROYECTO_DESTINO',''),coalesce(v_item->>'INTERNO_DESTINO',''),coalesce(v_item->>'INTERNO_ENTRA',''),coalesce(v_item->>'EQUIPO_ENTRA',''),coalesce(v_item->>'MARCA_ENTRA',''),coalesce(v_item->>'MODELO_ENTRA',''),coalesce(v_item->>'PROPIEDAD_ENTRA',''),v_horometro_entra,coalesce(v_item->>'MOTIVO',''),coalesce(v_item->>'OBSERVACION',''),coalesce(v_item->>'USUARIO',''),v_estado,v_active,v_source_sheet) into v_exists,v_changed from public.app_taller_movements where id=v_id;
    if not found then
      insert into public.app_taller_movements(id,fecha_hora,tipo,equipo,marca,modelo,propiedad,interno_origen,horometro,proyecto_origen,proyecto_destino,interno_destino,interno_entra,equipo_entra,marca_entra,modelo_entra,propiedad_entra,horometro_entra,motivo,observacion,usuario,estado,activo,source_sheet,updated_at,updated_by)
      values(v_id,v_fecha,v_tipo,coalesce(v_item->>'EQUIPO',''),coalesce(v_item->>'MARCA',''),coalesce(v_item->>'MODELO',''),coalesce(v_item->>'PROPIEDAD',''),coalesce(v_item->>'INTERNO_ORIGEN',v_item->>'INTERNO',''),v_horometro,coalesce(v_item->>'PROYECTO_ORIGEN',''),coalesce(v_item->>'PROYECTO_DESTINO',''),coalesce(v_item->>'INTERNO_DESTINO',''),coalesce(v_item->>'INTERNO_ENTRA',''),coalesce(v_item->>'EQUIPO_ENTRA',''),coalesce(v_item->>'MARCA_ENTRA',''),coalesce(v_item->>'MODELO_ENTRA',''),coalesce(v_item->>'PROPIEDAD_ENTRA',''),v_horometro_entra,coalesce(v_item->>'MOTIVO',''),coalesce(v_item->>'OBSERVACION',''),coalesce(v_item->>'USUARIO',''),v_estado,v_active,v_source_sheet,now(),'SHEETS_SYNC') on conflict(id) do nothing;
      v_inserted:=v_inserted+1;
    elsif v_changed then
      update public.app_taller_movements set fecha_hora=v_fecha,tipo=v_tipo,equipo=coalesce(v_item->>'EQUIPO',''),marca=coalesce(v_item->>'MARCA',''),modelo=coalesce(v_item->>'MODELO',''),propiedad=coalesce(v_item->>'PROPIEDAD',''),interno_origen=coalesce(v_item->>'INTERNO_ORIGEN',v_item->>'INTERNO',''),horometro=v_horometro,proyecto_origen=coalesce(v_item->>'PROYECTO_ORIGEN',''),proyecto_destino=coalesce(v_item->>'PROYECTO_DESTINO',''),interno_destino=coalesce(v_item->>'INTERNO_DESTINO',''),interno_entra=coalesce(v_item->>'INTERNO_ENTRA',''),equipo_entra=coalesce(v_item->>'EQUIPO_ENTRA',''),marca_entra=coalesce(v_item->>'MARCA_ENTRA',''),modelo_entra=coalesce(v_item->>'MODELO_ENTRA',''),propiedad_entra=coalesce(v_item->>'PROPIEDAD_ENTRA',''),horometro_entra=v_horometro_entra,motivo=coalesce(v_item->>'MOTIVO',''),observacion=coalesce(v_item->>'OBSERVACION',''),usuario=coalesce(v_item->>'USUARIO',''),estado=v_estado,activo=v_active,source_sheet=v_source_sheet,updated_at=now(),updated_by='SHEETS_SYNC' where id=v_id;
      v_updated:=v_updated+1;
    end if;
  end loop;
  if v_authoritative then
    update public.app_taller_movements target set activo=false,estado='ELIMINADO',updated_at=now(),updated_by='SHEETS_SYNC' where target.activo and target.source_sheet like 'MOVIMIENTOS_%' and not exists (select 1 from jsonb_array_elements(p_rows) item where nullif(btrim(item->>'ID'),'')=target.id);
    get diagnostics v_deleted=row_count;
  end if;
  select count(*) into v_destination_rows from public.app_taller_movements;
  return jsonb_build_object('ok',true,'sourceRows',v_source_rows,'destinationRows',v_destination_rows,'inserted',v_inserted,'updated',v_updated,'deleted',v_deleted,'syncedAt',now());
end;
$function$;

revoke all on function public.sync_app_equipment_movements_from_sheet(jsonb,jsonb) from public,anon,authenticated;
revoke all on function public.sync_app_taller_movements_from_sheet(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.sync_app_equipment_movements_from_sheet(jsonb,jsonb) to service_role;
grant execute on function public.sync_app_taller_movements_from_sheet(jsonb,jsonb) to service_role;
