create or replace function public.app_authenticate_user(p_email text,p_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  u public.app_user_credentials%rowtype;
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
    'authToken',encode(extensions.gen_random_bytes(18),'hex')
  );
end
$$;

revoke all on function public.app_authenticate_user(text,text) from public;
grant execute on function public.app_authenticate_user(text,text) to anon,authenticated;
