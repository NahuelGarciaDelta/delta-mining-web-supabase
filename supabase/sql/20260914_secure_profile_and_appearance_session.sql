-- Applied to project jwfocqaxlckuxoklwyxs on 2026-09-14.
create or replace function public.app_update_user_profile_v2(p_current_password text, p_new_password text, p_nombre text, p_area text, p_auth_token text)
returns jsonb language plpgsql security definer set search_path='' as $$ declare u public.app_user_credentials%rowtype; begin u:=public.app_require_session_(p_auth_token); return public.app_update_user_profile(u.email,p_current_password,p_new_password,p_nombre,p_area); end $$;
create or replace function public.app_get_user_appearance_v2(p_auth_token text)
returns jsonb language plpgsql security definer set search_path='' as $$ declare u public.app_user_credentials%rowtype; begin u:=public.app_require_session_(p_auth_token); return public.app_get_user_appearance(u.email); end $$;
create or replace function public.app_save_user_appearance_v2(p_appearance jsonb, p_auth_token text)
returns jsonb language plpgsql security definer set search_path='' as $$ declare u public.app_user_credentials%rowtype; begin u:=public.app_require_session_(p_auth_token); return public.app_save_user_appearance(u.email,coalesce(p_appearance,'{}'::jsonb)); end $$;
create or replace function public.app_upload_user_background_v2(p_name text, p_data_url text, p_auth_token text)
returns jsonb language plpgsql security definer set search_path='' as $$ declare u public.app_user_credentials%rowtype; begin u:=public.app_require_session_(p_auth_token); return public.app_upload_user_background(u.email,p_name,p_data_url); end $$;
revoke all on function public.app_update_user_profile(text,text,text,text,text) from anon,authenticated;
revoke all on function public.app_get_user_appearance(text) from anon,authenticated;
revoke all on function public.app_save_user_appearance(text,jsonb) from anon,authenticated;
revoke all on function public.app_upload_user_background(text,text,text) from anon,authenticated;
grant execute on function public.app_update_user_profile_v2(text,text,text,text,text) to anon,authenticated;
grant execute on function public.app_get_user_appearance_v2(text) to anon,authenticated;
grant execute on function public.app_save_user_appearance_v2(jsonb,text) to anon,authenticated;
grant execute on function public.app_upload_user_background_v2(text,text,text) to anon,authenticated;
