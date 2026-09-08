-- ESTADOS SOLICITUDES es una imagen autoritativa de su hoja fuente.
-- Conserva los UPSERTS y expone cuántos estados obsoletos fueron eliminados.
create or replace function public.sync_sheet_storage_dataset(
  p_dataset text,
  p_rows jsonb,
  p_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  x jsonb;
  i jsonb;
  v_count integer := 0;
  v_deleted integer := 0;
  v_id text;
  v_key text;
begin
  p_dataset := lower(coalesce(p_dataset,''));
  p_rows := coalesce(p_rows,'[]'::jsonb);

  if p_dataset='abastecimiento_raba03' then
    for x in select * from jsonb_array_elements(p_rows) loop
      if coalesce(x->>'source_row','') ~ '^\d+$' then
        insert into public.abastecimiento_raba03(source_row,row_data,synced_at,updated_at)
        values((x->>'source_row')::integer,coalesce(x->'row_data','{}'::jsonb),now(),now())
        on conflict(source_row) do update set row_data=excluded.row_data,synced_at=now(),updated_at=now();
        v_count:=v_count+1;
      end if;
    end loop;

  elsif p_dataset='abastecimiento_estados' then
    for x in select * from jsonb_array_elements(p_rows) loop
      v_key:=trim(coalesce(x->>'clave',x->>'CLAVE_SOLICITUD',''));
      if v_key<>'' then
        insert into public.abastecimiento_solicitud_estados(
          clave_solicitud,estado,observacion,n_solicitud,codigo_articulo,descripcion,fecha,fecha_solicitud,usuario,updated_at
        ) values(
          v_key,coalesce(x->>'estado',x->>'ESTADO',''),coalesce(x->>'observacion',x->>'OBSERVACION',''),
          coalesce(x->>'nSolicitud',x->>'N_SOLICITUD',''),coalesce(x->>'codigoArticulo',x->>'CODIGO_ARTICULO',''),
          coalesce(x->>'descripcion',x->>'DESCRIPCION',''),coalesce(x->>'fecha',x->>'FECHA',''),
          coalesce(x->>'fechaSolicitud',x->>'FECHA_SOLICITUD',''),coalesce(x->>'usuario',x->>'USUARIO','SHEETS'),now()
        ) on conflict(clave_solicitud) do update set
          estado=excluded.estado,observacion=excluded.observacion,n_solicitud=excluded.n_solicitud,
          codigo_articulo=excluded.codigo_articulo,descripcion=excluded.descripcion,fecha=excluded.fecha,
          fecha_solicitud=excluded.fecha_solicitud,usuario=excluded.usuario,updated_at=now();
        v_count:=v_count+1;
      end if;
    end loop;

    delete from public.abastecimiento_solicitud_estados e
    where not exists (
      select 1
      from jsonb_array_elements(p_rows) s
      where trim(coalesce(s->>'clave',s->>'CLAVE_SOLICITUD','')) = e.clave_solicitud
    );
    get diagnostics v_deleted=row_count;

  elsif p_dataset='abastecimiento_remitos' then
    for x in select * from jsonb_array_elements(p_rows) loop
      v_id:=trim(coalesce(x->>'id',x->>'ID_REMITO',''));
      if v_id<>'' then
        insert into public.abastecimiento_remitos(id,comprobante,fecha,origen,destino,proyecto,observaciones,usuario_carga,fecha_carga_app,updated_at)
        values(
          v_id,coalesce(x->>'comprobante',x->>'N_REMITO',''),nullif(coalesce(x->>'fecha',x->>'FECHA_REMITO',''),'')::date,
          coalesce(x->>'origen',x->>'ORIGEN',''),coalesce(x->>'destino',x->>'DESTINO',''),
          coalesce(x->>'proyecto',x->>'PROYECTO',''),coalesce(x->>'observaciones',x->>'OBSERVACIONES',''),
          coalesce(x->>'usuarioCarga',x->>'USUARIO_CARGA','SHEETS'),
          coalesce(nullif(coalesce(x->>'fechaCargaApp',x->>'FECHA_CARGA_APP',''),'')::timestamptz,now()),now()
        ) on conflict(id) do update set
          comprobante=excluded.comprobante,fecha=excluded.fecha,origen=excluded.origen,destino=excluded.destino,
          proyecto=excluded.proyecto,observaciones=excluded.observaciones,usuario_carga=excluded.usuario_carga,updated_at=now();
        for i in select * from jsonb_array_elements(coalesce(x->'items','[]'::jsonb)) loop
          if coalesce(i->>'source_row','') ~ '^\d+$' then
            insert into public.abastecimiento_remito_items(remito_id,source_row,codigo_articulo,descripcion,cantidad)
            values(v_id,(i->>'source_row')::integer,coalesce(i->>'codigo',i->>'CODIGO_ARTICULO',''),coalesce(i->>'descripcion',i->>'DESCRIPCION',''),
              case when coalesce(i->>'cantidad',i->>'CANTIDAD_ENVIADA','') ~ '^-?[0-9]+([.,][0-9]+)?$' then replace(coalesce(i->>'cantidad',i->>'CANTIDAD_ENVIADA'),',','.')::numeric else 0 end)
            on conflict(source_row) do update set remito_id=excluded.remito_id,codigo_articulo=excluded.codigo_articulo,descripcion=excluded.descripcion,cantidad=excluded.cantidad;
          end if;
        end loop;
        v_count:=v_count+1;
      end if;
    end loop;

  elsif p_dataset='licitaciones' then
    for x in select * from jsonb_array_elements(p_rows) loop
      v_id:=trim(coalesce(x->>'id',''));
      if v_id<>'' then
        insert into public.app_licitaciones(id,data,activo,updated_at,updated_by)
        values(v_id,x,true,now(),'SHEETS')
        on conflict(id) do update set data=excluded.data,activo=true,updated_at=now(),updated_by='SHEETS';
        v_count:=v_count+1;
      end if;
    end loop;

  elsif p_dataset='pm_config' then
    for x in select * from jsonb_array_elements(p_rows) loop
      v_key:=trim(coalesce(x->>'interno',''));
      if v_key<>'' then
        insert into public.app_pm_config(interno,data,updated_at,updated_by)
        values(v_key,x,now(),'SHEETS')
        on conflict(interno) do update set data=excluded.data,updated_at=now(),updated_by='SHEETS';
        v_count:=v_count+1;
      end if;
    end loop;

  elsif p_dataset='pm_registros' then
    for x in select * from jsonb_array_elements(p_rows) loop
      v_id:=trim(coalesce(x->>'id',x->>'idPM',''));
      if v_id<>'' then
        insert into public.app_pm_registros(id,data,created_at,created_by)
        values(v_id,x,now(),'SHEETS')
        on conflict(id) do update set data=excluded.data;
        v_count:=v_count+1;
      end if;
    end loop;

  elsif p_dataset='pm_programaciones' then
    for x in select * from jsonb_array_elements(p_rows) loop
      v_id:=trim(coalesce(x->>'id',''));
      if v_id<>'' then
        insert into public.app_pm_programaciones(id,data,updated_at,updated_by)
        values(v_id,x,now(),'SHEETS')
        on conflict(id) do update set data=excluded.data,updated_at=now(),updated_by='SHEETS';
        v_count:=v_count+1;
      end if;
    end loop;

  elsif p_dataset='pm_repuestos' then
    for x in select * from jsonb_array_elements(p_rows) loop
      v_id:=trim(coalesce(x->>'id',''));
      if v_id<>'' then
        insert into public.app_pm_repuestos(id,data,updated_at,updated_by)
        values(v_id,x,now(),'SHEETS')
        on conflict(id) do update set data=excluded.data,updated_at=now(),updated_by='SHEETS';
        v_count:=v_count+1;
      end if;
    end loop;

  elsif p_dataset='movimientos_equipos' then
    for x in select * from jsonb_array_elements(p_rows) loop
      v_id:=trim(coalesce(x->>'id',''));
      if v_id<>'' then
        insert into public.app_equipment_movements(id,data,activo,updated_at,updated_by)
        values(v_id,x,coalesce((x->>'activo')::boolean,true),now(),'SHEETS')
        on conflict(id) do update set data=excluded.data,activo=excluded.activo,updated_at=now(),updated_by='SHEETS';
        v_count:=v_count+1;
      end if;
    end loop;

  elsif p_dataset='stock' then
    insert into public.app_stock_state(singleton,meta,rows,updated_at,updated_by)
    values(true,coalesce(p_meta,'{}'::jsonb),p_rows,now(),'SHEETS')
    on conflict(singleton) do update set meta=excluded.meta,rows=excluded.rows,updated_at=now(),updated_by='SHEETS';
    v_count:=jsonb_array_length(p_rows);

  elsif p_dataset='usuarios' then
    for x in select * from jsonb_array_elements(p_rows) loop
      v_key:=lower(trim(coalesce(x->>'email','')));
      if v_key<>'' then
        insert into public.app_users_directory(email,data,updated_at)
        values(v_key,x,now())
        on conflict(email) do update set data=excluded.data,updated_at=now();
        v_count:=v_count+1;
      end if;
    end loop;

  else
    raise exception 'Dataset de almacenamiento no permitido: %', p_dataset;
  end if;

  return jsonb_build_object('ok',true,'dataset',p_dataset,'rows',v_count,'deleted',v_deleted,'syncedAt',now());
end;
$$;
