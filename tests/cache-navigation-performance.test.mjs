import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app=fs.readFileSync(new URL("../src/App.jsx",import.meta.url),"utf8");
const cache=fs.readFileSync(new URL("../src/services/appCache.js",import.meta.url),"utf8");
const route=fs.readFileSync(new URL("../src/modules/abastecimiento/AbastecimientoRoute.jsx",import.meta.url),"utf8");

test("IndexedDB conserva value para hidratar las vistas",()=>{
  assert.match(cache,/value:data/);
});

test("ROP02 y datasets operativos se leen directo de Supabase",()=>{
  for(const key of ["rop02_fs","rop02_jm","rop02_filosur","rop02_zorro","rop05","rma15_fs","rma15_jm","lista_equipos","insumos"]) assert.match(app,new RegExp(`\"${key}\"`));
  assert.match(app,/SUPABASE_OPERATIONAL_KEYS\.has\(key\)/);
  assert.doesNotMatch(app,/await fetchSyncVersions\(APPS_SCRIPT_URL\)/);
});

test("la vista activa no difiere la carga con requestIdleCallback",()=>{
  assert.match(app,/loadSources\(VIEW_SOURCES\[view\]\|\|\[\],\{background:true\}\)\.catch/);
});

test("Abastecimiento no depende de un chunk lazy en la primera apertura",()=>{
  assert.match(route,/import \{ AbastecimientoModule \}/);
  assert.doesNotMatch(route,/React\.lazy|Suspense/);
});
