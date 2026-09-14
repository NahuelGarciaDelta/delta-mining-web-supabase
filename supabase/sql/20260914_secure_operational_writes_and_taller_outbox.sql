-- Applied to project jwfocqaxlckuxoklwyxs on 2026-09-14.
-- Session-protected wrappers keep the browser Supabase-first while deriving the actor server-side.

create or replace function public.app_equipment_movement_save_v2(p_movement jsonb, p_auth_token text)
returns jsonb language plpgsql security definer set search_path='' as $$ declare u public.app_user_credentials%rowtype; begin u:=public.app_require_session_(p_auth_token); return public.app_equipment_movement_save(coalesce(p_movement,'{}'::jsonb),u.email); end $$;
create or replace function public.app_equipment_movement_cancel_v2(p_id text, p_auth_token text)
returns jsonb language plpgsql security definer set search_path='' as $$ declare u public.app_user_credentials%rowtype; begin u:=public.app_require_session_(p_auth_token); return public.app_equipment_movement_cancel(p_id,u.email); end $$;
create or replace function public.app_taller_movement_save_v2(p_movement jsonb, p_auth_token text)
returns jsonb language plpgsql security definer set search_path='' as $$ declare u public.app_user_credentials%rowtype; begin u:=public.app_require_session_(p_auth_token); return public.app_taller_movement_save(coalesce(p_movement,'{}'::jsonb),u.email); end $$;
create or replace function public.app_taller_movement_delete_v2(p_id text, p_auth_token text)
returns jsonb language plpgsql security definer set search_path='' as $$ declare u public.app_user_credentials%rowtype; begin u:=public.app_require_session_(p_auth_token); return public.app_taller_movement_delete(p_id,u.email); end $$;
create or replace function public.app_licitacion_save_v2(p_licitacion jsonb, p_auth_token text)
returns jsonb language plpgsql security definer set search_path='' as $$ declare u public.app_user_credentials%rowtype; begin u:=public.app_require_session_(p_auth_token); return public.app_licitacion_save(coalesce(p_licitacion,'{}'::jsonb),u.email); end $$;
create or replace function public.app_licitacion_delete_v2(p_id text, p_auth_token text)
returns jsonb language plpgsql security definer set search_path='' as $$ declare u public.app_user_credentials%rowtype; begin u:=public.app_require_session_(p_auth_token); return public.app_licitacion_delete(p_id,u.email); end $$;
create or replace function public.app_pm_save_v2(p_action text, p_payload jsonb, p_auth_token text)
returns jsonb language plpgsql security definer set search_path='' as $$ declare u public.app_user_credentials%rowtype; begin u:=public.app_require_session_(p_auth_token); return public.app_pm_save(p_action,coalesce(p_payload,'{}'::jsonb),u.email); end $$;
create or replace function public.app_stock_replace_v2(p_meta jsonb, p_rows jsonb, p_auth_token text)
returns jsonb language plpgsql security definer set search_path='' as $$ declare u public.app_user_credentials%rowtype; begin u:=public.app_require_session_(p_auth_token); return public.app_stock_replace(coalesce(p_meta,'{}'::jsonb),coalesce(p_rows,'[]'::jsonb),u.email); end $$;
create or replace function public.app_stock_clear_v2(p_auth_token text)
returns jsonb language plpgsql security definer set search_path='' as $$ declare u public.app_user_credentials%rowtype; begin u:=public.app_require_session_(p_auth_token); return public.app_stock_clear(u.email); end $$;
create or replace function public.app_write_action_v2(p_action text, p_payload jsonb, p_auth_token text)
returns jsonb language plpgsql security definer set search_path='' as $$ declare u public.app_user_credentials%rowtype; begin u:=public.app_require_session_(p_auth_token); return public.app_write_action(p_action,coalesce(p_payload,'{}'::jsonb),u.email); end $$;

create or replace function public.app_taller_sheet_outbox_20260914()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_payload jsonb;
begin
  if coalesce(new.updated_by,'')='SHEETS_SYNC' then return new; end if;
  v_payload:=jsonb_build_object('id',new.id,'fechaHora',new.fecha_hora,'tipo',new.tipo,'equipo',new.equipo,'marca',new.marca,'modelo',new.modelo,'propiedad',new.propiedad,'interno',new.interno_origen,'internoOrigen',new.interno_origen,'horometro',new.horometro,'proyectoOrigen',new.proyecto_origen,'proyectoDestino',new.proyecto_destino,'internoDestino',new.interno_destino,'internoEntra',new.interno_entra,'equipoEntra',new.equipo_entra,'marcaEntra',new.marca_entra,'modeloEntra',new.modelo_entra,'propiedadEntra',new.propiedad_entra,'horometroEntra',new.horometro_entra,'motivo',new.motivo,'observacion',new.observacion,'usuario',new.usuario,'estado',new.estado);
  insert into public.app_sync_outbox(domain,record_key,operation,payload) values('movimientos_taller',new.id,case when not new.activo or upper(coalesce(new.estado,''))='ELIMINADO' then 'delete' else 'upsert' end,v_payload);
  return new;
end $$;
drop trigger if exists trg_app_taller_sheet_outbox_20260914 on public.app_taller_movements;
create trigger trg_app_taller_sheet_outbox_20260914 after insert or update on public.app_taller_movements for each row execute function public.app_taller_sheet_outbox_20260914();

revoke all on function public.app_equipment_movement_save(jsonb,text) from anon,authenticated;
revoke all on function public.app_equipment_movement_cancel(text,text) from anon,authenticated;
revoke all on function public.app_taller_movement_save(jsonb,text) from anon,authenticated;
revoke all on function public.app_taller_movement_delete(text,text) from anon,authenticated;
revoke all on function public.app_licitacion_save(jsonb,text) from anon,authenticated;
revoke all on function public.app_licitacion_delete(text,text) from anon,authenticated;
revoke all on function public.app_pm_save(text,jsonb,text) from anon,authenticated;
revoke all on function public.app_stock_replace(jsonb,jsonb,text) from anon,authenticated;
revoke all on function public.app_stock_clear(text) from anon,authenticated;
revoke all on function public.app_write_action(text,jsonb,text) from anon,authenticated;

grant execute on function public.app_equipment_movement_save_v2(jsonb,text) to anon,authenticated;
grant execute on function public.app_equipment_movement_cancel_v2(text,text) to anon,authenticated;
grant execute on function public.app_taller_movement_save_v2(jsonb,text) to anon,authenticated;
grant execute on function public.app_taller_movement_delete_v2(text,text) to anon,authenticated;
grant execute on function public.app_licitacion_save_v2(jsonb,text) to anon,authenticated;
grant execute on function public.app_licitacion_delete_v2(text,text) to anon,authenticated;
grant execute on function public.app_pm_save_v2(text,jsonb,text) to anon,authenticated;
grant execute on function public.app_stock_replace_v2(jsonb,jsonb,text) to anon,authenticated;
grant execute on function public.app_stock_clear_v2(text) to anon,authenticated;
grant execute on function public.app_write_action_v2(text,jsonb,text) to anon,authenticated;
