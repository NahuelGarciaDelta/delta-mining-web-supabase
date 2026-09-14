-- Session-backed authorization for app mutations without breaking the currently deployed client.
-- This migration is additive: legacy write RPC grants are intentionally left unchanged until frontend cutover.

create table if not exists public.app_user_sessions (
  token_hash text primary key,
  email text not null references public.app_user_credentials(email) on delete cascade,
  rol text,
  proyecto text,
  area text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '12 hours'),
  last_seen_at timestamptz not null default now()
);

create index if not exists app_user_sessions_email_idx on public.app_user_sessions(email);
create index if not exists app_user_sessions_expires_at_idx on public.app_user_sessions(expires_at);

alter table public.app_user_sessions enable row level security;
revoke all on table public.app_user_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.app_user_sessions to service_role;

create or replace function public.app_require_session_(p_auth_token text)
returns public.app_user_credentials
language plpgsql
security definer
set search_path=''
as $$
declare
  u public.app_user_credentials%rowtype;
  v_hash text;
begin
  if nullif(btrim(coalesce(p_auth_token,'')),'') is null then
    raise exception 'Sesión requerida.' using errcode='28000';
  end if;

  v_hash := encode(extensions.digest(p_auth_token,'sha256'),'hex');

  select c.* into u
  from public.app_user_sessions s
  join public.app_user_credentials c on c.email=s.email
  where s.token_hash=v_hash
    and s.expires_at>now()
    and c.activo=true
  limit 1;

  if not found then
    raise exception 'Sesión inválida o vencida.' using errcode='28000';
  end if;

  update public.app_user_sessions
  set last_seen_at=now()
  where token_hash=v_hash;

  return u;
end
$$;

revoke all on function public.app_require_session_(text) from public, anon, authenticated;
grant execute on function public.app_require_session_(text) to service_role;

create or replace function public.app_authenticate_user(p_email text, p_password text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  u public.app_user_credentials%rowtype;
  v_token text;
  v_hash text;
begin
  select * into u
  from public.app_user_credentials
  where email=lower(btrim(coalesce(p_email,'')));

  if not found then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','AUTH_INVALID','message','Usuario o contraseña incorrectos.'));
  end if;

  if not u.activo then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','AUTH_INACTIVE','message','El usuario no está habilitado.'));
  end if;

  if u.password_hash<>extensions.crypt(coalesce(p_password,''),u.password_hash) then
    return jsonb_build_object('ok',false,'error',jsonb_build_object('code','AUTH_INVALID','message','Usuario o contraseña incorrectos.'));
  end if;

  delete from public.app_user_sessions
  where email=u.email and expires_at<=now();

  v_token:=encode(extensions.gen_random_bytes(24),'hex');
  v_hash:=encode(extensions.digest(v_token,'sha256'),'hex');

  insert into public.app_user_sessions(token_hash,email,rol,proyecto,area,expires_at,last_seen_at)
  values(v_hash,u.email,u.rol,u.proyecto,u.area,now()+interval '12 hours',now());

  return jsonb_build_object(
    'ok',true,
    'user',jsonb_build_object(
      'email',u.email,
      'rol',u.rol,
      'proyecto',u.proyecto,
      'nombre',u.nombre,
      'area',u.area
    ),
    'mustChangePassword',u.must_change_password,
    'authToken',v_token
  );
end
$$;

revoke all on function public.app_authenticate_user(text,text) from public;
grant execute on function public.app_authenticate_user(text,text) to anon, authenticated, service_role;

create or replace function public.abastecimiento_append_raba03_v2(p_rows jsonb, p_auth_token text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  perform public.app_require_session_(p_auth_token);
  return public.abastecimiento_append_raba03(p_rows);
end
$$;

create or replace function public.abastecimiento_update_raba03_v2(p_action text, p_rows jsonb, p_auth_token text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  perform public.app_require_session_(p_auth_token);
  return public.abastecimiento_update_raba03(p_action,p_rows);
end
$$;

create or replace function public.abastecimiento_delete_raba03_solicitud_v2(p_numero_solicitud text, p_auth_token text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
begin
  perform public.app_require_session_(p_auth_token);
  return public.abastecimiento_delete_raba03_solicitud(p_numero_solicitud);
end
$$;

create or replace function public.abastecimiento_save_remito_v2(p_remito jsonb, p_auth_token text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  u public.app_user_credentials%rowtype;
  v_payload jsonb;
begin
  u:=public.app_require_session_(p_auth_token);
  v_payload:=coalesce(p_remito,'{}'::jsonb) || jsonb_build_object('usuarioCarga',u.email,'USUARIO_CARGA',u.email);
  return public.abastecimiento_save_remito(v_payload);
end
$$;

create or replace function public.abastecimiento_delete_remito_v2(p_id text, p_auth_token text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  u public.app_user_credentials%rowtype;
begin
  u:=public.app_require_session_(p_auth_token);
  return public.abastecimiento_delete_remito(p_id,u.email);
end
$$;

create or replace function public.abastecimiento_set_estado_v2(p_payload jsonb, p_auth_token text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  u public.app_user_credentials%rowtype;
  v_payload jsonb;
begin
  u:=public.app_require_session_(p_auth_token);
  v_payload:=coalesce(p_payload,'{}'::jsonb) || jsonb_build_object('usuario',u.email,'USUARIO',u.email);
  return public.abastecimiento_set_estado(v_payload);
end
$$;

revoke all on function public.abastecimiento_append_raba03_v2(jsonb,text) from public;
revoke all on function public.abastecimiento_update_raba03_v2(text,jsonb,text) from public;
revoke all on function public.abastecimiento_delete_raba03_solicitud_v2(text,text) from public;
revoke all on function public.abastecimiento_save_remito_v2(jsonb,text) from public;
revoke all on function public.abastecimiento_delete_remito_v2(text,text) from public;
revoke all on function public.abastecimiento_set_estado_v2(jsonb,text) from public;

grant execute on function public.abastecimiento_append_raba03_v2(jsonb,text) to anon, authenticated, service_role;
grant execute on function public.abastecimiento_update_raba03_v2(text,jsonb,text) to anon, authenticated, service_role;
grant execute on function public.abastecimiento_delete_raba03_solicitud_v2(text,text) to anon, authenticated, service_role;
grant execute on function public.abastecimiento_save_remito_v2(jsonb,text) to anon, authenticated, service_role;
grant execute on function public.abastecimiento_delete_remito_v2(text,text) to anon, authenticated, service_role;
grant execute on function public.abastecimiento_set_estado_v2(jsonb,text) to anon, authenticated, service_role;
