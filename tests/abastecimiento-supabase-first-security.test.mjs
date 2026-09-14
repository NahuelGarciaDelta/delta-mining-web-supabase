import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(process.cwd());
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');

test('Abastecimiento no depende de Apps Script desde el frontend',()=>{
  const src=read('src/services/abastecimientoSupabase.js');
  assert.doesNotMatch(src,/script\.google\.com/i);
  assert.doesNotMatch(src,/VITE_RABA03_APPS_SCRIPT_URL/i);
  assert.doesNotMatch(src,/fetch\s*\(/);
  assert.match(src,/abastecimiento_snapshot/);
  assert.match(src,/raba03Source:\"supabase\"/);
});

test('mutaciones de Abastecimiento usan RPC v2 con sesión',()=>{
  const src=read('src/services/abastecimientoSupabase.js');
  for(const rpc of [
    'abastecimiento_append_raba03_v2',
    'abastecimiento_update_raba03_v2',
    'abastecimiento_delete_raba03_solicitud_v2',
    'abastecimiento_save_remito_v2',
    'abastecimiento_delete_remito_v2',
    'abastecimiento_set_estado_v2'
  ]) assert.match(src,new RegExp(rpc));
  assert.match(src,/p_auth_token:authToken_\(\)/);
});

test('migración v2 persiste sesiones y protege wrappers',()=>{
  const sql=read('supabase/sql/20260914_secure_app_sessions_and_abastecimiento_v2.sql');
  assert.match(sql,/create table if not exists public\.app_user_sessions/i);
  assert.match(sql,/extensions\.digest\(p_auth_token,'sha256'\)/i);
  assert.match(sql,/perform public\.app_require_session_\(p_auth_token\)/i);
  assert.match(sql,/revoke all on table public\.app_user_sessions from public, anon, authenticated/i);
});
