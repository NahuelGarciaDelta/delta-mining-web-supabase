import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source=fs.readFileSync(new URL("../src/services/abastecimientoSupabase.js",import.meta.url),"utf8");
const sql=fs.readFileSync(new URL("../supabase/sql/20260914_session_security_hardening.sql",import.meta.url),"utf8");
const appScript=fs.readFileSync(new URL("../docs/appscript/Delta_RABA03_Outbox_2026-09-14.gs",import.meta.url),"utf8");

test("RABA03 lee desde Supabase como backend operativo principal",()=>{
  assert.match(source,/rpc_\("abastecimiento_snapshot"/);
  assert.match(source,/raba03Source:"supabase"/);
  assert.doesNotMatch(source,/script\.google\.com|readRaba03FromGoogleSheet_|sheetUrl_/i);
});

test("RABA03 escribe primero en RPC v2 de Supabase con sesión",()=>{
  assert.match(source,/abastecimiento_append_raba03_v2/);
  assert.match(source,/abastecimiento_update_raba03_v2/);
  assert.match(source,/abastecimiento_delete_raba03_solicitud_v2/);
  assert.match(source,/p_auth_token:authToken_\(\)/);
  assert.doesNotMatch(source,/action:"add_raba03_rows_append_only"|save_raba03_cant_enviada|save_raba03_codigos/);
});

test("RABA03 replica a Sheets por outbox sin escritura directa desde frontend",()=>{
  assert.match(sql,/app_sync_outbox/);
  assert.match(appScript,/app_sync_outbox_pull/);
  assert.match(appScript,/app_sync_outbox_ack/);
  assert.match(appScript,/raba03/i);
});

test("RABA03 stale local cache is invalidated after Supabase reads and writes",()=>{
  assert.match(source,/RABA03_LOCAL_CACHE_KEY/);
  assert.match(source,/clearDatasetCache\(RABA03_LOCAL_CACHE_KEY\)/);
});
