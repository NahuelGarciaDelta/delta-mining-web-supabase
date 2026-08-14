-- ROP02 Drive -> Supabase reconciliation, applied to project jwfocqaxlckuxoklwyxs on 2026-08-14.
-- Source identity contract: (source_dataset, source_row).
-- Normal frontend reads remain on public views/RPCs; these helpers live in private schema.

create schema if not exists private;
create extension if not exists http with schema extensions;

create table if not exists public.rop02_backup_pre_drive_reconcile_20260814 as table public.rop02 with no data;
alter table public.rop02_backup_pre_drive_reconcile_20260814 enable row level security;
revoke all on public.rop02_backup_pre_drive_reconcile_20260814 from anon, authenticated;

create table if not exists private.rop02_sync_stage (
  source_dataset text not null,
  source_row integer not null,
  fecha date not null,
  interno text not null,
  equipo text,
  operador text,
  supervisor_delta text,
  supervisor_vial_cliente text,
  turno_trabajo text,
  numero_parte text,
  proyecto text not null,
  horometro_inicial numeric,
  horometro_final numeric,
  cantidad_horas numeric,
  combustible numeric,
  aceite numeric,
  descripcion_trabajos text,
  informacion_desgaste text,
  observaciones text,
  source_key text not null,
  primary key(source_dataset, source_row)
);

create table if not exists private.rop02_hash_stage (
  source_dataset text not null,
  source_row integer not null,
  row_hash text not null,
  primary key(source_dataset, source_row)
);

create or replace function private.rop02_try_numeric(p_value text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare v text := btrim(coalesce(p_value,''));
begin
  if v = '' then return null; end if;
  if v ~ '^-?[0-9]+([.,][0-9]+)?$' then
    return replace(v, ',', '.')::numeric;
  end if;
  return null;
exception when others then return null;
end
$$;

create or replace function private.stage_rop02_page(p_dataset text, p_offset integer default 0, p_limit integer default 500)
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_url text;
  v_json jsonb;
  v_project text;
  v_header_row integer := 4;
  v_rows integer := 0;
  v_last_row integer := 0;
begin
  if p_dataset not in ('rop02_jm','rop02_fs','rop02_filosur','rop02_zorro') then
    raise exception 'Dataset ROP02 no permitido: %', p_dataset;
  end if;

  v_project := case p_dataset
    when 'rop02_jm' then 'JOSE MARIA'
    when 'rop02_fs' then 'FILO DEL SOL'
    when 'rop02_filosur' then 'FILO SUR'
    else 'EL ZORRO'
  end;

  v_url := 'https://script.google.com/macros/s/AKfycbxHyZPSNlYFI0LhMhdeByEfYygtMvA-sVEFpCaMAvCLpjLt8VnhWNB2t0cz7mmUomH9/exec?action='
    || p_dataset || '&limit=' || greatest(1,least(p_limit,1000))
    || '&offset=' || greatest(p_offset,0) || '&compact=0';

  select content::jsonb into v_json from extensions.http_get(v_url);
  if coalesce((v_json->>'ok')::boolean,false) is not true then
    raise exception 'Apps Script devolvió error para % offset %: %',
      p_dataset, p_offset, coalesce(v_json->'error','{}'::jsonb);
  end if;

  v_last_row := coalesce((v_json->'meta'->>'lastRow')::integer,0);

  insert into private.rop02_sync_stage(
    source_dataset,source_row,fecha,interno,equipo,operador,supervisor_delta,supervisor_vial_cliente,
    turno_trabajo,numero_parte,proyecto,horometro_inicial,horometro_final,cantidad_horas,combustible,aceite,
    descripcion_trabajos,informacion_desgaste,observaciones,source_key
  )
  select
    p_dataset,
    v_header_row + greatest(p_offset,0) + e.ord::integer,
    nullif(e.row->>'Fecha','')::date,
    btrim(coalesce(e.row->>'Interno','')),
    btrim(coalesce(e.row->>'Equipo','')),
    btrim(coalesce(e.row->>'Operador','')),
    btrim(coalesce(e.row->>'Supervisor Delta','')),
    btrim(coalesce(e.row->>'Supervisor Vial Cliente','')),
    btrim(coalesce(e.row->>'Turno de trabajo','')),
    btrim(coalesce(e.row->>'N° Parte','')),
    v_project,
    private.rop02_try_numeric(e.row->>'Horómetro inicial'),
    private.rop02_try_numeric(e.row->>'Horómetro final'),
    private.rop02_try_numeric(e.row->>'Cant. Hs.'),
    private.rop02_try_numeric(e.row->>'Combustible'),
    private.rop02_try_numeric(e.row->>'Aceite'),
    btrim(coalesce(e.row->>'Descripción de los trabajos realizados','')),
    btrim(coalesce(e.row->>'Información sobre Desgaste','')),
    btrim(coalesce(e.row->>'Observaciones','')),
    'SRC|' || upper(p_dataset) || '|' || (v_header_row + greatest(p_offset,0) + e.ord::integer)::text
  from jsonb_array_elements(coalesce(v_json->'data','[]'::jsonb)) with ordinality as e(row,ord)
  where nullif(e.row->>'Fecha','') is not null
    and btrim(coalesce(e.row->>'Interno','')) <> ''
  on conflict(source_dataset,source_row) do update set
    fecha=excluded.fecha,interno=excluded.interno,equipo=excluded.equipo,operador=excluded.operador,
    supervisor_delta=excluded.supervisor_delta,supervisor_vial_cliente=excluded.supervisor_vial_cliente,
    turno_trabajo=excluded.turno_trabajo,numero_parte=excluded.numero_parte,proyecto=excluded.proyecto,
    horometro_inicial=excluded.horometro_inicial,horometro_final=excluded.horometro_final,
    cantidad_horas=excluded.cantidad_horas,combustible=excluded.combustible,aceite=excluded.aceite,
    descripcion_trabajos=excluded.descripcion_trabajos,informacion_desgaste=excluded.informacion_desgaste,
    observaciones=excluded.observaciones,source_key=excluded.source_key;
  get diagnostics v_rows = row_count;

  insert into private.rop02_hash_stage(source_dataset,source_row,row_hash)
  select source_dataset,source_row,
    md5(concat_ws(E'\x1f',
      coalesce(fecha::text,'∅'),coalesce(interno,'∅'),coalesce(equipo,'∅'),coalesce(operador,'∅'),
      coalesce(supervisor_delta,'∅'),coalesce(supervisor_vial_cliente,'∅'),coalesce(turno_trabajo,'∅'),
      coalesce(numero_parte,'∅'),coalesce(proyecto,'∅'),coalesce(horometro_inicial::text,'∅'),
      coalesce(horometro_final::text,'∅'),coalesce(cantidad_horas::text,'∅'),coalesce(combustible::text,'∅'),
      coalesce(aceite::text,'∅'),coalesce(descripcion_trabajos,'∅'),coalesce(informacion_desgaste,'∅'),
      coalesce(observaciones,'∅')))
  from private.rop02_sync_stage
  where source_dataset=p_dataset
    and source_row between v_header_row+greatest(p_offset,0)+1
                       and v_header_row+greatest(p_offset,0)+greatest(1,least(p_limit,1000))
  on conflict(source_dataset,source_row) do update set row_hash=excluded.row_hash;

  return jsonb_build_object(
    'ok',true,'dataset',p_dataset,'offset',p_offset,'returned',v_rows,
    'lastRow',v_last_row,'nextOffset',v_json->'meta'->'nextOffset'
  );
end
$$;

create or replace function private.finalize_rop02_drive_reconciliation()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_upserted integer := 0;
  v_deleted integer := 0;
begin
  insert into public.rop02(
    source_dataset,source_row,fecha,interno,equipo,operador,supervisor_delta,supervisor_vial_cliente,
    turno_trabajo,numero_parte,proyecto,horometro_inicial,horometro_final,cantidad_horas,combustible,aceite,
    descripcion_trabajos,informacion_desgaste,observaciones,source_key,synced_at,updated_at
  )
  select
    source_dataset,source_row,fecha,interno,equipo,operador,supervisor_delta,supervisor_vial_cliente,
    turno_trabajo,numero_parte,proyecto,horometro_inicial,horometro_final,cantidad_horas,combustible,aceite,
    descripcion_trabajos,informacion_desgaste,observaciones,source_key,now(),now()
  from private.rop02_sync_stage
  on conflict(source_dataset,source_row) do update set
    fecha=excluded.fecha,interno=excluded.interno,equipo=excluded.equipo,operador=excluded.operador,
    supervisor_delta=excluded.supervisor_delta,supervisor_vial_cliente=excluded.supervisor_vial_cliente,
    turno_trabajo=excluded.turno_trabajo,numero_parte=excluded.numero_parte,proyecto=excluded.proyecto,
    horometro_inicial=excluded.horometro_inicial,horometro_final=excluded.horometro_final,
    cantidad_horas=excluded.cantidad_horas,combustible=excluded.combustible,aceite=excluded.aceite,
    descripcion_trabajos=excluded.descripcion_trabajos,informacion_desgaste=excluded.informacion_desgaste,
    observaciones=excluded.observaciones,source_key=excluded.source_key,synced_at=now(),updated_at=now();
  get diagnostics v_upserted = row_count;

  delete from public.rop02 r
  where r.source_dataset in ('rop02_jm','rop02_fs','rop02_filosur','rop02_zorro')
    and not exists (
      select 1 from private.rop02_hash_stage h
      where h.source_dataset=r.source_dataset and h.source_row=r.source_row
    );
  get diagnostics v_deleted = row_count;

  return jsonb_build_object(
    'ok',true,'upserted',v_upserted,'deleted',v_deleted,
    'sync_stage_rows',(select count(*) from private.rop02_sync_stage),
    'hash_stage_rows',(select count(*) from private.rop02_hash_stage)
  );
end
$$;

revoke all on function private.rop02_try_numeric(text) from public, anon, authenticated;
revoke all on function private.stage_rop02_page(text,integer,integer) from public, anon, authenticated;
revoke all on function private.finalize_rop02_drive_reconciliation() from public, anon, authenticated;
grant execute on function private.rop02_try_numeric(text) to postgres, service_role;
grant execute on function private.stage_rop02_page(text,integer,integer) to postgres, service_role;
grant execute on function private.finalize_rop02_drive_reconciliation() to postgres, service_role;

-- Public operational data is read-only for frontend roles.
revoke insert, update, delete, truncate, references, trigger on public.rop02_operational_frontend from anon, authenticated;
revoke truncate, references, trigger on public.rma15_insumos from anon, authenticated;
revoke truncate, references, trigger on public.delta_dataset_rows from anon, authenticated;
revoke truncate, references, trigger on public.delta_special_cache from anon, authenticated;
grant select on public.rop02_operational_frontend, public.rma15_insumos, public.delta_dataset_rows, public.delta_special_cache to anon, authenticated;
