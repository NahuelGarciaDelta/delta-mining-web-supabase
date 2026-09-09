-- Canonical Sheets -> Supabase synchronization for the current DELTA backend.
-- Service-role only RPCs are called from Apps Script Script Properties, never the SPA.

alter table public.rop02 add column if not exists aceite_text text;
alter table private.rop02_sync_stage add column if not exists aceite_text text;
alter table private.rop02_manual_stage add column if not exists aceite_text text;

-- Mirrors src/shared/domain/index.jsx::toNumber.  In particular, "178a" is 178
-- and non-numeric labels such as "Sin carga" are 0, rather than NULL/invalid.
create or replace function private.rop02_try_numeric(p_value text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := btrim(coalesce(p_value,''));
  v_comma integer;
  v_dot integer;
  v_decimals integer;
begin
  if v='' then return 0; end if;
  v := regexp_replace(v, '[^0-9,.-]', '', 'g');
  if v='' then return 0; end if;
  v_comma := length(v) - length(replace(v, ',', ''));
  v_dot := length(v) - length(replace(v, '.', ''));
  if v_comma>0 and v_dot>0 then
    if strrpos(v, ',')>strrpos(v, '.') then
      v := replace(v, '.', '');
      v := regexp_replace(v, ',', '.', '');
    else
      v := replace(v, ',', '');
    end if;
  elsif v_comma>0 then
    v_decimals := length(v)-strrpos(v, ',');
    if v_decimals between 1 and 2 then
      v := replace(v, '.', '');
      v := regexp_replace(v, ',', '.', '');
    else
      v := replace(v, ',', '');
    end if;
  elsif v_dot>0 then
    v_decimals := length(v)-strrpos(v, '.');
    if v_decimals between 1 and 2 then
      v := replace(v, ',', '');
    else
      v := replace(v, '.', '');
    end if;
  end if;
  return coalesce(v::numeric,0);
exception when others then
  return 0;
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
  v_project := case p_dataset when 'rop02_jm' then 'JOSE MARIA' when 'rop02_fs' then 'FILO DEL SOL' when 'rop02_filosur' then 'FILO SUR' else 'EL ZORRO' end;
  v_url := 'https://script.google.com/macros/s/AKfycbxHyZPSNlYFI0LhMhdeByEfYygtMvA-sVEFpCaMAvCLpjLt8VnhWNB2t0cz7mmUomH9/exec?action='
    || p_dataset || '&limit=' || greatest(1,least(p_limit,1000)) || '&offset=' || greatest(p_offset,0) || '&compact=0';
  select content::jsonb into v_json from extensions.http_get(v_url);
  if coalesce((v_json->>'ok')::boolean,false) is not true then
    raise exception 'Apps Script devolvió error para % offset %: %', p_dataset, p_offset, coalesce(v_json->'error','{}'::jsonb);
  end if;
  v_last_row := coalesce((v_json->'meta'->>'lastRow')::integer,0);
  insert into private.rop02_sync_stage(
    source_dataset,source_row,fecha,interno,equipo,operador,supervisor_delta,supervisor_vial_cliente,
    turno_trabajo,numero_parte,proyecto,horometro_inicial,horometro_final,cantidad_horas,combustible,aceite,aceite_text,
    descripcion_trabajos,informacion_desgaste,observaciones,source_key
  )
  select p_dataset, v_header_row + greatest(p_offset,0) + e.ord::integer,
    nullif(e.row->>'Fecha','')::date, btrim(coalesce(e.row->>'Interno','')), btrim(coalesce(e.row->>'Equipo','')),
    btrim(coalesce(e.row->>'Operador','')), btrim(coalesce(e.row->>'Supervisor Delta','')),
    btrim(coalesce(e.row->>'Supervisor Vial Cliente','')), btrim(coalesce(e.row->>'Turno de trabajo','')),
    btrim(coalesce(e.row->>'N° Parte','')), v_project,
    private.rop02_try_numeric(e.row->>'Horómetro inicial'), private.rop02_try_numeric(e.row->>'Horómetro final'),
    private.rop02_try_numeric(e.row->>'Cant. Hs.'), private.rop02_try_numeric(e.row->>'Combustible'),
    private.rop02_try_numeric(e.row->>'Aceite'), btrim(coalesce(e.row->>'Aceite','')),
    btrim(coalesce(e.row->>'Descripción de los trabajos realizados','')),
    btrim(coalesce(e.row->>'Información sobre Desgaste','')), btrim(coalesce(e.row->>'Observaciones','')),
    'SRC|' || upper(p_dataset) || '|' || (v_header_row + greatest(p_offset,0) + e.ord::integer)::text
  from jsonb_array_elements(coalesce(v_json->'data','[]'::jsonb)) with ordinality as e(row,ord)
  where nullif(e.row->>'Fecha','') is not null and btrim(coalesce(e.row->>'Interno','')) <> ''
  on conflict(source_dataset,source_row) do update set
    fecha=excluded.fecha,interno=excluded.interno,equipo=excluded.equipo,operador=excluded.operador,
    supervisor_delta=excluded.supervisor_delta,supervisor_vial_cliente=excluded.supervisor_vial_cliente,
    turno_trabajo=excluded.turno_trabajo,numero_parte=excluded.numero_parte,proyecto=excluded.proyecto,
    horometro_inicial=excluded.horometro_inicial,horometro_final=excluded.horometro_final,
    cantidad_horas=excluded.cantidad_horas,combustible=excluded.combustible,aceite=excluded.aceite,aceite_text=excluded.aceite_text,
    descripcion_trabajos=excluded.descripcion_trabajos,informacion_desgaste=excluded.informacion_desgaste,
    observaciones=excluded.observaciones,source_key=excluded.source_key;
  get diagnostics v_rows = row_count;
  insert into private.rop02_hash_stage(source_dataset,source_row,row_hash)
  select source_dataset,source_row,md5(concat_ws(E'\x1f',coalesce(fecha::text,'∅'),coalesce(interno,'∅'),coalesce(equipo,'∅'),
    coalesce(operador,'∅'),coalesce(supervisor_delta,'∅'),coalesce(supervisor_vial_cliente,'∅'),coalesce(turno_trabajo,'∅'),
    coalesce(numero_parte,'∅'),coalesce(proyecto,'∅'),coalesce(horometro_inicial::text,'∅'),coalesce(horometro_final::text,'∅'),
    coalesce(cantidad_horas::text,'∅'),coalesce(combustible::text,'∅'),coalesce(aceite_text,'∅'),coalesce(descripcion_trabajos,'∅'),
    coalesce(informacion_desgaste,'∅'),coalesce(observaciones,'∅')))
  from private.rop02_sync_stage
  where source_dataset=p_dataset and source_row between v_header_row+greatest(p_offset,0)+1 and v_header_row+greatest(p_offset,0)+greatest(1,least(p_limit,1000))
  on conflict(source_dataset,source_row) do update set row_hash=excluded.row_hash;
  return jsonb_build_object('ok',true,'dataset',p_dataset,'offset',p_offset,'returned',v_rows,'lastRow',v_last_row,'nextOffset',v_json->'meta'->'nextOffset');
end
$$;

create or replace function private.finalize_rop02_drive_reconciliation()
returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare v_upserted integer := 0; v_deleted integer := 0;
begin
  insert into public.rop02(source_dataset,source_row,fecha,interno,equipo,operador,supervisor_delta,supervisor_vial_cliente,
    turno_trabajo,numero_parte,proyecto,horometro_inicial,horometro_final,cantidad_horas,combustible,aceite,aceite_text,
    descripcion_trabajos,informacion_desgaste,observaciones,source_key,synced_at,updated_at)
  select source_dataset,source_row,fecha,interno,equipo,operador,supervisor_delta,supervisor_vial_cliente,
    turno_trabajo,numero_parte,proyecto,horometro_inicial,horometro_final,cantidad_horas,combustible,aceite,aceite_text,
    descripcion_trabajos,informacion_desgaste,observaciones,source_key,now(),now()
  from private.rop02_sync_stage
  on conflict(source_dataset,source_row) do update set
    fecha=excluded.fecha,interno=excluded.interno,equipo=excluded.equipo,operador=excluded.operador,
    supervisor_delta=excluded.supervisor_delta,supervisor_vial_cliente=excluded.supervisor_vial_cliente,
    turno_trabajo=excluded.turno_trabajo,numero_parte=excluded.numero_parte,proyecto=excluded.proyecto,
    horometro_inicial=excluded.horometro_inicial,horometro_final=excluded.horometro_final,cantidad_horas=excluded.cantidad_horas,
    combustible=excluded.combustible,aceite=excluded.aceite,aceite_text=excluded.aceite_text,
    descripcion_trabajos=excluded.descripcion_trabajos,informacion_desgaste=excluded.informacion_desgaste,
    observaciones=excluded.observaciones,source_key=excluded.source_key,synced_at=now(),updated_at=now();
  get diagnostics v_upserted = row_count;
  delete from public.rop02 r where r.source_dataset in ('rop02_jm','rop02_fs','rop02_filosur','rop02_zorro')
    and not exists(select 1 from private.rop02_hash_stage h where h.source_dataset=r.source_dataset and h.source_row=r.source_row);
  get diagnostics v_deleted = row_count;
  return jsonb_build_object('ok',true,'upserted',v_upserted,'deleted',v_deleted,'sync_stage_rows',(select count(*) from private.rop02_sync_stage));
end
$$;

create or replace function private.stage_rop02_manual_rows(p_dataset text, p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_rows integer:=0;
begin
  if p_dataset not in ('rop02_jm','rop02_fs','rop02_filosur','rop02_zorro') then raise exception 'Dataset ROP02 no permitido: %',p_dataset; end if;
  if jsonb_typeof(p_rows)<>'array' then raise exception 'p_rows debe ser array'; end if;
  insert into private.rop02_manual_stage(source_dataset,source_row,fecha,interno,equipo,operador,supervisor_delta,supervisor_vial_cliente,
    turno_trabajo,numero_parte,proyecto,horometro_inicial,horometro_final,cantidad_horas,combustible,aceite,aceite_text,
    descripcion_trabajos,informacion_desgaste,observaciones)
  select p_dataset,(x->>'source_row')::integer,nullif(x->>'fecha','')::date,btrim(coalesce(x->>'interno','')),
    btrim(coalesce(x->>'equipo','')),btrim(coalesce(x->>'operador','')),btrim(coalesce(x->>'supervisor_delta','')),
    btrim(coalesce(x->>'supervisor_vial_cliente','')),btrim(coalesce(x->>'turno_trabajo','')),btrim(coalesce(x->>'numero_parte','')),
    btrim(coalesce(x->>'proyecto','')),nullif(x->>'horometro_inicial','')::numeric,nullif(x->>'horometro_final','')::numeric,
    nullif(x->>'cantidad_horas','')::numeric,nullif(x->>'combustible','')::numeric,nullif(x->>'aceite_num','')::numeric,
    btrim(coalesce(x->>'aceite','')),btrim(coalesce(x->>'descripcion_trabajos','')),
    btrim(coalesce(x->>'informacion_desgaste','')),btrim(coalesce(x->>'observaciones',''))
  from jsonb_array_elements(p_rows) x
  where coalesce(x->>'source_row','')~'^[0-9]+$' and nullif(x->>'fecha','') is not null and btrim(coalesce(x->>'interno',''))<>''
  on conflict(source_dataset,source_row) do update set fecha=excluded.fecha,interno=excluded.interno,equipo=excluded.equipo,operador=excluded.operador,
    supervisor_delta=excluded.supervisor_delta,supervisor_vial_cliente=excluded.supervisor_vial_cliente,turno_trabajo=excluded.turno_trabajo,
    numero_parte=excluded.numero_parte,proyecto=excluded.proyecto,horometro_inicial=excluded.horometro_inicial,horometro_final=excluded.horometro_final,
    cantidad_horas=excluded.cantidad_horas,combustible=excluded.combustible,aceite=excluded.aceite,aceite_text=excluded.aceite_text,
    descripcion_trabajos=excluded.descripcion_trabajos,informacion_desgaste=excluded.informacion_desgaste,observaciones=excluded.observaciones;
  get diagnostics v_rows=row_count;
  return jsonb_build_object('ok',true,'dataset',p_dataset,'staged',v_rows);
end
$$;

create or replace function private.finalize_rop02_manual_sync(p_dataset text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_upserted integer:=0; v_deleted integer:=0;
begin
  if p_dataset not in ('rop02_jm','rop02_fs','rop02_filosur','rop02_zorro') then raise exception 'Dataset ROP02 no permitido: %',p_dataset; end if;
  if not exists(select 1 from private.rop02_manual_stage where source_dataset=p_dataset) then raise exception 'No hay filas staged para %',p_dataset; end if;
  insert into public.rop02(source_dataset,source_row,fecha,interno,equipo,operador,supervisor_delta,supervisor_vial_cliente,
    turno_trabajo,numero_parte,proyecto,horometro_inicial,horometro_final,cantidad_horas,combustible,aceite,aceite_text,
    descripcion_trabajos,informacion_desgaste,observaciones,source_key,synced_at,updated_at)
  select source_dataset,source_row,fecha,interno,equipo,operador,supervisor_delta,supervisor_vial_cliente,
    turno_trabajo,numero_parte,proyecto,horometro_inicial,horometro_final,cantidad_horas,combustible,aceite,aceite_text,
    descripcion_trabajos,informacion_desgaste,observaciones,'SRC|'||upper(source_dataset)||'|'||source_row::text,now(),now()
  from private.rop02_manual_stage where source_dataset=p_dataset
  on conflict(source_dataset,source_row) do update set fecha=excluded.fecha,interno=excluded.interno,equipo=excluded.equipo,operador=excluded.operador,
    supervisor_delta=excluded.supervisor_delta,supervisor_vial_cliente=excluded.supervisor_vial_cliente,turno_trabajo=excluded.turno_trabajo,
    numero_parte=excluded.numero_parte,proyecto=excluded.proyecto,horometro_inicial=excluded.horometro_inicial,horometro_final=excluded.horometro_final,
    cantidad_horas=excluded.cantidad_horas,combustible=excluded.combustible,aceite=excluded.aceite,aceite_text=excluded.aceite_text,
    descripcion_trabajos=excluded.descripcion_trabajos,informacion_desgaste=excluded.informacion_desgaste,observaciones=excluded.observaciones,
    source_key=excluded.source_key,synced_at=now(),updated_at=now();
  get diagnostics v_upserted=row_count;
  delete from public.rop02 r where r.source_dataset=p_dataset and r.source_row is not null
    and not exists(select 1 from private.rop02_manual_stage s where s.source_dataset=p_dataset and s.source_row=r.source_row);
  get diagnostics v_deleted=row_count;
  return jsonb_build_object('ok',true,'dataset',p_dataset,'upserted',v_upserted,'deleted',v_deleted,'total',(select count(*) from public.rop02 where source_dataset=p_dataset and source_row is not null));
end
$$;

create or replace function public.begin_rop02_sheet_sync(p_dataset text) returns jsonb language sql security definer set search_path='' as $$ select private.begin_rop02_manual_sync(p_dataset) $$;
create or replace function public.stage_rop02_sheet_rows(p_dataset text,p_rows jsonb) returns jsonb language sql security definer set search_path='' as $$ select private.stage_rop02_manual_rows(p_dataset,p_rows) $$;
create or replace function public.finalize_rop02_sheet_sync(p_dataset text) returns jsonb language sql security definer set search_path='' as $$ select private.finalize_rop02_manual_sync(p_dataset) $$;

revoke all on function public.begin_rop02_sheet_sync(text) from public,anon,authenticated;
revoke all on function public.stage_rop02_sheet_rows(text,jsonb) from public,anon,authenticated;
revoke all on function public.finalize_rop02_sheet_sync(text) from public,anon,authenticated;
grant execute on function public.begin_rop02_sheet_sync(text),public.stage_rop02_sheet_rows(text,jsonb),public.finalize_rop02_sheet_sync(text) to service_role;

create or replace view public.rop02_frontend with (security_invoker=true) as
select r.id,r.fecha,r.interno,r.equipo,r.operador,r.supervisor_delta,r.supervisor_vial_cliente,r.turno_trabajo,r.numero_parte,
  r.proyecto,r.horometro_inicial,r.horometro_final,r.cantidad_horas,r.combustible,r.aceite,
  r.descripcion_trabajos,r.informacion_desgaste,r.observaciones,r.source_key,r.created_at,r.updated_at,r.synced_at,
  public.rop02_classify_state(r.cantidad_horas,r.descripcion_trabajos,r.observaciones) as estado,r.aceite_text
from public.rop02 r where r.source_dataset in ('rop02_fs','rop02_jm','rop02_filosur','rop02_zorro') and r.source_row is not null;

create or replace view public.rop02_operational_frontend with (security_invoker=true) as
select r.id,r.fecha,r.interno,r.equipo,r.operador,r.supervisor_delta,r.supervisor_vial_cliente,r.turno_trabajo,r.numero_parte,
  r.proyecto,r.horometro_inicial,r.horometro_final,r.cantidad_horas,r.combustible,r.aceite,
  r.descripcion_trabajos,r.informacion_desgaste,r.observaciones,r.source_key,r.created_at,r.updated_at,r.synced_at,r.estado,r.aceite_text
from public.rop02_frontend r join public.rop02 source on source.id=r.id
where source.source_dataset in ('rop02_fs','rop02_jm','rop02_filosur','rop02_zorro') and source.source_row is not null
  and not public.rop02_is_excluded_equipment(r.interno);

grant select on public.rop02_frontend,public.rop02_operational_frontend to anon,authenticated;

-- Credentials are deliberately separated from the public user directory.  The
-- Apps Script receives the source password from Sheets and sends it only with
-- the service-role key; the database stores a bcrypt hash.
create table if not exists public.app_user_credentials (
  email text primary key,
  password_hash text not null,
  rol text not null default 'USUARIO',
  proyecto text not null default 'TODOS',
  nombre text not null default '',
  area text not null default '',
  activo boolean not null default true,
  must_change_password boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.app_user_credentials enable row level security;
revoke all on public.app_user_credentials from anon,authenticated;

create or replace function public.sync_app_users_from_sheet(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_rows integer:=0; v_deleted integer:=0;
begin
  if jsonb_typeof(coalesce(p_rows,'[]'::jsonb))<>'array' then raise exception 'p_rows debe ser array'; end if;
  insert into public.app_user_credentials(email,password_hash,rol,proyecto,nombre,area,activo,must_change_password,updated_at)
  select lower(btrim(coalesce(x->>'email',''))),
    extensions.crypt(coalesce(nullif(x->>'password',''),'DELTA.MINING.APP'),extensions.gen_salt('bf',10)),
    upper(btrim(coalesce(x->>'rol','USUARIO'))),upper(btrim(coalesce(x->>'proyecto','TODOS'))),
    btrim(coalesce(x->>'nombre','')),btrim(coalesce(x->>'area','')),
    coalesce((x->>'activo')::boolean,true),coalesce(nullif(x->>'password',''),'')='',now()
  from jsonb_array_elements(p_rows) x
  where lower(btrim(coalesce(x->>'email','')))<>''
  on conflict(email) do update set password_hash=excluded.password_hash,rol=excluded.rol,proyecto=excluded.proyecto,
    nombre=excluded.nombre,area=excluded.area,activo=excluded.activo,must_change_password=excluded.must_change_password,updated_at=now();
  get diagnostics v_rows=row_count;
  delete from public.app_user_credentials c where not exists(
    select 1 from jsonb_array_elements(p_rows) x where lower(btrim(coalesce(x->>'email','')))=c.email
  );
  get diagnostics v_deleted=row_count;
  return jsonb_build_object('ok',true,'rows',v_rows,'deleted',v_deleted);
end
$$;

create or replace function public.app_authenticate_user(p_email text,p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare u public.app_user_credentials%rowtype;
begin
  select * into u from public.app_user_credentials where email=lower(btrim(coalesce(p_email,'')));
  if not found or not u.activo or u.password_hash<>extensions.crypt(coalesce(p_password,''),u.password_hash) then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','AUTH_INVALID','message','Usuario o contraseña incorrectos.'));
  end if;
  return jsonb_build_object('ok',true,'user',jsonb_build_object('email',u.email,'rol',u.rol,'proyecto',u.proyecto,'nombre',u.nombre,'area',u.area),
    'mustChangePassword',u.must_change_password,'authToken',encode(extensions.gen_random_bytes(18),'hex'));
end
$$;

create or replace function public.app_update_user_profile(
  p_email text,p_current_password text,p_new_password text,p_nombre text,p_area text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare u public.app_user_credentials%rowtype; v_email text:=lower(btrim(coalesce(p_email,''))); v_new text:=coalesce(p_new_password,'');
begin
  select * into u from public.app_user_credentials where email=v_email for update;
  if not found then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','USER_NOT_FOUND','message','No se encontró el usuario.')); end if;
  if not u.activo then return jsonb_build_object('ok',false,'error',jsonb_build_object('code','USER_INACTIVE','message','El usuario no está habilitado.')); end if;
  if v_new<>'' and u.password_hash<>extensions.crypt(coalesce(p_current_password,''),u.password_hash) then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','CURRENT_PASSWORD_INVALID','message','La contraseña actual es incorrecta.'));
  end if;
  if v_new='' and u.must_change_password then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','PASSWORD_REQUIRED','message','Debe crear una contraseña personal para continuar.'));
  end if;
  update public.app_user_credentials set
    password_hash=case when v_new<>'' then extensions.crypt(v_new,extensions.gen_salt('bf',10)) else password_hash end,
    nombre=coalesce(nullif(btrim(p_nombre),''),nombre),
    area=case when u.rol in ('ADMIN','ADMINISTRADOR') then btrim(coalesce(p_area,area)) else area end,
    must_change_password=case when v_new<>'' then false else must_change_password end,updated_at=now()
  where email=v_email returning * into u;
  insert into public.app_sync_outbox(domain,record_key,operation,payload)
  values('usuarios',u.email,'upsert',jsonb_strip_nulls(jsonb_build_object('email',u.email,'password',nullif(v_new,''),'nombre',u.nombre,'area',u.area)));
  return jsonb_build_object('ok',true,'user',jsonb_build_object('email',u.email,'rol',u.rol,'proyecto',u.proyecto,'nombre',u.nombre,'area',u.area));
end
$$;

revoke all on function public.sync_app_users_from_sheet(jsonb) from public,anon,authenticated;
grant execute on function public.sync_app_users_from_sheet(jsonb) to service_role;
revoke all on function public.app_authenticate_user(text,text),public.app_update_user_profile(text,text,text,text,text) from public;
grant execute on function public.app_authenticate_user(text,text),public.app_update_user_profile(text,text,text,text,text) to anon,authenticated;
