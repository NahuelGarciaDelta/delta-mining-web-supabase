import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const sql=fs.readFileSync("docs/supabase/typed_operational_datasets.sql","utf8");
const gas=fs.readFileSync("AppsScript_Delta_Mining_OPS_ROP02_OK.txt","utf8");

test("la Fase 2 crea tablas tipadas sin modificar ROP02",()=>{
  for(const table of ["rop05","rma15","rma15_insumos","lista_equipos","insumos"])
    assert.match(sql,new RegExp(`create table if not exists public\\.${table}\\b`));
  assert.doesNotMatch(sql,/create table if not exists public\.rop02\b/i);
  assert.match(sql,/unique \(source_dataset, source_row\)/g);
});

test("la reconciliación tipada actualiza e identifica filas eliminadas o vaciadas",()=>{
  assert.match(sql,/on conflict\(source_dataset,source_row\) do update/g);
  for(const table of ["rop05","rma15","lista_equipos","insumos"])
    assert.match(sql,new RegExp(`delete from ${table} r where r\\.source_dataset=p_dataset`));
  assert.match(gas,/values\.filter\(typedRowHasData_\)/);
});

test("Apps Script sincroniza sólo los cuatro dominios solicitados y conserva RMA15 unificado",()=>{
  assert.match(gas,/\["rop05", "rma15_fs", "rma15_jm", "lista_equipos", "insumos"\]/);
  assert.match(gas,/function syncRma15ToSupabase/);
  assert.match(gas,/for \(var slot = 1; slot <= 10; slot\+\+\)/);
  assert.match(gas,/DELTA_SUPABASE_SERVICE_ROLE_KEY/);
  assert.match(gas,/DELTA_TYPED_WRITES_ENABLED/);
});

test("facetas aceptan arrays y excluyen su propia dimensión",()=>{
  assert.match(sql,/function public\.rop05_facets[\s\S]*p_proyectos text\[\]/);
  assert.match(sql,/function public\.rma15_facets[\s\S]*p_operativos boolean\[\]/);
  const projectsFacet=sql.match(/'proyectos',[\s\S]*?\)s\),/)[0];
  assert.doesNotMatch(projectsFacet,/p_proyectos is null/);
});

test("las lecturas tipadas se conectan tras la equivalencia live",()=>{
  const repository=fs.readFileSync("src/data/operationalRepository.js","utf8");
  assert.match(repository,/from\(tableName\)/);
  assert.match(repository,/rma15_frontend/);
  assert.match(repository,/lista_equipos/);
  assert.match(repository,/insumos/);
});
