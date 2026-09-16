-- Optimiza lecturas por fuente desde rop02_frontend.
-- Se expone source_dataset/source_row en la vista y se agrega un índice
-- compuesto compatible con filtro exacto + orden por fecha/source_key.

create index if not exists rop02_source_dataset_fecha_source_key_idx
  on public.rop02 (source_dataset, fecha, source_key)
  where source_row is not null;

create or replace view public.rop02_frontend as
select
  id,
  fecha,
  interno,
  equipo,
  operador,
  supervisor_delta,
  supervisor_vial_cliente,
  turno_trabajo,
  numero_parte,
  proyecto,
  horometro_inicial,
  horometro_final,
  cantidad_horas,
  combustible,
  aceite,
  descripcion_trabajos,
  informacion_desgaste,
  observaciones,
  source_key,
  created_at,
  updated_at,
  synced_at,
  public.rop02_classify_state(cantidad_horas, descripcion_trabajos, observaciones) as estado,
  aceite_text,
  source_dataset,
  source_row
from public.rop02 r
where source_dataset = any (array['rop02_fs'::text,'rop02_jm'::text,'rop02_filosur'::text,'rop02_zorro'::text])
  and source_row is not null;

grant select on public.rop02_frontend to anon, authenticated;

-- Compatibilidad mientras clientes antiguos sigan filtrando por prefijo source_key.
create index if not exists rop02_source_key_pattern_idx
  on public.rop02 (source_key text_pattern_ops)
  where source_row is not null;
