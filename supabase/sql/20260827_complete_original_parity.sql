-- Delta Mining Ops — paridad app original -> Supabase
-- La migración equivalente ya fue aplicada al proyecto Supabase el 2026-08-27.
-- Fuente funcional: delta-mining-ops main + hojas Drive verificadas.
-- Este archivo documenta el esquema agregado para funciones recientes.

create table if not exists public.app_wear_articles (
  codigo text primary key,
  descripcion text not null default '',
  descripcion_adicional text not null default '',
  clasificacion text not null default '',
  orden integer,
  updated_at timestamptz not null default now(),
  updated_by text
);
create index if not exists app_wear_articles_clasificacion_idx on public.app_wear_articles(clasificacion);
create index if not exists app_wear_articles_orden_idx on public.app_wear_articles(orden);
alter table public.app_wear_articles enable row level security;

drop policy if exists "app_wear_articles_read" on public.app_wear_articles;
create policy "app_wear_articles_read" on public.app_wear_articles for select to anon, authenticated using (true);
revoke insert,update,delete on public.app_wear_articles from anon,authenticated;
grant select on public.app_wear_articles to anon,authenticated;

create table if not exists public.app_user_preferences (
  email text primary key,
  appearance jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.app_user_preferences enable row level security;
revoke all on public.app_user_preferences from anon,authenticated;

create table if not exists public.app_user_backgrounds (
  email text not null,
  id text not null,
  label text not null default 'Mi fondo',
  image_data text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(email,id),
  constraint app_user_backgrounds_data_image_chk check(image_data like 'data:image/%'),
  constraint app_user_backgrounds_image_size_chk check(length(image_data)<=9000000)
);
alter table public.app_user_backgrounds enable row level security;
revoke all on public.app_user_backgrounds from anon,authenticated;

-- RPCs instaladas en producción por la migración complete_original_parity_20260827:
-- app_assert_user_email(text)
-- app_normalize_appearance(jsonb)
-- app_get_user_appearance(text)
-- app_save_user_appearance(text,jsonb)
-- app_upload_user_background(text,text,text)
-- app_replace_wear_articles(text,jsonb)
--
-- El seed inicial de app_wear_articles contiene los 165 artículos detectados en
-- Base de Datos Costos > Articulos de desgaste. No se versionan imágenes ni
-- credenciales privadas dentro de GitHub.
