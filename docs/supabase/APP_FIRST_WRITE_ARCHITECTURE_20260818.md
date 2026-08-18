# Arquitectura APP → Supabase → Google Sheets

Fecha: 2026-08-18

## Regla operativa

La aplicación web no debe depender de Google Sheets para confirmar una escritura compartida.

1. La app guarda primero en Supabase.
2. La escritura queda disponible de inmediato para las demás PCs.
3. Los RPC de escritura agregan un evento a `public.app_sync_outbox`.
4. El sincronizador maestro de Apps Script, cada 5 minutos, consume el outbox, replica la operación en la planilla correspondiente y confirma (`ACK`) únicamente los eventos escritos correctamente.
5. Si la escritura en Sheets falla, `synced_at` permanece NULL y se reintenta en el siguiente ciclo.
6. Las planillas continúan sincronizándose hacia Supabase para capturar cambios externos/manuales.

## Dominios cubiertos

- Mantenimiento Programado: `pm_config`, `pm_registros`, `pm_programacion`, `pm_repuestos`.
- Justificaciones de atraso / movimientos: `movimientos_equipos`.
- Lista Maestra de Equipos.
- Correcciones de ROP02 por proyecto.
- Abastecimiento: RABA03, remitos y estados de solicitudes.
- Stock crítico.
- Licitaciones.

## Seguridad y consistencia

Los RPC `app_sync_outbox_pull` y `app_sync_outbox_ack` están reservados al `service_role` utilizado por Apps Script; no se exponen a `anon` ni `authenticated`.

El outbox constituye una cola de entrega al menos una vez. Apps Script aplica operaciones por ID o fila física cuando existe identidad estable y recién después confirma el evento. Esto evita marcar como sincronizada una operación que no llegó a Excel.

La autenticación de la aplicación continúa separada de esta cola. No se replica ninguna contraseña hacia Supabase.
