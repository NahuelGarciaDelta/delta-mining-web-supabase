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
  assert.match(repo,/ROP02_FRONTEND_TABLE="rop02_frontend"/);
  assert.match(repo,/\.from\(ROP02_FRONTEND_TABLE\)/);
  assert.match(repo,/\.like\("source_key",`\$\{sourceKeyPrefix\}%`\)/);
  assert.match(repo,/snapshot incompleto/);
  assert.match(repo,/complete:true/);
  assert.doesNotMatch(repo,/getRop02Source_[\s\S]*?\.from\("rop02"\)/);
});

test("Dashboard no rehidrata una instantánea ROP02 parcial",()=>{
  const app=read("../src/App.jsx");
  assert.match(app,/key\.startsWith\("rop02_"\).*meta\?\.complete===true/s);
  assert.match(app,/serie histórica parcial persistida/);
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

test("el servicio histórico ROP02 es exclusivamente Supabase",()=>{
  const service=read("../src/data/historicalDataService.js");
  assert.match(service,/getRop02Page/);
  assert.match(service,/getSupabaseOperationalSnapshot/);
  assert.doesNotMatch(service,/legacy-fallback|APPS_SCRIPT_URL|query_dataset/);
});

test("Ficha Única conserva el historial ROP02 ya normalizado por aliases",()=>{
  const profile=read("../src/modules/equipment/EquipmentProfileView.jsx");
  assert.match(profile,/const rop02All=propRop02All/);
  assert.doesNotMatch(profile,/fetchAllDatasetPages\("rop02"/);
});
