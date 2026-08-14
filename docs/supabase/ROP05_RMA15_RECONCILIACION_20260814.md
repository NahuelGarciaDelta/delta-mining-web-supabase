# Reconciliación ROP05 y RMA15 — 2026-08-14

## Motivo

La aplicación Supabase estaba leyendo tablas tipadas que habían quedado atrasadas respecto de las Google Sheets operativas. Esto generaba falsos positivos en `Control ROP05 vs ROP02` y vistas RMA15 incompletas.

## ROP05

Fuente live validada mediante el endpoint de Apps Script usado por la aplicación:

- filas fuente: 5.846;
- rango físico: filas 2 a 5.847;
- última fecha: 2026-08-13.

Antes de reconciliar, `public.rop05` tenía 5.791 filas. Se creó backup previo y staging privado y se reconciliaron las 5.846 identidades `(source_dataset, source_row)`.

Se verificó específicamente que quedaron presentes, entre otros:

- PCA-0017-JM — 07/08/2026 — parte 183 — 6 hs — Limpieza de nieve;
- PCA-0017-JM — 08/08/2026 — parte 184 — 6 hs — Limpieza de nieve;
- PCA-0070-JM — 07/08/2026 — parte 503 — 7 hs — Limpieza de nieve;
- PCA-0070-JM — 08/08/2026 — parte 504 — 5 hs — Limpieza de nieve;
- PCA-0074-JM — 07/08/2026 — parte 444 — 8 hs — Carga/descarga de camión;
- PCA-0074-JM — 08/08/2026 — parte 445 — 8 hs — Limpieza de nieve.

## RMA15

También se verificaron las fuentes RMA15 live:

- Filo del Sol: 1.219 registros válidos en Supabase;
- José María: 1.605 registros válidos con fecha e interno;
- total reconciliado: 2.824 registros válidos.

Se preservó un backup previo antes de aplicar la reconciliación.

## Frontend

Además de la reconciliación de datos:

- las lecturas tipadas ROP02/ROP05/RMA15 pasan a ser network-first contra Supabase, usando caché local solamente como fallback ante error de red;
- Vehículos fuerza lectura fresca de Supabase cuando solicita el histórico completo;
- en desarrollo se desregistra el Service Worker y se limpian sus cachés para evitar módulos `/src` obsoletos;
- el Service Worker productivo usa network-first para JS/CSS y cambia a una nueva versión de caché.

Esto evita el caso observado donde `InformeCostosView` era nuevo pero el navegador servía un `InformeCostosEngine.js` viejo sin el export `matchesAmortizationTypeFilter`.

El repositorio `NahuelGarciaDelta/delta-mining-ops` se utilizó sólo como referencia y no fue modificado.
