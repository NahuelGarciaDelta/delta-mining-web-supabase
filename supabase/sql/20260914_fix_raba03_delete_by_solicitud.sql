-- OPS parity: the delete control receives N° de solicitud (column A), not N° de pedido.
create or replace function public.abastecimiento_delete_raba03_solicitud(p_numero_solicitud text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_numero text:=btrim(coalesce(p_numero_solicitud,''));
  v_rows integer[];
  v_deleted integer:=0;
begin
  if v_numero='' then
    raise exception 'N° de solicitud requerido';
  end if;

  select coalesce(array_agg(r.source_row order by r.source_row),array[]::integer[])
  into v_rows
  from public.abastecimiento_raba03 r
  where btrim(coalesce(
    r.row_data->>'N° de solicitud',
    r.row_data->>'Nº de solicitud',
    r.row_data->>'N de solicitud',
    r.row_data->>'numeroSolicitud',
    ''
  ))=v_numero;

  delete from public.abastecimiento_raba03 r
  where btrim(coalesce(
    r.row_data->>'N° de solicitud',
    r.row_data->>'Nº de solicitud',
    r.row_data->>'N de solicitud',
    r.row_data->>'numeroSolicitud',
    ''
  ))=v_numero;
  get diagnostics v_deleted=row_count;

  if v_deleted>0 then
    insert into public.app_sync_outbox(domain,record_key,operation,payload)
    values(
      'raba03',
      'solicitud-'||v_numero||'-'||extract(epoch from clock_timestamp())::bigint::text,
      'delete_solicitud',
      jsonb_build_object(
        'numeroSolicitud',v_numero,
        'sourceRows',to_jsonb(v_rows),
        'deletedRows',v_deleted
      )
    );
  end if;

  return jsonb_build_object('ok',true,'deletedRows',v_deleted,'numeroSolicitud',v_numero,'sourceRows',to_jsonb(v_rows));
end
$$;

revoke all on function public.abastecimiento_delete_raba03_solicitud(text) from public;
grant execute on function public.abastecimiento_delete_raba03_solicitud(text) to anon, authenticated, service_role;
