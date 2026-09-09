create or replace function public.sync_wear_articles_from_sheet(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_count integer:=0;
begin
  if jsonb_typeof(coalesce(p_rows,'[]'::jsonb))<>'array' then raise exception 'p_rows debe ser array'; end if;
  delete from public.app_wear_articles;
  with src as (
    select trim(coalesce(x->>'codigo',x->>'Código',x->>'CODIGO','')) as codigo,
      trim(coalesce(x->>'descripcion',x->>'Descripción',x->>'articulo','')) as descripcion,
      trim(coalesce(x->>'descripcion_adicional',x->>'Descripción adicional',x->>'descripcionAdicional','')) as descripcion_adicional,
      trim(coalesce(x->>'clasificacion',x->>'Clasificación','')) as clasificacion,ord::integer as orden
    from jsonb_array_elements(p_rows) with ordinality as t(x,ord)
  ),dedup as (
    select distinct on (codigo) codigo,descripcion,descripcion_adicional,clasificacion,orden
    from src where codigo<>'' order by codigo,orden desc
  )
  insert into public.app_wear_articles(codigo,descripcion,descripcion_adicional,clasificacion,orden,updated_at,updated_by)
  select codigo,descripcion,descripcion_adicional,clasificacion,orden,now(),'SHEETS' from dedup order by orden;
  get diagnostics v_count=row_count;
  return jsonb_build_object('ok',true,'rows',v_count,'syncedAt',now());
end
$$;
revoke all on function public.sync_wear_articles_from_sheet(jsonb) from public,anon,authenticated;
grant execute on function public.sync_wear_articles_from_sheet(jsonb) to service_role;
