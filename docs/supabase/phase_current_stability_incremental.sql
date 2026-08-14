-- Delta Mining OPS - cierre de estabilidad ROP02/ROP05/RMA15
-- Incremental, sin UPDATE/INSERT/DELETE sobre datos operativos.

begin;

create or replace function public.rop02_is_excluded_equipment(value text)
returns boolean language sql immutable parallel safe as $$
  select case
    when regexp_replace(upper(coalesce(value,'')), '[^A-Z0-9]', '', 'g') in ('CAA0002','CAA0002JM') then true
    when regexp_replace(upper(coalesce(value,'')), '[^A-Z0-9]', '', 'g') ~ '^[A-Z]{2}[0-9]{3}[A-Z]{2}$' then true
    when regexp_replace(upper(coalesce(value,'')), '[^A-Z0-9]', '', 'g') ~ '^[A-Z]{3}[0-9]{3}([A-Z]{2})?$' then true
    when regexp_replace(upper(trim(coalesce(value,''))), '[-_[:space:]]+JM$', '') ~ '^(CTA|CAR|CAV|CAC)' then true
    when regexp_replace(upper(trim(coalesce(value,''))), '[-_[:space:]]+JM$', '') ~ '^A[GH][0-9]' then true
    when regexp_replace(upper(trim(coalesce(value,''))), '[-_[:space:]]+JM$', '') ~ '^CAT-[0-9]' then true
    when regexp_replace(upper(trim(coalesce(value,''))), '[-_[:space:]]+JM$', '') in
      ('1088','CATERPILLAR','CAT','CX21067','DE-169','DE169','DELTA') then true
    else false
  end;
$$;

create or replace view public.rop02_operational_frontend with (security_invoker=true) as
select r.* from public.rop02_frontend r
join public.rop02 source on source.id=r.id
where source.source_dataset=any(array['rop02_fs','rop02_jm','rop02_filosur','rop02_zorro'])
  and source.source_row is not null
  and not public.rop02_is_excluded_equipment(r.interno);

grant select on public.rop02_operational_frontend to anon, authenticated;

create or replace function public.rop02_monthly_summary(p_from date default null,p_to date default null,p_project text default null)
returns table(periodo text,proyecto text,horas numeric,registros bigint,equipos bigint)
language sql stable security invoker set search_path=public as $$
  select to_char(case when extract(day from r.fecha)>=26 then r.fecha+interval '1 month' else r.fecha end,'YYYY-MM'),
    r.proyecto,sum(coalesce(r.cantidad_horas,0)),count(*),count(distinct r.interno)
  from public.rop02_operational_frontend r
  where (p_from is null or r.fecha>=p_from) and (p_to is null or r.fecha<=p_to)
    and (p_project is null or r.proyecto=p_project)
  group by 1,2 order by 1,2;
$$;

create or replace function public.rop02_latest_by_equipment_project(p_project text default null)
returns table("INTERNO" text,"PROYECTO" text,"ULTIMA_FECHA" date,"ULTIMO_ESTADO" text,"HORAS" numeric,"SUPERVISOR" text,"CARGAS_7D" bigint)
language sql stable security invoker set search_path=public as $$
  with canonical as (
    select r.* from public.rop02 r
    where r.source_dataset=any(array['rop02_fs','rop02_jm','rop02_filosur','rop02_zorro']) and r.source_row is not null
  ), latest as (
    select distinct on (r.interno,r.proyecto) r.* from canonical r
    where p_project is null or r.proyecto=p_project
    order by r.interno,r.proyecto,r.fecha desc,r.updated_at desc nulls last,r.id desc
  ), reference as (select max(fecha) max_fecha from canonical)
  select l.interno,l.proyecto,l.fecha,
    public.rop02_classify_state(l.cantidad_horas,l.descripcion_trabajos,l.observaciones),
    coalesce(l.cantidad_horas,0),l.supervisor_delta,
    (select count(distinct x.fecha) from canonical x cross join reference m
      where x.interno=l.interno and x.proyecto=l.proyecto and x.fecha>=m.max_fecha-6)
  from latest l;
$$;

create or replace function public.rop02_operational_snapshot(p_days integer default 7,p_project text default null)
returns setof public.rop02 language sql stable security invoker set search_path=public as $$
  with canonical as (
    select r.* from public.rop02 r
    where r.source_dataset=any(array['rop02_fs','rop02_jm','rop02_filosur','rop02_zorro']) and r.source_row is not null
  ), reference as (select max(fecha) max_fecha from canonical), selected as (
    select r.*,row_number() over(partition by r.interno,r.proyecto order by r.fecha desc,r.updated_at desc nulls last,r.id desc) rn
    from canonical r where p_project is null or r.proyecto=p_project
  )
  select base.* from selected s join public.rop02 base on base.id=s.id cross join reference x
  where s.rn=1 or s.fecha>=x.max_fecha-greatest(1,least(p_days,90));
$$;

create or replace function public.rop02_filtered_stats(
  p_from date default null,p_to date default null,p_projects text[] default null,
  p_equipment text[] default null,p_supervisors text[] default null,p_operators text[] default null,
  p_states text[] default null,p_task text default null
) returns jsonb language sql stable security invoker set search_path=public as $$
  with filtered as (
    select r.* from public.rop02_operational_frontend r
    where (p_from is null or r.fecha>=p_from) and (p_to is null or r.fecha<=p_to)
      and (p_projects is null or r.proyecto=any(p_projects))
      and (p_equipment is null or r.interno=any(p_equipment))
      and (p_supervisors is null or r.supervisor_delta=any(p_supervisors))
      and (p_operators is null or r.operador=any(p_operators))
      and (p_states is null or r.estado=any(p_states))
      and (p_task is null or r.descripcion_trabajos ilike '%'||p_task||'%')
  ), daily as (
    select fecha,sum(coalesce(cantidad_horas,0)) horas from filtered group by fecha order by fecha
  ), projects as (
    select proyecto,count(*) registros,sum(coalesce(cantidad_horas,0)) horas,
      sum(coalesce(combustible,0)) combustible,count(distinct interno) equipos
    from filtered group by proyecto order by proyecto
  )
  select jsonb_build_object(
    'registros',count(*),'horas',coalesce(sum(coalesce(f.cantidad_horas,0)),0),
    'comb',coalesce(sum(coalesce(f.combustible,0)),0),'equipos',count(distinct f.interno),
    'ops',count(distinct f.operador) filter(where coalesce(f.operador,'')<>''),
    'prod',count(*) filter(where f.estado='TRABAJO'),'od',count(*) filter(where f.estado='OD'),
    'fs',count(*) filter(where f.estado='FS'),'em',count(*) filter(where f.estado='EM'),
    'desgaste',count(*) filter(where coalesce(trim(f.informacion_desgaste),'')<>'' and lower(f.informacion_desgaste) not like '%sin consumo%'),
    'daily',(select coalesce(jsonb_agg(jsonb_build_object('fecha',d.fecha,'horas',d.horas)),'[]'::jsonb) from daily d),
    'projects',(select coalesce(jsonb_agg(to_jsonb(p)),'[]'::jsonb) from projects p)
  ) from filtered f;
$$;

create or replace function public.rop02_facets(
  p_from date default null,p_to date default null,p_projects text[] default null,
  p_equipment text[] default null,p_supervisors text[] default null,p_operators text[] default null,
  p_states text[] default null
) returns jsonb language sql stable security invoker set search_path=public as $$
  with base as (select * from public.rop02_operational_frontend r where
    (p_from is null or r.fecha>=p_from) and (p_to is null or r.fecha<=p_to))
  select jsonb_build_object(
    'proyecto',(select coalesce(jsonb_agg(distinct proyecto order by proyecto),'[]') from base where (p_equipment is null or interno=any(p_equipment)) and (p_supervisors is null or supervisor_delta=any(p_supervisors)) and (p_operators is null or operador=any(p_operators)) and (p_states is null or estado=any(p_states))),
    'maquina',(select coalesce(jsonb_agg(distinct interno order by interno),'[]') from base where (p_projects is null or proyecto=any(p_projects)) and (p_supervisors is null or supervisor_delta=any(p_supervisors)) and (p_operators is null or operador=any(p_operators)) and (p_states is null or estado=any(p_states))),
    'supervisor',(select coalesce(jsonb_agg(distinct supervisor_delta order by supervisor_delta) filter(where supervisor_delta<>''),'[]') from base where (p_projects is null or proyecto=any(p_projects)) and (p_equipment is null or interno=any(p_equipment)) and (p_operators is null or operador=any(p_operators)) and (p_states is null or estado=any(p_states))),
    'operario',(select coalesce(jsonb_agg(distinct operador order by operador) filter(where operador<>''),'[]') from base where (p_projects is null or proyecto=any(p_projects)) and (p_equipment is null or interno=any(p_equipment)) and (p_supervisors is null or supervisor_delta=any(p_supervisors)) and (p_states is null or estado=any(p_states))),
    'estado',(select coalesce(jsonb_agg(distinct estado order by estado),'[]') from base where (p_projects is null or proyecto=any(p_projects)) and (p_equipment is null or interno=any(p_equipment)) and (p_supervisors is null or supervisor_delta=any(p_supervisors)) and (p_operators is null or operador=any(p_operators)))
  );
$$;

create or replace function public.rop02_rop05_control(
  p_from date default null,p_to date default null,p_projects text[] default null,p_equipment text[] default null
) returns jsonb language sql stable security invoker set search_path=public as $$
  with r02 as (
    select fecha,proyecto,interno,supervisor_delta supervisor,numero_parte,cantidad_horas horas,
      descripcion_trabajos tarea,estado
    from public.rop02_operational_frontend
    where estado='TRABAJO' and proyecto<>'EL ZORRO'
      and (p_from is null or fecha>=p_from) and (p_to is null or fecha<=p_to)
      and (p_projects is null or proyecto=any(p_projects)) and (p_equipment is null or interno=any(p_equipment))
  ), r05 as (
    select fecha,proyecto,case when regexp_replace(upper(interno),'[^A-Z0-9]','','g')='RCP0039' then 'RPC-0039' else interno end interno,
      supervisor,numero_parte,horas_productivas horas,tarea,cantidad_produccion cantidad,unidad
    from public.rop05
    where not public.rop02_is_excluded_equipment(interno)
      and (p_from is null or fecha>=p_from) and (p_to is null or fecha<=p_to)
      and (p_projects is null or proyecto=any(p_projects)) and (p_equipment is null or interno=any(p_equipment))
  ), missing05 as (select a.* from r02 a where not exists(select 1 from r05 b where b.fecha=a.fecha and b.interno=a.interno)),
  missing02 as (select b.* from r05 b where not exists(select 1 from r02 a where a.fecha=b.fecha and a.interno=b.interno))
  select jsonb_build_object('total',(select count(*) from r02)+(select count(*) from r05),
    'problemas',(select count(*) from missing05)+(select count(*) from missing02),
    'faltanEn05',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from missing05 x),
    'faltanEn02',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from missing02 x));
$$;

create or replace function public.rma15_equipment_universe(p_year integer default 2026)
returns table(interno text) language sql stable security invoker set search_path=public as $$
  select distinct case when regexp_replace(upper(r.interno),'[^A-Z0-9]','','g')='RCP0039' then 'RPC0039' else regexp_replace(upper(r.interno),'[^A-Z0-9]','','g') end
  from public.rma15 r where r.fecha_ot>=make_date(p_year,1,1) and r.fecha_ot<make_date(p_year+1,1,1)
    and coalesce(trim(r.interno),'')<>'' order by 1;
$$;

create or replace function public.rma15_open_ot_summary()
returns table(interno text,lugar text,"fechaNoOperativo" date,ot text,estado text)
language sql stable security invoker set search_path=public as $$
  with sequenced as (
    select r.*,regexp_replace(upper(r.interno),'[^A-Z0-9]','','g') code,
      row_number() over(partition by regexp_replace(upper(r.interno),'[^A-Z0-9]','','g') order by r.fecha_ot,r.source_dataset,r.source_row) seq
    from public.rma15 r where coalesce(trim(r.interno),'')<>'' and r.fecha_ot is not null
  ), latest as (
    select distinct on (code) * from sequenced order by code,seq desc
  ), open_latest as (select * from latest where equipo_operativo=false), last_ok as (
    select l.code,max(s.seq) last_ok_seq from open_latest l left join sequenced s on s.code=l.code and s.seq<l.seq and s.equipo_operativo=true group by l.code
  ), starts as (
    select l.code,min(s.fecha_ot) start_date from open_latest l join last_ok k using(code)
    join sequenced s on s.code=l.code and s.seq>coalesce(k.last_ok_seq,0) and s.equipo_operativo=false group by l.code
  )
  select case when l.code='RCP0039' then 'RPC0039' else l.code end,
    coalesce(nullif(l.lugar,''),l.proyecto),s.start_date,
    coalesce(l.raw_data->>'N° OT',l.raw_data->>'Nº OT',l.raw_data->>'OT',l.raw_data->>'Orden de trabajo',''),
    case when l.equipo_operativo=false then 'NO' else coalesce(l.raw_data->>'Estado','') end
  from open_latest l join starts s using(code) order by s.start_date,l.code;
$$;

revoke all on function public.rop02_facets(date,date,text[],text[],text[],text[],text[]) from public;
revoke all on function public.rop02_rop05_control(date,date,text[],text[]) from public;
revoke all on function public.rma15_equipment_universe(integer) from public;
revoke all on function public.rma15_open_ot_summary() from public;
grant execute on function public.rop02_facets(date,date,text[],text[],text[],text[],text[]) to anon,authenticated;
grant execute on function public.rop02_rop05_control(date,date,text[],text[]) to anon,authenticated;
grant execute on function public.rma15_equipment_universe(integer) to anon,authenticated;
grant execute on function public.rma15_open_ot_summary() to anon,authenticated;

commit;
