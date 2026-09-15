create or replace function public.abastecimiento_update_raba03(p_action text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_updated integer := 0;
  v_rows jsonb := coalesce(p_rows,'[]'::jsonb);
  v_changed jsonb := '[]'::jsonb;
begin
  if p_action not in ('cant_enviada','codigos') then
    raise exception 'Acción RABA03 no soportada: %',p_action;
  end if;
  if jsonb_typeof(v_rows)<>'array' then
    raise exception 'rows debe ser un array';
  end if;
  if exists(
    select 1 from jsonb_array_elements(v_rows) v
    group by v->>'nSolicitud' having count(*)>1
  ) then
    raise exception 'Pedidos repetidos en el guardado';
  end if;

  select coalesce(jsonb_agg(v),'[]'::jsonb)
  into v_changed
  from jsonb_array_elements(v_rows) v
  where nullif(v->>'nSolicitud','') is not null
    and exists (
      select 1
      from public.abastecimiento_raba03 r
      where coalesce(r.row_data->>'N° de pedido',r.row_data->>'Nº de pedido','')=v->>'nSolicitud'
        and (
          (p_action='cant_enviada' and (
            coalesce(r.row_data->'Cant. Enviada','null'::jsonb) is distinct from coalesce(v->'cantidadEnviada','0'::jsonb)
            or coalesce(r.row_data->>'Nº Remito','') is distinct from coalesce(v->>'numeroRemito','')
            or coalesce(r.row_data->>'Fecha de salida','') is distinct from coalesce(v->>'fechaSalida','')
            or coalesce(r.row_data->'Cantidad','null'::jsonb) is distinct from coalesce(v->'cantidad','0'::jsonb)
          ))
          or (p_action='codigos' and
            coalesce(r.row_data->>'Código de articulo','') is distinct from coalesce(v->>'codigoArticulo','')
          )
        )
    );

  if jsonb_array_length(v_changed)=0 then
    return jsonb_build_object('ok',true,'updatedRows',0,'changedRows',0);
  end if;

  update public.abastecimiento_raba03 r
  set row_data=r.row_data||case when p_action='cant_enviada' then jsonb_build_object(
        'Cant. Enviada',coalesce(v->'cantidadEnviada','0'::jsonb),
        'Nº Remito',coalesce(v->>'numeroRemito',''),
        'Fecha de salida',coalesce(v->>'fechaSalida',''),
        'Cantidad',coalesce(v->'cantidad','0'::jsonb)
      ) else jsonb_build_object(
        'Código de articulo',coalesce(v->>'codigoArticulo','')
      ) end,
      updated_at=now()
  from jsonb_array_elements(v_changed) v
  where coalesce(r.row_data->>'N° de pedido',r.row_data->>'Nº de pedido','')=v->>'nSolicitud';
  get diagnostics v_updated=row_count;

  insert into public.app_sync_outbox(domain,record_key,operation,payload)
  values(
    'raba03',
    p_action||'-'||extract(epoch from clock_timestamp())::bigint::text,
    p_action,
    jsonb_build_object('action',p_action,'rows',v_changed)
  );

  return jsonb_build_object(
    'ok',true,
    'updatedRows',v_updated,
    'changedRows',jsonb_array_length(v_changed)
  );
end
$function$;
