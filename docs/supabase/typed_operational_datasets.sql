-- DELTA MINING OPS - FASE 2: DATASETS OPERATIVOS TIPADOS
-- Ejecutar después de la Fase 1 ROP02 validada. No modifica public.rop02.

begin;

create table if not exists public.rop05 (
  id bigint generated always as identity primary key,
  source_dataset text not null,
  source_row integer not null check (source_row > 0),
  fecha date, mes text, ancho numeric, largo numeric, profundidad numeric,
  tarea text, proyecto text, interno text, supervisor text, tipo_equipo text,
  numero_parte text, unidad text, horas_productivas numeric,
  cantidad_produccion numeric, observaciones text,
  raw_data jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (source_dataset, source_row)
);

create table if not exists public.rma15 (
  id bigint generated always as identity primary key,
  source_dataset text not null,
  source_row integer not null check (source_row > 0),
  fecha_ot date, proyecto text, equipo text, interno text, km_hs numeric,
  tipo_mantenimiento text, equipo_operativo boolean, turno text, lugar text,
  intervencion text, observaciones text, mail_avisado text,
  raw_data jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (source_dataset, source_row)
);

create table if not exists public.rma15_insumos (
  id bigint generated always as identity primary key,
  rma15_id bigint not null references public.rma15(id) on delete cascade,
  posicion smallint not null check (posicion between 1 and 10),
  codigo text, nombre text, cantidad numeric,
  unique (rma15_id, posicion)
);

create table if not exists public.lista_equipos (
  id bigint generated always as identity primary key,
  source_dataset text not null,
  source_row integer not null check (source_row > 0),
  codigo_nuevo text, codigo_drusila text, familia text, marca text, modelo text,
  potencia text, numero_serie text, vida_util_hs_km numeric, lugar_alquiler text,
  horas numeric, horas_trabajo_mes numeric, tipo_combustible text,
  anio_fabricacion integer, cantidad_neumaticos integer, horas_hombre_mecanico numeric,
  consumo_combustible text, capacidad text, fecha_ingreso date,
  costo_local_usd numeric, tarifa_mensual_usd numeric,
  costo_neumatico_unidad numeric, propiedad text,
  raw_data jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (source_dataset, source_row)
);

create table if not exists public.insumos (
  id bigint generated always as identity primary key,
  source_dataset text not null,
  source_row integer not null check (source_row > 0),
  codigo text, descripcion text, precio_unitario numeric,
  descripcion_adicional text, raw_data jsonb not null default '{}'::jsonb,
  synced_at timestamptz not null default now(),
  unique (source_dataset, source_row)
);

create index if not exists idx_rop05_fecha on public.rop05(fecha);
create index if not exists idx_rop05_proyecto_fecha on public.rop05(proyecto,fecha);
create index if not exists idx_rop05_interno_fecha on public.rop05(interno,fecha);
create index if not exists idx_rop05_supervisor_fecha on public.rop05(supervisor,fecha);
create index if not exists idx_rma15_fecha on public.rma15(fecha_ot);
create index if not exists idx_rma15_proyecto_fecha on public.rma15(proyecto,fecha_ot);
create index if not exists idx_rma15_interno_fecha on public.rma15(interno,fecha_ot);
create index if not exists idx_rma15_tipo_fecha on public.rma15(tipo_mantenimiento,fecha_ot);
create index if not exists idx_rma15_insumos_codigo on public.rma15_insumos(codigo);
create index if not exists idx_lista_equipos_codigo_nuevo on public.lista_equipos(codigo_nuevo);
create index if not exists idx_lista_equipos_codigo_drusila on public.lista_equipos(codigo_drusila);
create index if not exists idx_insumos_codigo on public.insumos(codigo);

alter table public.rop05 enable row level security;
alter table public.rma15 enable row level security;
alter table public.rma15_insumos enable row level security;
alter table public.lista_equipos enable row level security;
alter table public.insumos enable row level security;

do $policies$
declare t text;
begin
  foreach t in array array['rop05','rma15','rma15_insumos','lista_equipos','insumos'] loop
    execute format('drop policy if exists %I on public.%I',t||'_read',t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)',t||'_read',t);
    execute format('grant select on public.%I to anon, authenticated',t);
    execute format('revoke insert, update, delete on public.%I from anon, authenticated',t);
  end loop;
end $policies$;

-- Reemplaza exactamente un dataset físico. La lista completa de filas recibidas
-- permite eliminar del espejo las que fueron borradas o vaciadas en Sheets.
create or replace function public.sync_typed_dataset(p_dataset text,p_rows jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_seen int:=jsonb_array_length(coalesce(p_rows,'[]'::jsonb)); v_deleted int:=0;
begin
  if p_dataset='rop05' then
    insert into rop05(source_dataset,source_row,fecha,mes,ancho,largo,profundidad,tarea,proyecto,interno,supervisor,tipo_equipo,numero_parte,unidad,horas_productivas,cantidad_produccion,observaciones,raw_data,synced_at)
    select p_dataset,(x->>'source_row')::int,(x->>'fecha')::date,x->>'mes',nullif(x->>'ancho','')::numeric,nullif(x->>'largo','')::numeric,nullif(x->>'profundidad','')::numeric,x->>'tarea',x->>'proyecto',x->>'interno',x->>'supervisor',x->>'tipo_equipo',x->>'numero_parte',x->>'unidad',nullif(x->>'horas_productivas','')::numeric,nullif(x->>'cantidad_produccion','')::numeric,x->>'observaciones',coalesce(x->'raw_data','{}'),now() from jsonb_array_elements(coalesce(p_rows,'[]')) x
    on conflict(source_dataset,source_row) do update set fecha=excluded.fecha,mes=excluded.mes,ancho=excluded.ancho,largo=excluded.largo,profundidad=excluded.profundidad,tarea=excluded.tarea,proyecto=excluded.proyecto,interno=excluded.interno,supervisor=excluded.supervisor,tipo_equipo=excluded.tipo_equipo,numero_parte=excluded.numero_parte,unidad=excluded.unidad,horas_productivas=excluded.horas_productivas,cantidad_produccion=excluded.cantidad_produccion,observaciones=excluded.observaciones,raw_data=excluded.raw_data,synced_at=now();
    delete from rop05 r where r.source_dataset=p_dataset and not exists(select 1 from jsonb_array_elements(coalesce(p_rows,'[]')) x where (x->>'source_row')::int=r.source_row); get diagnostics v_deleted=row_count;
  elsif p_dataset in ('rma15_fs','rma15_jm') then
    insert into rma15(source_dataset,source_row,fecha_ot,proyecto,equipo,interno,km_hs,tipo_mantenimiento,equipo_operativo,turno,lugar,intervencion,observaciones,mail_avisado,raw_data,synced_at)
    select p_dataset,(x->>'source_row')::int,(x->>'fecha_ot')::date,x->>'proyecto',x->>'equipo',x->>'interno',nullif(x->>'km_hs','')::numeric,x->>'tipo_mantenimiento',nullif(x->>'equipo_operativo','')::boolean,x->>'turno',x->>'lugar',x->>'intervencion',x->>'observaciones',x->>'mail_avisado',coalesce(x->'raw_data','{}'),now() from jsonb_array_elements(coalesce(p_rows,'[]')) x
    on conflict(source_dataset,source_row) do update set fecha_ot=excluded.fecha_ot,proyecto=excluded.proyecto,equipo=excluded.equipo,interno=excluded.interno,km_hs=excluded.km_hs,tipo_mantenimiento=excluded.tipo_mantenimiento,equipo_operativo=excluded.equipo_operativo,turno=excluded.turno,lugar=excluded.lugar,intervencion=excluded.intervencion,observaciones=excluded.observaciones,mail_avisado=excluded.mail_avisado,raw_data=excluded.raw_data,synced_at=now();
    delete from rma15 r where r.source_dataset=p_dataset and not exists(select 1 from jsonb_array_elements(coalesce(p_rows,'[]')) x where (x->>'source_row')::int=r.source_row); get diagnostics v_deleted=row_count;
    delete from rma15_insumos i using rma15 r where i.rma15_id=r.id and r.source_dataset=p_dataset;
    insert into rma15_insumos(rma15_id,posicion,codigo,nombre,cantidad)
    select r.id,(i->>'posicion')::smallint,i->>'codigo',i->>'nombre',nullif(i->>'cantidad','')::numeric from jsonb_array_elements(coalesce(p_rows,'[]')) x join rma15 r on r.source_dataset=p_dataset and r.source_row=(x->>'source_row')::int cross join lateral jsonb_array_elements(coalesce(x->'insumos','[]')) i;
  elsif p_dataset='lista_equipos' then
    insert into lista_equipos(source_dataset,source_row,codigo_nuevo,codigo_drusila,familia,marca,modelo,potencia,numero_serie,vida_util_hs_km,lugar_alquiler,horas,horas_trabajo_mes,tipo_combustible,anio_fabricacion,cantidad_neumaticos,horas_hombre_mecanico,consumo_combustible,capacidad,fecha_ingreso,costo_local_usd,tarifa_mensual_usd,costo_neumatico_unidad,propiedad,raw_data,synced_at)
    select p_dataset,(x->>'source_row')::int,x->>'codigo_nuevo',x->>'codigo_drusila',x->>'familia',x->>'marca',x->>'modelo',x->>'potencia',x->>'numero_serie',nullif(x->>'vida_util_hs_km','')::numeric,x->>'lugar_alquiler',nullif(x->>'horas','')::numeric,nullif(x->>'horas_trabajo_mes','')::numeric,x->>'tipo_combustible',nullif(x->>'anio_fabricacion','')::int,nullif(x->>'cantidad_neumaticos','')::int,nullif(x->>'horas_hombre_mecanico','')::numeric,x->>'consumo_combustible',x->>'capacidad',nullif(x->>'fecha_ingreso','')::date,nullif(x->>'costo_local_usd','')::numeric,nullif(x->>'tarifa_mensual_usd','')::numeric,nullif(x->>'costo_neumatico_unidad','')::numeric,x->>'propiedad',coalesce(x->'raw_data','{}'),now() from jsonb_array_elements(coalesce(p_rows,'[]')) x
    on conflict(source_dataset,source_row) do update set codigo_nuevo=excluded.codigo_nuevo,codigo_drusila=excluded.codigo_drusila,familia=excluded.familia,marca=excluded.marca,modelo=excluded.modelo,potencia=excluded.potencia,numero_serie=excluded.numero_serie,vida_util_hs_km=excluded.vida_util_hs_km,lugar_alquiler=excluded.lugar_alquiler,horas=excluded.horas,horas_trabajo_mes=excluded.horas_trabajo_mes,tipo_combustible=excluded.tipo_combustible,anio_fabricacion=excluded.anio_fabricacion,cantidad_neumaticos=excluded.cantidad_neumaticos,horas_hombre_mecanico=excluded.horas_hombre_mecanico,consumo_combustible=excluded.consumo_combustible,capacidad=excluded.capacidad,fecha_ingreso=excluded.fecha_ingreso,costo_local_usd=excluded.costo_local_usd,tarifa_mensual_usd=excluded.tarifa_mensual_usd,costo_neumatico_unidad=excluded.costo_neumatico_unidad,propiedad=excluded.propiedad,raw_data=excluded.raw_data,synced_at=now();
    delete from lista_equipos r where r.source_dataset=p_dataset and not exists(select 1 from jsonb_array_elements(coalesce(p_rows,'[]')) x where (x->>'source_row')::int=r.source_row); get diagnostics v_deleted=row_count;
  elsif p_dataset='insumos' then
    insert into insumos(source_dataset,source_row,codigo,descripcion,precio_unitario,descripcion_adicional,raw_data,synced_at)
    select p_dataset,(x->>'source_row')::int,x->>'codigo',x->>'descripcion',nullif(x->>'precio_unitario','')::numeric,x->>'descripcion_adicional',coalesce(x->'raw_data','{}'),now() from jsonb_array_elements(coalesce(p_rows,'[]')) x
    on conflict(source_dataset,source_row) do update set codigo=excluded.codigo,descripcion=excluded.descripcion,precio_unitario=excluded.precio_unitario,descripcion_adicional=excluded.descripcion_adicional,raw_data=excluded.raw_data,synced_at=now();
    delete from insumos r where r.source_dataset=p_dataset and not exists(select 1 from jsonb_array_elements(coalesce(p_rows,'[]')) x where (x->>'source_row')::int=r.source_row); get diagnostics v_deleted=row_count;
  else raise exception 'Dataset no permitido: %',p_dataset;
  end if;
  return jsonb_build_object('ok',true,'dataset',p_dataset,'sourceRows',v_seen,'deleted',v_deleted);
end $$;

revoke all on function public.sync_typed_dataset(text,jsonb) from public,anon,authenticated;
grant execute on function public.sync_typed_dataset(text,jsonb) to service_role;

create or replace view public.rma15_frontend as
select r.*,coalesce(jsonb_agg(jsonb_build_object('posicion',i.posicion,'codigo',i.codigo,'nombre',i.nombre,'cantidad',i.cantidad) order by i.posicion) filter(where i.id is not null),'[]') insumos
from rma15 r left join rma15_insumos i on i.rma15_id=r.id group by r.id;
grant select on public.rma15_frontend to anon,authenticated;

create or replace function public.rma15_insumos_diagnostico()
returns table(codigo text,nombre text,usos bigint,estado text,precio_unitario numeric)
language sql stable security invoker as $$
 select i.codigo,max(i.nombre),count(*),case when c.codigo is null then 'FALTANTE' when c.precio_unitario is null then 'SIN_PRECIO' else 'VALORIZADO' end,max(c.precio_unitario)
 from rma15_insumos i left join insumos c on upper(regexp_replace(c.codigo,'[^A-Z0-9]','','g'))=upper(regexp_replace(i.codigo,'[^A-Z0-9]','','g'))
 where nullif(trim(i.codigo),'') is not null group by i.codigo,c.codigo,c.precio_unitario;
$$;
grant execute on function public.rma15_insumos_diagnostico() to anon,authenticated;

-- Facetas: cada dimensión se calcula aplicando todos los filtros salvo el propio.
-- Los parámetros son arrays para conservar la semántica multiselección del frontend.
create or replace function public.rop05_facets(
  p_desde date default null,p_hasta date default null,p_proyectos text[] default null,
  p_internos text[] default null,p_supervisores text[] default null,p_unidades text[] default null,
  p_tareas text[] default null,p_tipos_equipo text[] default null)
returns jsonb language sql stable security invoker as $$
select jsonb_build_object(
 'proyectos',(select coalesce(jsonb_agg(v order by v),'[]') from (select distinct proyecto v from rop05 where (p_desde is null or fecha>=p_desde) and (p_hasta is null or fecha<=p_hasta) and (p_internos is null or interno=any(p_internos)) and (p_supervisores is null or supervisor=any(p_supervisores)) and (p_unidades is null or unidad=any(p_unidades)) and (p_tareas is null or tarea=any(p_tareas)) and (p_tipos_equipo is null or tipo_equipo=any(p_tipos_equipo)) and proyecto is not null)s),
 'internos',(select coalesce(jsonb_agg(v order by v),'[]') from (select distinct interno v from rop05 where (p_desde is null or fecha>=p_desde) and (p_hasta is null or fecha<=p_hasta) and (p_proyectos is null or proyecto=any(p_proyectos)) and (p_supervisores is null or supervisor=any(p_supervisores)) and (p_unidades is null or unidad=any(p_unidades)) and (p_tareas is null or tarea=any(p_tareas)) and (p_tipos_equipo is null or tipo_equipo=any(p_tipos_equipo)) and interno is not null)s),
 'supervisores',(select coalesce(jsonb_agg(v order by v),'[]') from (select distinct supervisor v from rop05 where (p_desde is null or fecha>=p_desde) and (p_hasta is null or fecha<=p_hasta) and (p_proyectos is null or proyecto=any(p_proyectos)) and (p_internos is null or interno=any(p_internos)) and (p_unidades is null or unidad=any(p_unidades)) and (p_tareas is null or tarea=any(p_tareas)) and (p_tipos_equipo is null or tipo_equipo=any(p_tipos_equipo)) and supervisor is not null)s),
 'unidades',(select coalesce(jsonb_agg(v order by v),'[]') from (select distinct unidad v from rop05 where (p_desde is null or fecha>=p_desde) and (p_hasta is null or fecha<=p_hasta) and (p_proyectos is null or proyecto=any(p_proyectos)) and (p_internos is null or interno=any(p_internos)) and (p_supervisores is null or supervisor=any(p_supervisores)) and (p_tareas is null or tarea=any(p_tareas)) and (p_tipos_equipo is null or tipo_equipo=any(p_tipos_equipo)) and unidad is not null)s),
 'tareas',(select coalesce(jsonb_agg(v order by v),'[]') from (select distinct tarea v from rop05 where (p_desde is null or fecha>=p_desde) and (p_hasta is null or fecha<=p_hasta) and (p_proyectos is null or proyecto=any(p_proyectos)) and (p_internos is null or interno=any(p_internos)) and (p_supervisores is null or supervisor=any(p_supervisores)) and (p_unidades is null or unidad=any(p_unidades)) and (p_tipos_equipo is null or tipo_equipo=any(p_tipos_equipo)) and tarea is not null)s),
 'tiposEquipo',(select coalesce(jsonb_agg(v order by v),'[]') from (select distinct tipo_equipo v from rop05 where (p_desde is null or fecha>=p_desde) and (p_hasta is null or fecha<=p_hasta) and (p_proyectos is null or proyecto=any(p_proyectos)) and (p_internos is null or interno=any(p_internos)) and (p_supervisores is null or supervisor=any(p_supervisores)) and (p_unidades is null or unidad=any(p_unidades)) and (p_tareas is null or tarea=any(p_tareas)) and tipo_equipo is not null)s));
$$;
grant execute on function public.rop05_facets(date,date,text[],text[],text[],text[],text[],text[]) to anon,authenticated;

create or replace function public.rma15_facets(p_desde date default null,p_hasta date default null,p_proyectos text[] default null,p_internos text[] default null,p_tipos text[] default null,p_operativos boolean[] default null)
returns jsonb language sql stable security invoker as $$
select jsonb_build_object(
 'proyectos',(select coalesce(jsonb_agg(v order by v),'[]') from (select distinct proyecto v from rma15 where (p_desde is null or fecha_ot>=p_desde) and (p_hasta is null or fecha_ot<=p_hasta) and (p_internos is null or interno=any(p_internos)) and (p_tipos is null or tipo_mantenimiento=any(p_tipos)) and (p_operativos is null or equipo_operativo=any(p_operativos)) and proyecto is not null)s),
 'internos',(select coalesce(jsonb_agg(v order by v),'[]') from (select distinct interno v from rma15 where (p_desde is null or fecha_ot>=p_desde) and (p_hasta is null or fecha_ot<=p_hasta) and (p_proyectos is null or proyecto=any(p_proyectos)) and (p_tipos is null or tipo_mantenimiento=any(p_tipos)) and (p_operativos is null or equipo_operativo=any(p_operativos)) and interno is not null)s),
 'tipos',(select coalesce(jsonb_agg(v order by v),'[]') from (select distinct tipo_mantenimiento v from rma15 where (p_desde is null or fecha_ot>=p_desde) and (p_hasta is null or fecha_ot<=p_hasta) and (p_proyectos is null or proyecto=any(p_proyectos)) and (p_internos is null or interno=any(p_internos)) and (p_operativos is null or equipo_operativo=any(p_operativos)) and tipo_mantenimiento is not null)s),
 'operativos',(select coalesce(jsonb_agg(v order by v),'[]') from (select distinct equipo_operativo v from rma15 where (p_desde is null or fecha_ot>=p_desde) and (p_hasta is null or fecha_ot<=p_hasta) and (p_proyectos is null or proyecto=any(p_proyectos)) and (p_internos is null or interno=any(p_internos)) and (p_tipos is null or tipo_mantenimiento=any(p_tipos)) and equipo_operativo is not null)s));
$$;
grant execute on function public.rma15_facets(date,date,text[],text[],text[],boolean[]) to anon,authenticated;

create or replace function public.typed_operational_counts()
returns table(dataset text,total bigint,con_origen bigint,con_fila bigint,duplicados_fisicos bigint)
language sql stable security invoker as $$
 select 'rop05',count(*),count(source_dataset),count(source_row),count(*)-count(distinct (source_dataset,source_row)) from rop05
 union all select 'rma15',count(*),count(source_dataset),count(source_row),count(*)-count(distinct (source_dataset,source_row)) from rma15
 union all select 'lista_equipos',count(*),count(source_dataset),count(source_row),count(*)-count(distinct (source_dataset,source_row)) from lista_equipos
 union all select 'insumos',count(*),count(source_dataset),count(source_row),count(*)-count(distinct (source_dataset,source_row)) from insumos;
$$;
grant execute on function public.typed_operational_counts() to anon,authenticated;

commit;

-- Control de cierre (ejecutar después de sincronizar):
select 'rop05' dataset,count(*) total,count(source_dataset) con_origen,count(source_row) con_fila from public.rop05
union all select 'rma15',count(*),count(source_dataset),count(source_row) from public.rma15
union all select 'lista_equipos',count(*),count(source_dataset),count(source_row) from public.lista_equipos
union all select 'insumos',count(*),count(source_dataset),count(source_row) from public.insumos;
