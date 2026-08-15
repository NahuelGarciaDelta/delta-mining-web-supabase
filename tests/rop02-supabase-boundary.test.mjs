import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(new URL(path,import.meta.url),"utf8");

test("VIEW_SOURCES restaura las cuatro fuentes ROP02 del flujo original",()=>{
  const source=read("../src/config/viewSources.js");
  for(const key of ["rop02_fs","rop02_jm","rop02_filosur","rop02_zorro"])assert.match(source,new RegExp(key));
  assert.match(source,/vehiculos:\["rop02_fs","rop02_jm","rop02_filosur","rop02_zorro","lista_equipos"\]/);
});

test("las cuatro fuentes ROP02 declaradas se resuelven desde Supabase",()=>{
  const api=read("../src/services/appsScriptApi.js");
  const repo=read("../src/data/operationalRepository.js");
  assert.match(api,/"rop02_fs","rop02_jm","rop02_filosur","rop02_zorro"/);
  assert.match(api,/TYPED_SUPABASE_SOURCES\.has\(source\).*getOperationalSource/s);
  assert.match(repo,/getRop02Source_/);
  assert.match(repo,/\.from\("rop02"\)/);
  assert.match(repo,/\.eq\("source_dataset",sourceDataset\)/);
  assert.match(repo,/\.not\("source_row","is",null\)/);
});

test("las pantallas ROP02 no consultan query_dataset directamente",()=>{
  const screens=[
    "../src/modules/home/ViewBienvenida.jsx",
    "../src/modules/home/ExecutiveDashboard.jsx",
    "../src/modules/equipment/EquipmentProfileView.jsx",
    "../src/modules/oficina-tecnica/OficinaTecnicaModule.jsx",
    "../src/modules/mantenimiento/MantenimientoProgramadoView.jsx",
    "../src/modules/licitaciones/LicitacionesModule.jsx",
    "../src/modules/analytics/OperationalAnalytics.jsx",
    "../src/modules/informe-costos/InformeCostosRoute.jsx",
  ];
  for(const path of screens)assert.doesNotMatch(read(path),/fetchDatasetQuery|query_dataset/i,path);
});

test("Supabase sigue siendo la fuente ROP02 predeterminada del servicio histórico",()=>{
  const service=read("../src/data/historicalDataService.js");
  assert.match(service,/VITE_ROP02_SOURCE\|\|"supabase"/);
  assert.match(service,/dataset==="rop02"&&ROP02_SOURCE!=="legacy"/);
  assert.match(service,/legacy-fallback/);
});
