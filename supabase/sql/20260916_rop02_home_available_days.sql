create or replace function public.rop02_available_days(
  p_projects text[] default null,
  p_limit integer default 90
)
returns table(fecha date, registros bigint)
language sql
stable
set search_path to 'public'
as $function$
  select r.fecha, count(*)::bigint as registros
  from public.rop02_frontend r
  where r.fecha is not null
    and (p_projects is null or r.proyecto = any(p_projects))
  group by r.fecha
  order by r.fecha desc
  limit greatest(1, least(coalesce(p_limit,90),365));
$function$;

revoke all on function public.rop02_available_days(text[],integer) from public;
grant execute on function public.rop02_available_days(text[],integer) to anon, authenticated, service_role;
