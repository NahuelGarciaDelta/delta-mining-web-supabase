-- Delta Mining OPS: lectura frontend segura y aceleradores ROP02.
-- Ejecutar una vez en Supabase SQL Editor. No modifica source_key ni su unicidad.

begin;

create index if not exists rop02_fecha_idx on public.rop02 (fecha);
create index if not exists rop02_interno_idx on public.rop02 (interno);
create index if not exists rop02_proyecto_idx on public.rop02 (proyecto);
create index if not exists rop02_supervisor_delta_idx on public.rop02 (supervisor_delta);
create index if not exists rop02_turno_trabajo_idx on public.rop02 (turno_trabajo);
create index if not exists rop02_interno_fecha_idx on public.rop02 (interno, fecha desc);
create index if not exists rop02_proyecto_fecha_idx on public.rop02 (proyecto, fecha desc);
create index if not exists rop02_interno_proyecto_fecha_idx on public.rop02 (interno, proyecto, fecha desc);

create or replace view public.rop02_frontend with (security_invoker=true) as
select r.*,
  case when coalesce(r.cantidad_horas,0)>0 then 'TRABAJO'
    when upper(coalesce(r.descripcion_trabajos,'')||' '||coalesce(r.observaciones,'')) ~ '(^|[^A-Z])FS([^A-Z]|$)|FUERA DE SERVICIO' then 'FS'
    when upper(coalesce(r.descripcion_trabajos,'')||' '||coalesce(r.observaciones,'')) ~ '(^|[^A-Z])EM([^A-Z]|$)|MANTENIMIENTO' then 'EM'
    when upper(coalesce(r.descripcion_trabajos,'')||' '||coalesce(r.observaciones,'')) ~ '(^|[^A-Z])OD([^A-Z]|$)|ORDEN DEL DIA|ORDEN DEL DÍA' then 'OD'
    else 'SIN REGISTRO' end estado
from public.rop02 r;

alter table public.rop02 enable row level security;
revoke all on table public.rop02 from anon, authenticated;
grant select on table public.rop02 to anon, authenticated;
grant select on public.rop02_frontend to anon, authenticated;
drop policy if exists rop02_frontend_read_only on public.rop02;
create policy rop02_frontend_read_only on public.rop02
  for select to anon, authenticated using (true);

create or replace function public.rop02_latest_by_equipment_project(p_project text default null)
returns table (
  "INTERNO" text,"PROYECTO" text,"ULTIMA_FECHA" date,"ULTIMO_ESTADO" text,
  "HORAS" numeric,"SUPERVISOR" text,"CARGAS_7D" bigint
)
language sql stable security invoker set search_path=public
as $$
  with latest as (
    select distinct on (r.interno,r.proyecto)
      r.interno,r.proyecto,r.fecha,r.descripcion_trabajos,r.observaciones,
      r.cantidad_horas,r.supervisor_delta
    from public.rop02 r
    where p_project is null or r.proyecto=p_project
    order by r.interno,r.proyecto,r.fecha desc,r.updated_at desc nulls last
  ), max_date as (select max(fecha) value from public.rop02)
  select l.interno,l.proyecto,l.fecha,
    case when coalesce(l.cantidad_horas,0)>0 then 'TRABAJO'
      when upper(coalesce(l.descripcion_trabajos,'')||' '||coalesce(l.observaciones,'')) like '%FS%' then 'FS'
      when upper(coalesce(l.descripcion_trabajos,'')||' '||coalesce(l.observaciones,'')) like '%EM%' then 'EM'
      when upper(coalesce(l.descripcion_trabajos,'')||' '||coalesce(l.observaciones,'')) like '%OD%' then 'OD'
      else 'SIN REGISTRO' end,
    l.cantidad_horas,l.supervisor_delta,
    (select count(*) from public.rop02 x cross join max_date m
      where x.interno=l.interno and x.proyecto=l.proyecto and x.fecha>=m.value-6)
  from latest l;
$$;

create or replace function public.rop02_monthly_summary(p_from date default null,p_to date default null,p_project text default null)
returns table (periodo text,proyecto text,horas numeric,registros bigint,equipos bigint)
language sql stable security invoker set search_path=public
as $$
  select to_char(case when extract(day from r.fecha)>=26 then r.fecha+interval '1 month' else r.fecha end,'YYYY-MM') periodo,
    r.proyecto,sum(coalesce(r.cantidad_horas,0)) horas,count(*) registros,count(distinct r.interno) equipos
  from public.rop02 r
  where (p_from is null or r.fecha>=p_from) and (p_to is null or r.fecha<=p_to)
    and (p_project is null or r.proyecto=p_project)
  group by 1,2 order by 1,2;
$$;

create or replace function public.rop02_operational_snapshot(p_days integer default 7,p_project text default null)
returns setof public.rop02
language sql stable security invoker set search_path=public
as $$
  with reference as (select max(fecha) max_fecha from public.rop02),
  selected as (
    select r.*,row_number() over(partition by r.interno,r.proyecto order by r.fecha desc,r.updated_at desc nulls last) rn
    from public.rop02 r cross join reference x
    where (p_project is null or r.proyecto=p_project)
  )
  select r.*
  from selected s join public.rop02 r on r.id=s.id cross join reference x
  where s.rn=1 or s.fecha>=x.max_fecha-greatest(1,least(p_days,90));
$$;

create or replace function public.rop02_filtered_stats(
  p_from date default null,p_to date default null,p_projects text[] default null,
  p_equipment text[] default null,p_supervisors text[] default null,p_operators text[] default null,
  p_states text[] default null,p_task text default null
) returns jsonb language sql stable security invoker set search_path=public as $$
  with filtered as (
    select r.* from public.rop02_frontend r
    where (p_from is null or r.fecha>=p_from) and (p_to is null or r.fecha<=p_to)
      and (p_projects is null or r.proyecto=any(p_projects))
      and (p_equipment is null or r.interno=any(p_equipment))
      and (p_supervisors is null or r.supervisor_delta=any(p_supervisors))
      and (p_operators is null or r.operador=any(p_operators))
      and (p_states is null or r.estado=any(p_states))
      and (p_task is null or r.descripcion_trabajos ilike '%'||p_task||'%')
  ), daily as (
    select fecha,sum(coalesce(cantidad_horas,0)) horas from filtered group by fecha order by fecha
  )
  select jsonb_build_object(
    'horas',coalesce(sum(coalesce(f.cantidad_horas,0)),0),'comb',coalesce(sum(coalesce(f.combustible,0)),0),
    'equipos',count(distinct f.interno),'ops',count(distinct f.operador) filter(where coalesce(f.operador,'')<>''),
    'prod',count(*) filter(where f.estado='TRABAJO'),'od',count(*) filter(where f.estado='OD'),
    'fs',count(*) filter(where f.estado='FS'),'em',count(*) filter(where f.estado='EM'),
    'desgaste',count(*) filter(where coalesce(trim(f.informacion_desgaste),'')<>'' and lower(f.informacion_desgaste) not like '%sin consumo%'),
    'daily',(select coalesce(jsonb_agg(jsonb_build_object('fecha',d.fecha,'horas',d.horas)),'[]'::jsonb) from daily d)
  ) from filtered f;
$$;

revoke all on function public.rop02_latest_by_equipment_project(text) from public;
revoke all on function public.rop02_monthly_summary(date,date,text) from public;
grant execute on function public.rop02_latest_by_equipment_project(text) to anon, authenticated;
grant execute on function public.rop02_monthly_summary(date,date,text) to anon, authenticated;
revoke all on function public.rop02_operational_snapshot(integer,text) from public;
grant execute on function public.rop02_operational_snapshot(integer,text) to anon, authenticated;
revoke all on function public.rop02_filtered_stats(date,date,text[],text[],text[],text[],text[],text) from public;
grant execute on function public.rop02_filtered_stats(date,date,text[],text[],text[],text[],text[],text) to anon, authenticated;

commit;
