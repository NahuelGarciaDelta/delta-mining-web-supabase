-- Corrección idempotente de estado ROP02. Ejecutar en Supabase SQL Editor.
begin;

create or replace function public.rop02_classify_state(p_hours numeric,p_description text,p_observations text default null)
returns text language sql immutable parallel safe set search_path=public as $$
  select case when coalesce(p_hours,0)>0 then 'TRABAJO'
    when translate(upper(coalesce(p_description,'')||' '||coalesce(p_observations,'')),'ÁÉÍÓÚÜÑ','AEIOUUN') ~ '(^|[^A-Z])OD([^A-Z]|$)|A DISPOSICION|ORDEN DEL DIA' then 'OD'
    when translate(upper(coalesce(p_description,'')||' '||coalesce(p_observations,'')),'ÁÉÍÓÚÜÑ','AEIOUUN') ~ '(^|[^A-Z])FS([^A-Z]|$)|FUERA DE SERVICIO' then 'FS'
    when translate(upper(coalesce(p_description,'')||' '||coalesce(p_observations,'')),'ÁÉÍÓÚÜÑ','AEIOUUN') ~ '(^|[^A-Z])EM([^A-Z]|$)|EN MANTENIMIENTO|MANTENIMIENTO' then 'EM'
    else 'SIN REGISTRO' end
$$;

create or replace view public.rop02_frontend with (security_invoker=true) as
select r.*,public.rop02_classify_state(r.cantidad_horas,r.descripcion_trabajos,r.observaciones) estado
from public.rop02 r;

create or replace function public.rop02_latest_by_equipment_project(p_project text default null)
returns table ("INTERNO" text,"PROYECTO" text,"ULTIMA_FECHA" date,"ULTIMO_ESTADO" text,"HORAS" numeric,"SUPERVISOR" text,"CARGAS_7D" bigint)
language sql stable security invoker set search_path=public as $$
  with latest as (
    select distinct on (r.interno,r.proyecto) r.* from public.rop02_frontend r
    where p_project is null or r.proyecto=p_project
    order by r.interno,r.proyecto,r.fecha desc,r.updated_at desc nulls last
  ), max_date as (select max(fecha) value from public.rop02)
  select l.interno,l.proyecto,l.fecha,l.estado,l.cantidad_horas,l.supervisor_delta,
    (select count(*) from public.rop02 x cross join max_date m where x.interno=l.interno and x.proyecto=l.proyecto and x.fecha>=m.value-6)
  from latest l;
$$;

drop function if exists public.rop02_operational_snapshot(integer,text);
create function public.rop02_operational_snapshot(p_days integer default 7,p_project text default null)
returns setof public.rop02_frontend language sql stable security invoker set search_path=public as $$
  with reference as (select max(fecha) max_fecha from public.rop02), selected as (
    select r.*,row_number() over(partition by r.interno,r.proyecto order by r.fecha desc,r.updated_at desc nulls last) rn
    from public.rop02_frontend r cross join reference x where p_project is null or r.proyecto=p_project
  )
  select r.* from selected s join public.rop02_frontend r on r.id=s.id cross join reference x
  where s.rn=1 or s.fecha>=x.max_fecha-greatest(1,least(p_days,90));
$$;

grant select on public.rop02_frontend to anon,authenticated;
grant execute on function public.rop02_classify_state(numeric,text,text) to anon,authenticated;
grant execute on function public.rop02_latest_by_equipment_project(text) to anon,authenticated;
grant execute on function public.rop02_operational_snapshot(integer,text) to anon,authenticated;

commit;

-- Verificación puntual esperada: FS.
select interno,fecha,cantidad_horas,descripcion_trabajos,estado from public.rop02_frontend
where interno='EXC-0034' and fecha=date '2026-08-13';
