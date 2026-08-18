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
