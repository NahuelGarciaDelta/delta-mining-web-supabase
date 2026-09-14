alter table public.app_sync_outbox
  add column if not exists status text not null default 'pending',
  add column if not exists attempt_count integer not null default 0,
  add column if not exists last_attempt_at timestamptz,
  add column if not exists last_error text;

update public.app_sync_outbox
set status=case when synced_at is null then 'pending' else 'synced' end
where status is null or status not in ('pending','synced','failed');

drop function if exists public.app_sync_outbox_pull(integer);
create function public.app_sync_outbox_pull(p_limit integer default 100)
returns table(
  id bigint,
  domain text,
  record_key text,
  operation text,
  payload jsonb,
  created_at timestamptz,
  attempt_count integer
)
language plpgsql
security definer
set search_path=''
as $$
begin
  return query
  with picked as (
    select o.id
    from public.app_sync_outbox o
    where o.synced_at is null
    order by o.id
    limit greatest(1,least(coalesce(p_limit,100),500))
    for update skip locked
  ), touched as (
    update public.app_sync_outbox o
    set attempt_count=o.attempt_count+1,
        last_attempt_at=now(),
        status='pending'
    from picked p
    where o.id=p.id
    returning o.id,o.domain,o.record_key,o.operation,o.payload,o.created_at,o.attempt_count
  )
  select t.id,t.domain,t.record_key,t.operation,t.payload,t.created_at,t.attempt_count
  from touched t
  order by t.id;
end
$$;

create or replace function public.app_sync_outbox_ack(p_ids bigint[])
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_count integer;
begin
  update public.app_sync_outbox
  set synced_at=now(),status='synced',last_error=null
  where id=any(coalesce(p_ids,'{}'::bigint[])) and synced_at is null;
  get diagnostics v_count=row_count;
  return jsonb_build_object('ok',true,'acked',v_count);
end
$$;

create or replace function public.app_sync_outbox_fail(p_id bigint,p_error text)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare v_count integer;
begin
  update public.app_sync_outbox
  set status='failed',last_error=left(coalesce(p_error,'Error de sincronización'),4000),last_attempt_at=coalesce(last_attempt_at,now())
  where id=p_id and synced_at is null;
  get diagnostics v_count=row_count;
  return jsonb_build_object('ok',true,'updated',v_count);
end
$$;

revoke all on function public.app_sync_outbox_pull(integer) from public,anon,authenticated;
revoke all on function public.app_sync_outbox_ack(bigint[]) from public,anon,authenticated;
revoke all on function public.app_sync_outbox_fail(bigint,text) from public,anon,authenticated;
grant execute on function public.app_sync_outbox_pull(integer) to service_role;
grant execute on function public.app_sync_outbox_ack(bigint[]) to service_role;
grant execute on function public.app_sync_outbox_fail(bigint,text) to service_role;
