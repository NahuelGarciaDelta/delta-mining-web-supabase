import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(new URL(path,import.meta.url),"utf8");

test("VIEW_SOURCES no declara fuentes RAW ROP02",()=>{
  const source=read("../src/config/viewSources.js");
  assert.doesNotMatch(source,/rop02_(?:fs|jm|filosur|zorro)/i);
});

test("las pantallas ROP02 no llaman Apps Script ni query_dataset",()=>{
  const screens=[
    "../src/App.jsx",
    "../src/modules/home/ViewBienvenida.jsx",
    "../src/modules/home/ExecutiveDashboard.jsx",
    "../src/modules/equipment/EquipmentProfileView.jsx",
    "../src/modules/oficina-tecnica/OficinaTecnicaModule.jsx",
    "../src/modules/mantenimiento/MantenimientoProgramadoView.jsx",
    "../src/modules/licitaciones/LicitacionesModule.jsx",
    "../src/modules/analytics/OperationalAnalytics.jsx",
    "../src/modules/informe-costos/InformeCostosRoute.jsx",
  ];
  for(const path of screens){
    const source=read(path);
    assert.doesNotMatch(source,/fetchDatasetQuery|query_dataset|get_rop02_(?:latest|monthly|data)/i,path);
  }
});

test("Supabase es la fuente ROP02 predeterminada y el fallback está centralizado",()=>{
  const service=read("../src/data/historicalDataService.js");
  assert.match(service,/VITE_ROP02_SOURCE\|\|"supabase"/);
  assert.match(service,/dataset==="rop02"&&ROP02_SOURCE!=="legacy"/);
  assert.match(service,/legacy-fallback/);
});
