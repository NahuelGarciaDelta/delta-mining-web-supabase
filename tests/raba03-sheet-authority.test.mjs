import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const source=fs.readFileSync(new URL("../src/services/abastecimientoSupabase.js",import.meta.url),"utf8");

test("RABA03, remitos y estados se leen en un único snapshot de Supabase",()=>{
  assert.match(source,/rpc\("abastecimiento_snapshot",\{\}\)/);
  assert.doesNotMatch(source,/script\.google\.com|readRaba03FromGoogleSheet_|sheetUrl_/);
});

test("RABA03 escribe en Supabase y deja la réplica legacy a la outbox",()=>{
  assert.match(source,/rpc\("abastecimiento_append_raba03"/);
  assert.match(source,/rpc\("abastecimiento_update_raba03"/);
  assert.match(source,/rpc\("abastecimiento_delete_raba03_solicitud"/);
  assert.doesNotMatch(source,/fetch\(|save_raba03_cant_enviada|save_raba03_codigos/);
});

test("el snapshot conserva cache corta y cada escritura lo invalida",()=>{
  assert.match(source,/SNAPSHOT_TTL_MS=5000/);
  assert.match(source,/snapshotPromise&&!force/);
  assert.ok((source.match(/invalidateAbastecimientoSnapshot\(\)/g)||[]).length>=6);
});
