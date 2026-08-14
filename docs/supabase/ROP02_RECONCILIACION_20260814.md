# Reconciliación ROP02 — 2026-08-14

## Fuentes verificadas

Las cuatro Google Sheets ROP02 se exportaron directamente desde Drive y se contrastaron con Supabase usando la identidad `(source_dataset, source_row)`.

| Dataset | Registros fuente | Última fila física |
|---|---:|---:|
| `rop02_jm` | 6.397 | 6.401 |
| `rop02_fs` | 3.393 | 3.397 |
| `rop02_filosur` | 194 | 198 |
| `rop02_zorro` | 83 | 87 |
| **Total** | **10.067** | — |

## Hallazgo

Supabase contenía 9.980 identidades ROP02. La comparación completa detectó:

- 87 filas presentes en Drive y ausentes en Supabase.
- 433 identidades existentes cuyo contenido ya no coincidía con la fila física actual de Drive.
- 0 identidades obsoletas que debieran eliminarse.

El problema no era solamente un atraso al final de las hojas: hubo desplazamientos/cambios de filas físicas, por lo que un append incremental habría dejado datos incorrectos.

## Reconciliación aplicada

Antes de modificar `public.rop02` se preservó un backup completo en `public.rop02_backup_pre_drive_reconcile_20260814`.

Se construyó staging privado, se cargaron las 10.067 identidades live y se aplicaron únicamente las diferencias:

- 520 filas insertadas/actualizadas.
- 0 filas eliminadas.

Validación posterior:

- filas Supabase: 10.067;
- faltantes: 0;
- diferencias de hash: 0;
- extras: 0;
- identidades duplicadas: 0.

## Seguridad

Las funciones de reconciliación están en el esquema `private` y no son ejecutables por `anon` ni `authenticated`.

También se redujeron a lectura los grants frontend innecesariamente amplios de:

- `rop02_operational_frontend`;
- `rma15_insumos`;
- `delta_dataset_rows`;
- `delta_special_cache`.

Las escrituras operativas que todavía requieren Google Sheets continúan por Apps Script; esta modificación no cambia ese contrato.

## Resultado

ROP02 queda reconciliado 1:1 con las cuatro fuentes de Drive al cierre de esta auditoría. El repositorio original `NahuelGarciaDelta/delta-mining-ops` no fue modificado.
