import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {secureUserAppearanceVitePlugin} from '../scripts/secure-user-appearance-vite-plugin.mjs';

const root=process.cwd();
const read=file=>fs.readFileSync(path.join(root,file),'utf8');

test('authSession exposes the Supabase session context',()=>{
  assert.match(read('src/services/authSession.js'),/export function getAuthContext\(/);
});

test('operational and Taller writes use v2 RPCs with auth token',()=>{
  const op=read('src/services/operationalSupabase.js');
  const taller=read('src/services/tallerMovements.js');
  for(const rpc of ['app_pm_save_v2','app_licitacion_save_v2','app_licitacion_delete_v2','app_stock_replace_v2','app_stock_clear_v2','app_equipment_movement_save_v2','app_equipment_movement_cancel_v2','app_write_action_v2'])assert.match(op,new RegExp(rpc));
  assert.match(taller,/app_taller_movement_save_v2/);
  assert.match(taller,/app_taller_movement_delete_v2/);
});

test('appearance transform removes legacy unprotected write/read calls from built code',()=>{
  const source=read('src/services/userAppearance.js');
  const result=secureUserAppearanceVitePlugin().transform(source,path.join(root,'src/services/userAppearance.js'));
  assert.ok(result?.code);
  assert.match(result.code,/app_get_user_appearance_v2/);
  assert.match(result.code,/app_save_user_appearance_v2/);
  assert.match(result.code,/app_upload_user_background_v2/);
  assert.match(result.code,/p_auth_token:appearanceAuthToken\(\)/);
});
