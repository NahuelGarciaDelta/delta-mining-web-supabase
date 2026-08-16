import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const repository=fs.readFileSync("src/data/operationalRepository.js","utf8");
const service=fs.readFileSync("src/data/historicalDataService.js","utf8");
const app=fs.readFileSync("src/App.jsx","utf8");
const office=fs.readFileSync("src/modules/oficina-tecnica/OficinaTecnicaModule.jsx","utf8");
const maintenance=fs.readFileSync("src/modules/mantenimiento/MantenimientoRoute.jsx","utf8");

test("ROP05 y RMA15 usan exclusivamente Supabase",()=>{
  assert.match(service,/dataset==="rop05"\?getRop05Page:dataset==="rma15"\?getRma15Page/);
  assert.doesNotMatch(service,/legacy-fallback|APPS_SCRIPT_URL/);
  assert.match(service,/fetchAllOperationalPages/);
});

test("Lista, Insumos y fuentes RMA15 compartidas se cargan desde el repositorio tipado",()=>{
  assert.match(app,/getOperationalSource\(key\)/);
  assert.match(app,/"rma15_fs","rma15_jm","lista_equipos","insumos"/);
  assert.match(repository,/raw_data/);
});

test("el universo completo alimenta KPIs y exportaciones, no sólo la página visual",()=>{
  assert.match(office,/remoteDataset==="rop05"\?"all":250/);
  assert.match(maintenance,/limit:"all"/);
  assert.match(repository,/if\(params\.limit!=="all"\)return getter\(params\)/);
  assert.match(repository,/fetchAllOperationalPages/);
});

test("las facets locales excluyen su propia dimensión y conservan multiselección",()=>{
  assert.match(office,/other\.key!==f\.key/);
  assert.match(office,/otherActives\.every/);
  assert.match(office,/keys\.filter\(o=>o!==k&&!multiIsAll\(vals\[o\]\)\)/);
  assert.doesNotMatch(office,/keys\.slice\(0,idx\)/);
});

test("Vehiculos conserva proyecto historico y usa Cant. Hs. como kilometraje",()=>{
  assert.match(office,/proyecto:r\.proyecto,ubicacion:r\.ubicacion\|\|r\.proyecto/);
  assert.doesNotMatch(office,/proyecto:hit\.proyecto\|\|r\.proyecto/);
  assert.match(office,/key:"horas",label:"Km"/);
  assert.doesNotMatch(office,/horometroFinal\s*-\s*.*horometroInicial/);
});

test("RMA15 no aplica corte arbitrario de junio",()=>{
  assert.doesNotMatch(repository,/2026-06|junio/i);
  assert.doesNotMatch(maintenance,/2026-06|junio/i);
});
