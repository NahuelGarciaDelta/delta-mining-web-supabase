-- Versiones livianas de las fuentes operativas tipadas.
-- Permite que la app invalide su cache apenas Supabase recibe un cambio de Sheets,
-- sin descargar de nuevo miles de filas solo para comprobar frescura.
create or replace function public.operational_source_versions(p_sources text[] default null)
returns table(source text, server_version bigint, row_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  with versions as (
    select r.source_dataset as source,
           coalesce((extract(epoch from max(r.synced_at))*1000)::bigint,0) as server_version,
           count(*)::bigint as row_count
    from public.rop02 r
    where r.source_dataset = any(array['rop02_fs','rop02_jm','rop02_filosur','rop02_zorro'])
    group by r.source_dataset

    union all
    select 'rop05',coalesce((extract(epoch from max(synced_at))*1000)::bigint,0),count(*)::bigint
    from public.rop05

    union all
    select source_dataset,coalesce((extract(epoch from max(synced_at))*1000)::bigint,0),count(*)::bigint
    from public.rma15
    where source_dataset = any(array['rma15_fs','rma15_jm'])
    group by source_dataset

    union all
    select 'lista_equipos',coalesce((extract(epoch from max(synced_at))*1000)::bigint,0),count(*)::bigint
    from public.lista_equipos

    union all
    select 'insumos',coalesce((extract(epoch from max(synced_at))*1000)::bigint,0),count(*)::bigint
    from public.insumos
  )
  select v.source,v.server_version,v.row_count
  from versions v
  where p_sources is null or v.source = any(p_sources);
$$;

revoke all on function public.operational_source_versions(text[]) from public;
grant execute on function public.operational_source_versions(text[]) to anon, authenticated, service_role;
