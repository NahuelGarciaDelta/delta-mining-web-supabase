create table if not exists public.abastecimiento_raba03_delete_tombstones(
  numero_solicitud text primary key,
  actor text not null default 'APP',
  requested_at timestamptz not null default now()
);

alter table public.abastecimiento_raba03_delete_tombstones enable row level security;

create or replace function public.abastecimiento_raba03_is_tombstoned(p_row jsonb)
returns boolean
language sql
stable
security definer
set search_path=''
as $function$
  select exists(
    select 1
    from public.abastecimiento_raba03_delete_tombstones t
    where t.numero_solicitud=trim(coalesce(
      p_row->>'N° de solicitud',p_row->>'Nº de solicitud',p_row->>'Numero de solicitud',p_row->>'Número de solicitud',''
    ))
  );
$function$;

create or replace function public.abastecimiento_raba03_block_tombstone()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if public.abastecimiento_raba03_is_tombstoned(new.row_data) then
    return null;
  end if;
  return new;
end
$function$;

drop trigger if exists abastecimiento_raba03_block_tombstone_trg on public.abastecimiento_raba03;
create trigger abastecimiento_raba03_block_tombstone_trg
before insert or update on public.abastecimiento_raba03
for each row execute function public.abastecimiento_raba03_block_tombstone();

create or replace function public.delta_raba03_block_tombstone()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  if new.dataset='raba03' and public.abastecimiento_raba03_is_tombstoned(new.row_data) then
    return null;
  end if;
  return new;
end
$function$;

drop trigger if exists delta_raba03_block_tombstone_trg on public.delta_dataset_rows;
create trigger delta_raba03_block_tombstone_trg
before insert or update on public.delta_dataset_rows
for each row execute function public.delta_raba03_block_tombstone();

create or replace function public.abastecimiento_delete_raba03_solicitud(p_numero_solicitud text,p_actor text default 'APP')
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_numero text:=trim(coalesce(p_numero_solicitud,''));
  v_deleted integer:=0;
  v_deleted_generic integer:=0;
begin
  if v_numero='' then raise exception 'N° de solicitud requerido'; end if;

  insert into public.abastecimiento_raba03_delete_tombstones(numero_solicitud,actor,requested_at)
  values(v_numero,coalesce(nullif(trim(p_actor),''),'APP'),now())
  on conflict(numero_solicitud) do update set actor=excluded.actor,requested_at=now();

  delete from public.abastecimiento_raba03 r
  where trim(coalesce(r.row_data->>'N° de solicitud',r.row_data->>'Nº de solicitud',r.row_data->>'Numero de solicitud',r.row_data->>'Número de solicitud',''))=v_numero;
  get diagnostics v_deleted=row_count;

  delete from public.delta_dataset_rows d
  where d.dataset='raba03'
    and trim(coalesce(d.row_data->>'N° de solicitud',d.row_data->>'Nº de solicitud',d.row_data->>'Numero de solicitud',d.row_data->>'Número de solicitud',''))=v_numero;
  get diagnostics v_deleted_generic=row_count;

  insert into public.app_sync_outbox(domain,record_key,operation,payload)
  values('raba03',v_numero,'delete_solicitud',jsonb_build_object('numeroSolicitud',v_numero,'actor',coalesce(nullif(trim(p_actor),''),'APP')));

  return jsonb_build_object('ok',true,'numeroSolicitud',v_numero,'deletedRows',v_deleted,'deletedGenericRows',v_deleted_generic,'tombstoned',true);
end
$function$;

create or replace function public.abastecimiento_raba03_active_tombstones()
returns jsonb
language sql
stable
security definer
set search_path=''
as $function$
  select coalesce(jsonb_agg(numero_solicitud order by requested_at),'[]'::jsonb)
  from public.abastecimiento_raba03_delete_tombstones;
$function$;

create or replace function public.abastecimiento_raba03_confirm_sheet_delete(p_numero_solicitud text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_numero text:=trim(coalesce(p_numero_solicitud,''));
  v_deleted integer:=0;
begin
  if v_numero='' then raise exception 'N° de solicitud requerido'; end if;
  delete from public.abastecimiento_raba03_delete_tombstones where numero_solicitud=v_numero;
  get diagnostics v_deleted=row_count;
  return jsonb_build_object('ok',true,'numeroSolicitud',v_numero,'releasedTombstone',v_deleted>0);
end
$function$;

grant execute on function public.abastecimiento_delete_raba03_solicitud(text,text) to anon,authenticated,service_role;
grant execute on function public.abastecimiento_raba03_active_tombstones() to service_role;
grant execute on function public.abastecimiento_raba03_confirm_sheet_delete(text) to service_role;
