-- Reduce carga de CPU/IO causada por polling legacy desde PostgreSQL hacia Apps Script.
-- La sincronización vigente es event-driven desde Sheets + outbox desde la app.

DO $$
DECLARE j record;
BEGIN
  FOR j IN
    SELECT jobid
    FROM cron.job
    WHERE command IN (
      'select private.refresh_delta_special_cache();',
      'select private.refresh_rop02_canonical_from_appscript();'
    )
  LOOP
    PERFORM cron.unschedule(j.jobid);
  END LOOP;
END $$;

-- Índices 100% redundantes. Se conserva una única copia equivalente.
DROP INDEX IF EXISTS public.delta_dataset_rows_dataset_source_row_key;
DROP INDEX IF EXISTS public.idx_rop02_fecha;
DROP INDEX IF EXISTS public.idx_rop02_interno;
DROP INDEX IF EXISTS public.idx_rop02_interno_fecha;
DROP INDEX IF EXISTS public.idx_rop02_interno_proyecto_fecha;
DROP INDEX IF EXISTS public.idx_rop02_proyecto;

-- La restricción UNIQUE (source_dataset, source_row) ya tiene su propio índice.
DROP INDEX IF EXISTS public.idx_rop02_source_dataset_row;

-- rop02_frontend_read_only ya cubre anon + authenticated para SELECT.
DROP POLICY IF EXISTS "ROP02 lectura" ON public.rop02;
