# Inventario final de consumidores ROP02

| Consumidor | Estado | Consulta Supabase |
|---|---|---|
| ROP02 general | MIGRADO | Página/count/filtros/orden en servidor; 250 filas por bloque |
| Exportación ROP02 | MIGRADO | Lectura completa del resultado filtrado en bloques de 2.000 |
| Bienvenida | MIGRADO | `rop02_latest_by_equipment_project` |
| Atraso ROP02 | MIGRADO | Último registro por equipo/proyecto + ventana de 45 días |
| Dashboard | MIGRADO | Rango operativo activo + `rop02_monthly_summary` |
| Ficha única | MIGRADO | `interno` + rango seleccionado |
| Horómetros | MIGRADO | `rop02_operational_snapshot` o rango seleccionado |
| Lista Maestra / Taller Central | MIGRADO | Snapshot compacto de último horómetro y actividad reciente |
| Vehículos | MIGRADO | Snapshot/ventana operativa acotada |
| Combustible | MIGRADO | Rango activo con `combustible is not null and combustible > 0` |
| Control de errores / por equipo / ROP02 | MIGRADO | Período operativo 26→25 seleccionado |
| Control ROP02 vs ROP05 | MIGRADO | ROP02 acotado al filtro activo; cruce recalculado con ROP05 |
| ICHC | MIGRADO | Período operativo seleccionado |
| Ranking de operarios | MIGRADO | Día/período activo |
| Cambios de turno | MIGRADO | Período 26→25 seleccionado |
| Mantenimiento Programado | MIGRADO | Snapshot último registro + actividad del rango (máximo 90 días) |
| Licitaciones / Datos Equipos | MIGRADO | Rango Desde/Hasta activo |
| Informe de Costos | MIGRADO | Rango histórico activo |
| Escritura `update_rop02_row` | NO APLICA | Escritura autorizada a Google Sheets; no es lectura ROP02 |
| Sincronización Sheets → Supabase | NO APLICA | Se conserva sin cambios |

Resumen: **MIGRADO: todos los consumidores de lectura. LEGACY JUSTIFICADO: 0.**

`VIEW_SOURCES` no contiene claves RAW ROP02. Con `VITE_ROP02_SOURCE=supabase`, las
pantallas sólo pasan por `rop02Repository`. El acceso legacy existe únicamente dentro
de `historicalDataService` como rollback explícito o fallback después de un error real.
