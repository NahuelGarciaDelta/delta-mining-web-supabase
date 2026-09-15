create or replace function public.sync_authoritative_app_dataset(p_dataset text, p_rows jsonb, p_meta jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  v_dataset text:=lower(btrim(coalesce(p_dataset,'')));
  v_rows jsonb:=coalesce(p_rows,'[]'::jsonb);
  v_result jsonb;
  v_deleted integer:=0;
  v_destination integer:=0;
begin
  if jsonb_typeof(v_rows)<>'array' then raise exception 'p_rows debe ser array'; end if;
  v_result:=public.sync_sheet_storage_dataset(v_dataset,v_rows,coalesce(p_meta,'{}'::jsonb));

  if v_dataset='licitaciones' then
    delete from public.app_licitaciones t
    where not exists(select 1 from jsonb_array_elements(v_rows) x where btrim(coalesce(x->>'id',''))=t.id);
    get diagnostics v_deleted=row_count;
    select count(*) into v_destination from public.app_licitaciones;
  elsif v_dataset='pm_config' then
    delete from public.app_pm_config t
    where not exists(select 1 from jsonb_array_elements(v_rows) x where btrim(coalesce(x->>'interno',''))=t.interno);
    get diagnostics v_deleted=row_count;
    select count(*) into v_destination from public.app_pm_config;
  elsif v_dataset='pm_registros' then
    delete from public.app_pm_registros t
    where not exists(select 1 from jsonb_array_elements(v_rows) x where btrim(coalesce(x->>'id',x->>'idPM',''))=t.id);
    get diagnostics v_deleted=row_count;
    select count(*) into v_destination from public.app_pm_registros;
  elsif v_dataset='pm_programaciones' then
    delete from public.app_pm_programaciones t
    where not exists(select 1 from jsonb_array_elements(v_rows) x where btrim(coalesce(x->>'id',''))=t.id);
    get diagnostics v_deleted=row_count;
    select count(*) into v_destination from public.app_pm_programaciones;
  elsif v_dataset='pm_repuestos' then
    delete from public.app_pm_repuestos t
    where not exists(select 1 from jsonb_array_elements(v_rows) x where btrim(coalesce(x->>'id',''))=t.id);
    get diagnostics v_deleted=row_count;
    select count(*) into v_destination from public.app_pm_repuestos;
  else
    return v_result;
  end if;

  return coalesce(v_result,'{}'::jsonb)||jsonb_build_object('deleted',v_deleted,'destinationRows',v_destination,'authoritative',true,'syncedAt',now());
end
$$;

revoke all on function public.sync_authoritative_app_dataset(text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.sync_authoritative_app_dataset(text,jsonb,jsonb) to service_role;
