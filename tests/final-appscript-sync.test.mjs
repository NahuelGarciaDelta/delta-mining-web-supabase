import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const path="docs/appscript/Delta_Backend_Supabase_FINAL_2026-09-08.gs";
const source=fs.readFileSync(path,"utf8");
const functions=name=>(source.match(new RegExp(`function ${name}\\s*\\(`,"g"))||[]).length;

test("el backend final conserva un solo router y es sintácticamente válido",()=>{
  assert.equal(functions("doGet"),1);
  assert.equal(functions("doPost"),1);
  assert.equal((source.match(/var DELTA_BACKEND_VERSION_/g)||[]).length,1);
  assert.doesNotThrow(()=>new vm.Script(source,{filename:path}));
});

test("la sincronización final usa propiedades privadas, lotes ROP02 y cola con ack",()=>{
  for(const name of ["syncAllConfiguredDatasetsToSupabase","sincronizarDeltaConSupabaseCada5Min","syncSupabaseOutboxToSheets","INSTALAR_DELTA_SUPABASE","estadoSincronizacionSupabase"])
    assert.equal(functions(name),1,`falta ${name}`);
  assert.match(source,/DELTA_SUPABASE_URL/);
  assert.match(source,/DELTA_SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(source,/begin_rop02_sheet_sync/);
  assert.match(source,/stage_rop02_sheet_rows/);
  assert.match(source,/finalize_rop02_sheet_sync/);
  assert.match(source,/app_sync_outbox_ack/);
  assert.doesNotMatch(source,/SUPABASE_SERVICE_ROLE_KEY\s*=\s*["'][^"']+/);
});
