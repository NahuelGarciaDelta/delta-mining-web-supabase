import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8');

test('Mantenimiento Programado escribe primero en Supabase',()=>{
  const view=read('src/modules/mantenimiento/MantenimientoProgramadoView.jsx');
  const service=read('src/services/operationalSupabase.js');
  assert.match(view,/savePmAction/);
  assert.match(service,/rpc\("app_pm_save"/);
});

test('Justificaciones de atraso escriben movimientos en Supabase',()=>{
  const office=read('src/modules/oficina-tecnica/OficinaTecnicaModule.jsx');
  const movements=read('src/services/equipmentMovements.js');
  const service=read('src/services/operationalSupabase.js');
  assert.match(office,/saveEquipmentMovement\(/);
  assert.match(movements,/saveEquipmentMovementSupabase/);
  assert.match(service,/rpc\("app_equipment_movement_save"/);
});

test('Lista Maestra y correcciones ROP02 usan app_write_action de Supabase',()=>{
  const writes=read('src/services/writeActions.js');
  const service=read('src/services/operationalSupabase.js');
  assert.match(writes,/runOperationalWrite/);
  assert.match(service,/rpc\("app_write_action"/);
});

test('Abastecimiento, Taller, Stock y Licitaciones escriben primero en Supabase',()=>{
  const abastecimiento=read('src/services/abastecimientoSupabase.js');
  const taller=read('src/services/tallerMovements.js');
  const stock=read('src/services/stockService.js');
  const ops=read('src/services/operationalSupabase.js');
  assert.doesNotMatch(abastecimiento,/script\.google\.com|APPS_SCRIPT_URL/);
  assert.match(abastecimiento,/abastecimiento_save_remito/);
  assert.match(abastecimiento,/abastecimiento_delete_raba03_solicitud/);
  assert.match(taller,/app_taller_movement_save/);
  assert.match(taller,/app_taller_movement_delete/);
  assert.match(stock,/replaceStock/);
  assert.match(stock,/clearStock/);
  assert.match(ops,/app_licitacion_save/);
  assert.match(ops,/app_licitacion_delete/);
});

test('Artículos de desgaste usa RPC autenticada que genera outbox',()=>{
  const wear=read('src/services/wearCatalogSupabase.js');
  assert.match(wear,/app_replace_wear_articles_v2/);
  assert.match(wear,/dm_auth_token/);
  assert.doesNotMatch(wear,/rpc\("app_replace_wear_articles"/);
});

test('El frontend no conserva transporte POST directo hacia Apps Script',()=>{
  const api=read('src/services/appsScriptApi.js');
  const writes=read('src/services/writeActions.js');
  assert.doesNotMatch(api,/fetch\([^\n]*script\.google\.com/);
  assert.doesNotMatch(writes,/script\.google\.com|APPS_SCRIPT_URL/);
  assert.match(writes,/runOperationalWrite/);
});

test('Outbox final cubre todos los dominios operativos editables y registra fallos',()=>{
  const patch=read('docs/appscript/Delta_Backend_Supabase_PATCH_2026-09-15-ONDEMAND-OUTBOX-V2.gs');
  for(const domain of [
    'raba03','lista_equipos','licitaciones','pm_config','pm_registros','pm_programacion','pm_repuestos',
    'stock','articulos_desgaste','movimientos_taller','movimientos_equipos','remitos_cargados','estados_solicitudes','usuarios'
  ]) assert.match(patch,new RegExp(`domain===\\"${domain}\\"|domain===\"${domain}\"`),`falta dominio ${domain}`);
  for(const rop of ['rop02_fs','rop02_jm','rop02_filosur','rop02_zorro'])assert.match(patch,new RegExp(rop));
  assert.match(patch,/app_sync_outbox_fail/);
  assert.match(patch,/app_sync_outbox_ack/);
});

test('Sheets especiales se sincronizan de forma autoritativa hacia Supabase',()=>{
  const patch=read('docs/appscript/Delta_Backend_Supabase_PATCH_2026-09-15-AUTHORITATIVE-SHEETS-V3.gs');
  const sql=read('supabase/sql/20260915_authoritative_sheet_prune_app_datasets.sql');
  for(const dataset of ['licitaciones','pm_config','pm_registros','pm_programaciones','pm_repuestos']){
    assert.match(patch,new RegExp(dataset));
    assert.match(sql,new RegExp(dataset));
  }
  assert.match(patch,/sync_authoritative_app_dataset/);
  assert.match(sql,/delete from public\.app_licitaciones/);
  assert.match(sql,/delete from public\.app_pm_config/);
});

test('Sheets usa sincronización incremental cada 5 min y reconciliación completa horaria',()=>{
  const incremental=read('docs/appscript/Delta_Backend_Supabase_PATCH_2026-09-16-INCREMENTAL-SYNC-V4.gs');
  const lockfix=read('docs/appscript/Delta_Backend_Supabase_PATCH_2026-09-16-INCREMENTAL-LOCKFIX-V4B.gs');
  const generator=read('scripts/build-final-appscript.mjs');
  assert.match(incremental,/2026-09-16-INCREMENTAL-OUTBOX-V4/);
  assert.match(incremental,/sincronizarDeltaCambiosPendientes_/);
  assert.match(incremental,/reconciliarDeltaConSupabase_/);
  assert.match(incremental,/everyMinutes\(5\)/);
  assert.match(incremental,/everyHours\(1\)/);
  assert.match(incremental,/deltaMarkDatasetsDirty_/);
  assert.match(lockfix,/deltaTakeDirtySnapshot_/);
  assert.match(lockfix,/deltaMarkDatasetsDirty_\(failed\)/);
  assert.match(generator,/INCREMENTAL-SYNC-V4/);
  assert.match(generator,/INCREMENTAL-LOCKFIX-V4B/);
});

test('ROP02 usa source_dataset exacto y la vista expone procedencia física',()=>{
  const repo=read('src/data/operationalRepository.js');
  const sql=read('supabase/sql/20260916_optimize_rop02_source_reads.sql');
  assert.match(repo,/\.eq\("source_dataset",sourceDataset\)/);
  assert.doesNotMatch(repo,/\.like\("source_key"/);
  assert.match(repo,/source_dataset,source_row/);
  assert.match(sql,/rop02_source_dataset_fecha_source_key_idx/);
  assert.match(sql,/source_dataset,/);
  assert.match(sql,/source_row/);
});

test('Migración de rendimiento elimina polling legacy y duplicados exactos',()=>{
  const sql=read('supabase/sql/20260916_reduce_legacy_polling_and_duplicate_indexes.sql');
  assert.match(sql,/refresh_delta_special_cache/);
  assert.match(sql,/refresh_rop02_canonical_from_appscript/);
  assert.match(sql,/cron\.unschedule/);
  assert.match(sql,/drop index if exists public\.delta_dataset_rows_dataset_source_row_key/);
  assert.match(sql,/drop policy if exists "ROP02 lectura"/);
});
