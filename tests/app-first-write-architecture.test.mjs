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
