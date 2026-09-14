-- Catálogo canónico de insumos equivalente a la hoja "Hoja 1"
-- del libro "informe insumos comprados".
-- Hoja 1 toma el último registro por código y usa el precio unitario con IVA.

create or replace view public.insumos_hoja1_catalogo
with (security_invoker = true) as
with base as (
  select
    i.*,
    case
      when coalesce(i.raw_data->>'Fecha de emisión','') ~ '^\d{4}-\d{2}-\d{2}$'
        then (i.raw_data->>'Fecha de emisión')::date
      else null
    end as fecha_emision,
    case
      when replace(coalesce(i.raw_data->>'precio unitario con IVA',''), ',', '.') ~ '^-?[0-9]+(?:\.[0-9]+)?$'
        then replace(i.raw_data->>'precio unitario con IVA', ',', '.')::numeric
      else i.precio_unitario
    end as precio_hoja1,
    coalesce(nullif(i.raw_data->>'Desc. Adicional',''), nullif(i.descripcion_adicional,''), '') as descripcion_adicional_hoja1
  from public.insumos i
  where nullif(btrim(i.codigo),'') is not null
), ranked as (
  select
    base.*,
    row_number() over (
      partition by btrim(base.codigo)
      order by base.fecha_emision desc nulls last, base.source_row asc, base.id asc
    ) as rn
  from base
)
select
  id,
  source_dataset,
  source_row,
  btrim(codigo) as codigo,
  descripcion,
  precio_hoja1 as precio_unitario,
  descripcion_adicional_hoja1 as descripcion_adicional,
  raw_data,
  synced_at
from ranked
where rn = 1;

grant select on public.insumos_hoja1_catalogo to anon, authenticated;

create or replace function public.delta_canonicalize_insumos_hoja1()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.insumos i
  set
    precio_unitario = case
      when replace(coalesce(i.raw_data->>'precio unitario con IVA',''), ',', '.') ~ '^-?[0-9]+(?:\.[0-9]+)?$'
        then replace(i.raw_data->>'precio unitario con IVA', ',', '.')::numeric
      else i.precio_unitario
    end,
    descripcion_adicional = coalesce(
      nullif(i.raw_data->>'Desc. Adicional',''),
      nullif(i.descripcion_adicional,''),
      ''
    ),
    synced_at = now()
  where
    i.precio_unitario is distinct from case
      when replace(coalesce(i.raw_data->>'precio unitario con IVA',''), ',', '.') ~ '^-?[0-9]+(?:\.[0-9]+)?$'
        then replace(i.raw_data->>'precio unitario con IVA', ',', '.')::numeric
      else i.precio_unitario
    end
    or i.descripcion_adicional is distinct from coalesce(
      nullif(i.raw_data->>'Desc. Adicional',''),
      nullif(i.descripcion_adicional,''),
      ''
    );

  delete from public.insumos i
  using (
    select id
    from (
      select
        id,
        row_number() over (
          partition by btrim(codigo)
          order by
            case
              when coalesce(raw_data->>'Fecha de emisión','') ~ '^\d{4}-\d{2}-\d{2}$'
                then (raw_data->>'Fecha de emisión')::date
              else null
            end desc nulls last,
            source_row asc,
            id asc
        ) as rn
      from public.insumos
      where nullif(btrim(codigo),'') is not null
    ) ranked
    where rn > 1
  ) duplicates
  where i.id = duplicates.id;
end;
$$;

create or replace function public.delta_enforce_insumos_hoja1_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() <= 1 then
    perform public.delta_canonicalize_insumos_hoja1();
  end if;
  return null;
end;
$$;

drop trigger if exists trg_enforce_insumos_hoja1_catalogo on public.insumos;
create trigger trg_enforce_insumos_hoja1_catalogo
after insert or update or delete on public.insumos
for each statement
execute function public.delta_enforce_insumos_hoja1_trigger();

select public.delta_canonicalize_insumos_hoja1();
update public.insumos set synced_at = now();
