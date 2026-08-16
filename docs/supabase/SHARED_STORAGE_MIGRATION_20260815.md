# Migración de almacenamiento compartido a Supabase — 2026-08-15

## Objetivo

La aplicación React usa Supabase como fuente operativa compartida entre computadoras. Google Sheets deja de ser el mecanismo requerido para compartir cargas creadas desde la aplicación. Apps Script queda reservado para una futura capa de sincronización Sheets ↔ Supabase y, temporalmente, para autenticación/perfil mientras se migra el manejo de credenciales.

## Dominios operativos migrados

- ROP02: lectura canónica y edición desde Supabase.
- ROP05: lectura canónica desde Supabase.
- RMA15: lectura canónica desde Supabase.
- Lista Maestra de Equipos: lectura y altas/ediciones/bulk desde Supabase.
- Insumos: lectura desde Supabase.
- Abastecimiento: RABA03, remitos, ítems de remito y estados compartidos desde Supabase.
- Stock crítico: snapshot y reemplazo completo desde Supabase.
- Mantenimiento Programado: configuración, PM realizados, programaciones y repuestos desde Supabase.
- Licitaciones: estado compartido y guardado desde Supabase.
- Movimientos de Equipos: historial, altas y cancelaciones desde Supabase.

## Estado histórico migrado al corte

- Licitaciones: 3.
- Configuraciones PM: 59 (incluye PCA-0113 que estaba en Drive y no en el mirror genérico).
- Movimientos de equipos: 13.
- Stock crítico: 5.616 filas.
- RABA03: 324 filas.
- Remitos: 40 remitos / 582 ítems.
- Estados de solicitudes: 89.

PM_REGISTROS, PM_PROGRAMACION y PM_REPUESTOS estaban vacíos en la fuente al corte, por lo que sus tablas Supabase se inicializaron vacías y listas para nuevas cargas.

## Escrituras futuras y sincronización con Sheets

Todas las escrituras operativas migradas generan además una fila en `public.app_sync_outbox`. La app no espera que esa fila sea copiada a Google Sheets para considerar el guardado exitoso. En una etapa posterior, Apps Script puede consumir este outbox y reflejar los cambios en las planillas, o continuar enviando cambios de planillas hacia Supabase.

## Excepción temporal: autenticación/perfil

`Login.jsx` y el cambio de contraseña/perfil continúan usando el Apps Script existente porque la fuente histórica de usuarios contiene credenciales y su migración requiere un cambio de autenticación explícito (Supabase Auth o un mecanismo equivalente) sin exponer ni copiar contraseñas en el frontend. No se incluyó esa migración dentro del almacenamiento operativo para evitar debilitar la seguridad o invalidar accesos existentes.

## Validación

La migración de frontend fue validada con `npm run check`, `npm run validate` y `npm run build`. Los RPC de snapshots PM, Licitaciones, Stock y Movimientos responden correctamente en producción.
