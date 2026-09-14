-- Applied to project jwfocqaxlckuxoklwyxs on 2026-09-14.
create or replace function public.app_replace_wear_articles_v2(p_rows jsonb, p_auth_token text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare u public.app_user_credentials%rowtype; v_result jsonb;
begin
  u:=public.app_require_session_(p_auth_token);
  v_result:=public.app_replace_wear_articles(u.email,coalesce(p_rows,'[]'::jsonb));
  insert into public.app_sync_outbox(domain,record_key,operation,payload)
  values('articulos_desgaste','catalogo','replace',jsonb_build_object('rows',coalesce(p_rows,'[]'::jsonb),'usuario',u.email));
  return v_result;
end$$;
revoke all on function public.app_replace_wear_articles(text,jsonb) from anon,authenticated;
grant execute on function public.app_replace_wear_articles_v2(jsonb,text) to anon,authenticated;
