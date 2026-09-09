-- Post-install hardening: stable upserts, authoritative Abastecimiento mirrors,
-- and credential synchronization that never resets a user password on each run.

create or replace function public.sync_generic_dataset(p_dataset text, p_rows jsonb, p_source_version bigint default null)
returns jsonb
language plpgsql
set search_path to ''
as $$
declare
  v_dataset text:=lower(trim(coalesce(p_dataset,'')));
  v_input integer:=0;
  v_existing integer:=0;
  v_changed integer:=0;
  v_deleted integer:=0;
begin
  if v_dataset='' then raise exception 'dataset requerido'; end if;
  if jsonb_typeof(coalesce(p_rows,'[]'::jsonb))<>'array' then raise exception 'p_rows debe ser array'; end if;
  select count(*) into v_input from jsonb_array_elements(p_rows) item
  where coalesce(item->>'source_row','') ~ '^[0-9]+$';
  select count(*) into v_existing
  from public.delta_dataset_rows d
  join jsonb_array_elements(p_rows) item on coalesce(item->>'source_row','') ~ '^[0-9]+$'
    and d.dataset=v_dataset and d.source_row=(item->>'source_row')::integer;

  insert into public.delta_dataset_rows(dataset,source_row,row_data,source_version,synced_at,updated_at)
  select v_dataset,(item->>'source_row')::integer,coalesce(item->'row_data','{}'::jsonb),p_source_version,now(),now()
  from jsonb_array_elements(p_rows) item
  where coalesce(item->>'source_row','') ~ '^[0-9]+$'
  on conflict(dataset,source_row) do update set
    row_data=excluded.row_data,source_version=excluded.source_version,synced_at=now(),updated_at=now()
  where public.delta_dataset_rows.row_data is distinct from excluded.row_data
     or public.delta_dataset_rows.source_version is distinct from excluded.source_version;
  get diagnostics v_changed=row_count;

  delete from public.delta_dataset_rows d
  where d.dataset=v_dataset and not exists(
    select 1 from jsonb_array_elements(p_rows) item
    where coalesce(item->>'source_row','') ~ '^[0-9]+$' and (item->>'source_row')::integer=d.source_row
  );
  get diagnostics v_deleted=row_count;
  return jsonb_build_object('ok',true,'dataset',v_dataset,'sourceRows',v_input,
    'inserted',greatest(v_changed-v_existing,0),'updated',least(v_changed,v_existing),
    'deleted',v_deleted,'total',(select count(*) from public.delta_dataset_rows where dataset=v_dataset),'syncedAt',now());
end $$;

create or replace function public.sync_authoritative_abastecimiento_storage(
  p_dataset text, p_rows jsonb, p_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  x jsonb;
  i jsonb;
  v_id text;
  v_exists boolean;
  v_mutation integer;
  v_inserted integer:=0;
  v_updated integer:=0;
  v_deleted integer:=0;
  v_headers integer:=0;
  v_items integer:=0;
begin
  p_dataset:=lower(coalesce(p_dataset,''));
  p_rows:=coalesce(p_rows,'[]'::jsonb);
  if jsonb_typeof(p_rows)<>'array' then raise exception 'p_rows debe ser array'; end if;

  if p_dataset='abastecimiento_raba03' then
    for x in select * from jsonb_array_elements(p_rows) loop
      if coalesce(x->>'source_row','') ~ '^\d+$' then
        select exists(select 1 from public.abastecimiento_raba03 where source_row=(x->>'source_row')::integer) into v_exists;
        insert into public.abastecimiento_raba03(source_row,row_data,synced_at,updated_at)
        values((x->>'source_row')::integer,coalesce(x->'row_data','{}'::jsonb),now(),now())
        on conflict(source_row) do update set row_data=excluded.row_data,synced_at=now(),updated_at=now()
        where public.abastecimiento_raba03.row_data is distinct from excluded.row_data;
        get diagnostics v_mutation=row_count;
        if v_mutation>0 then
          if v_exists then v_updated:=v_updated+1; else v_inserted:=v_inserted+1; end if;
        end if;
      end if;
    end loop;
    delete from public.abastecimiento_raba03 r
    where not exists(
      select 1 from jsonb_array_elements(p_rows) s
      where coalesce(s->>'source_row','') ~ '^\d+$' and (s->>'source_row')::integer=r.source_row
    );
    get diagnostics v_deleted=row_count;
    return jsonb_build_object('ok',true,'dataset',p_dataset,'sourceRows',jsonb_array_length(p_rows),
      'destinationRows',(select count(*) from public.abastecimiento_raba03),'inserted',v_inserted,
      'updated',v_updated,'deleted',v_deleted,'syncedAt',now());
  end if;

  if p_dataset='abastecimiento_remitos' then
    for x in select * from jsonb_array_elements(p_rows) loop
      v_id:=trim(coalesce(x->>'id',x->>'ID_REMITO',''));
      if v_id='' then continue; end if;
      select exists(select 1 from public.abastecimiento_remitos where id=v_id) into v_exists;
      insert into public.abastecimiento_remitos(id,comprobante,fecha,origen,destino,proyecto,observaciones,usuario_carga,fecha_carga_app,updated_at)
      values(v_id,coalesce(x->>'comprobante',x->>'N_REMITO',''),nullif(coalesce(x->>'fecha',x->>'FECHA_REMITO',''),'')::date,
        coalesce(x->>'origen',x->>'ORIGEN',''),coalesce(x->>'destino',x->>'DESTINO',''),coalesce(x->>'proyecto',x->>'PROYECTO',''),
        coalesce(x->>'observaciones',x->>'OBSERVACIONES',''),coalesce(x->>'usuarioCarga',x->>'USUARIO_CARGA','SHEETS'),
        coalesce(nullif(coalesce(x->>'fechaCargaApp',x->>'FECHA_CARGA_APP',''),'')::timestamptz,now()),now())
      on conflict(id) do update set comprobante=excluded.comprobante,fecha=excluded.fecha,origen=excluded.origen,destino=excluded.destino,
        proyecto=excluded.proyecto,observaciones=excluded.observaciones,usuario_carga=excluded.usuario_carga,updated_at=now()
      where (public.abastecimiento_remitos.comprobante,public.abastecimiento_remitos.fecha,public.abastecimiento_remitos.origen,
        public.abastecimiento_remitos.destino,public.abastecimiento_remitos.proyecto,public.abastecimiento_remitos.observaciones,
        public.abastecimiento_remitos.usuario_carga) is distinct from
        (excluded.comprobante,excluded.fecha,excluded.origen,excluded.destino,excluded.proyecto,excluded.observaciones,excluded.usuario_carga);
      get diagnostics v_mutation=row_count;
      if v_mutation>0 then if v_exists then v_updated:=v_updated+1; else v_inserted:=v_inserted+1; end if; end if;
      v_headers:=v_headers+1;

      for i in select * from jsonb_array_elements(coalesce(x->'items','[]'::jsonb)) loop
        if coalesce(i->>'source_row','') ~ '^\d+$' then
          select exists(select 1 from public.abastecimiento_remito_items where source_row=(i->>'source_row')::integer) into v_exists;
          insert into public.abastecimiento_remito_items(remito_id,source_row,codigo_articulo,descripcion,cantidad)
          values(v_id,(i->>'source_row')::integer,coalesce(i->>'codigo',i->>'CODIGO_ARTICULO',''),coalesce(i->>'descripcion',i->>'DESCRIPCION',''),
            case when coalesce(i->>'cantidad',i->>'CANTIDAD_ENVIADA','') ~ '^-?[0-9]+([.,][0-9]+)?$' then replace(coalesce(i->>'cantidad',i->>'CANTIDAD_ENVIADA'),',','.')::numeric else 0 end)
          on conflict(source_row) do update set remito_id=excluded.remito_id,codigo_articulo=excluded.codigo_articulo,descripcion=excluded.descripcion,cantidad=excluded.cantidad
          where (public.abastecimiento_remito_items.remito_id,public.abastecimiento_remito_items.codigo_articulo,public.abastecimiento_remito_items.descripcion,public.abastecimiento_remito_items.cantidad)
            is distinct from (excluded.remito_id,excluded.codigo_articulo,excluded.descripcion,excluded.cantidad);
          get diagnostics v_mutation=row_count;
          if v_mutation>0 then if v_exists then v_updated:=v_updated+1; else v_inserted:=v_inserted+1; end if; end if;
          v_items:=v_items+1;
        end if;
      end loop;
    end loop;

    delete from public.abastecimiento_remito_items item
    where item.source_row is not null and not exists(
      select 1 from jsonb_array_elements(p_rows) h cross join lateral jsonb_array_elements(coalesce(h->'items','[]'::jsonb)) s
      where coalesce(s->>'source_row','') ~ '^\d+$' and (s->>'source_row')::integer=item.source_row
    );
    get diagnostics v_deleted=row_count;
    delete from public.abastecimiento_remitos rem
    where not exists(select 1 from jsonb_array_elements(p_rows) h where trim(coalesce(h->>'id',h->>'ID_REMITO',''))=rem.id);
    get diagnostics v_mutation=row_count;
    v_deleted:=v_deleted+v_mutation;
    return jsonb_build_object('ok',true,'dataset',p_dataset,'sourceRows',v_items,'destinationRows',(select count(*) from public.abastecimiento_remito_items),
      'headers',v_headers,'headerRows',(select count(*) from public.abastecimiento_remitos),'inserted',v_inserted,'updated',v_updated,'deleted',v_deleted,'syncedAt',now());
  end if;
  raise exception 'Dataset de almacenamiento autoritativo no permitido: %',p_dataset;
end $$;

create or replace function public.sync_app_users_from_sheet(p_rows jsonb)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare v_rows integer:=0; v_deleted integer:=0;
begin
  if jsonb_typeof(coalesce(p_rows,'[]'::jsonb))<>'array' then raise exception 'p_rows debe ser array'; end if;
  insert into public.app_user_credentials as target(email,password_hash,rol,proyecto,nombre,area,activo,must_change_password,updated_at)
  select lower(btrim(coalesce(x->>'email',''))),
    extensions.crypt(coalesce(nullif(x->>'password',''),'DELTA.MINING.APP'),extensions.gen_salt('bf',10)),
    upper(btrim(coalesce(x->>'rol','USUARIO'))),upper(btrim(coalesce(x->>'proyecto','TODOS'))),
    btrim(coalesce(x->>'nombre','')),btrim(coalesce(x->>'area','')),
    coalesce((x->>'activo')::boolean,true),coalesce(nullif(x->>'password',''),'')='',now()
  from jsonb_array_elements(p_rows) x where lower(btrim(coalesce(x->>'email','')))<>''
  on conflict(email) do update set
    password_hash=case when coalesce(nullif((select x->>'password' from jsonb_array_elements(p_rows) x where lower(btrim(coalesce(x->>'email','')))=target.email limit 1),''),'')<>''
      then case when target.password_hash=extensions.crypt((select x->>'password' from jsonb_array_elements(p_rows) x where lower(btrim(coalesce(x->>'email','')))=target.email limit 1),target.password_hash)
        then target.password_hash else extensions.crypt((select x->>'password' from jsonb_array_elements(p_rows) x where lower(btrim(coalesce(x->>'email','')))=target.email limit 1),extensions.gen_salt('bf',10)) end
      else target.password_hash end,
    rol=excluded.rol,proyecto=excluded.proyecto,nombre=excluded.nombre,area=excluded.area,activo=excluded.activo,
    must_change_password=case when coalesce(nullif((select x->>'password' from jsonb_array_elements(p_rows) x where lower(btrim(coalesce(x->>'email','')))=target.email limit 1),''),'')<>'' then false else target.must_change_password end,
    updated_at=now();
  get diagnostics v_rows=row_count;
  delete from public.app_user_credentials c where not exists(select 1 from jsonb_array_elements(p_rows) x where lower(btrim(coalesce(x->>'email','')))=c.email);
  get diagnostics v_deleted=row_count;
  return jsonb_build_object('ok',true,'sourceRows',(select count(*) from jsonb_array_elements(p_rows) x where lower(btrim(coalesce(x->>'email','')))<>''),'rows',v_rows,'deleted',v_deleted,'destinationRows',(select count(*) from public.app_user_credentials),'syncedAt',now());
end $$;

revoke all on function public.sync_authoritative_abastecimiento_storage(text,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.sync_authoritative_abastecimiento_storage(text,jsonb,jsonb) to service_role;
revoke all on function public.sync_generic_dataset(text,jsonb,bigint) from public,anon,authenticated;
grant execute on function public.sync_generic_dataset(text,jsonb,bigint) to service_role;
revoke all on function public.sync_app_users_from_sheet(jsonb) from public,anon,authenticated;
grant execute on function public.sync_app_users_from_sheet(jsonb) to service_role;

