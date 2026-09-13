import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const read=path=>fs.readFileSync(new URL(path,import.meta.url),"utf8");
const sources=read("../src/config/viewSources.js");

test("Bienvenida conserva consultas compactas y precarga ROP02 global desde Supabase",()=>{
  const view=read("../src/modules/home/ViewBienvenida.jsx");
  assert.match(view,/getRop02LatestByEquipmentProject/);
  assert.match(view,/getRma15OpenOtSummary/);
  assert.match(sources,/bienvenida:\["lista_equipos","rop02_fs","rop02_jm","rop02_filosur","rop02_zorro","rma15_fs","rma15_jm"\]/);
});

test("Dashboard conserva el universo anual y costos RMA15 normalizados del original",()=>{
  const view=read("../src/modules/home/ExecutiveDashboard.jsx");
  assert.match(view,/const rop02All=propRop02All/);
  assert.match(view,/const rma15=propRma15/);
  assert.doesNotMatch(view,/setRemoteRop02|setRemoteRma15|getRop02MonthlySummary/);
  assert.match(view,/const insumoPriceByCode=useMemo/);
  assert.match(view,/const maintCostResolved=r=>/);
  assert.match(view,/normalizeInsumoCode\(item\?\.codigo\)/);
  assert.match(view,/\[current,previous,maintNow,maintPrev,usdRateSafe,insumoPriceByCode\]/);
  const app=read("../src/App.jsx");
  assert.match(app,/\["Cód\. artículo","Cod\. artículo","Cód articulo"/);
  assert.match(sources,/dashboard:\["rop02_fs","rop02_jm","rop02_filosur","rop02_zorro","rop05","rma15_fs","rma15_jm","insumos","lista_equipos"\]/);
});

test("Informe de Costos usa snapshot aislado de las fuentes hidratadas",()=>{
  const route=read("../src/modules/informe-costos/InformeCostosRoute.jsx");
  assert.match(route,/snapshotRef/);
  assert.match(route,/buildReportSnapshot/);
  assert.match(route,/rma15:\s*snapshot\.rma15/);
  assert.match(route,/rop02:\s*snapshot\.rop02/);
  assert.match(route,/equipmentUniverse:\s*null/);
  assert.doesNotMatch(route,/getRma15EquipmentUniverse|getRma15\(|getRop02\(/);
  assert.match(sources,/costosMant:\["insumos","rma15_fs","rma15_jm","lista_equipos"\]/);
});

test("ROP02, ROP05 y RMA15 mantienen controladores paginados sin recortar la infraestructura global",()=>{
  const office=read("../src/modules/oficina-tecnica/OficinaTecnicaModule.jsx");
  const maintenance=read("../src/modules/mantenimiento/MantenimientoRoute.jsx");
  assert.match(office,/createHistoricalPagedController/);
  assert.match(office,/fetchAllDatasetPages\(remoteDataset/);
  assert.match(maintenance,/loadFirst\("rma15",params\)/);
  assert.match(maintenance,/fetchAllDatasetPages\("rma15",params/);
  assert.match(sources,/rop02:\["rop02_fs","rop02_jm","rop02_filosur","rop02_zorro"\]/);
  assert.match(sources,/rop05:\["rop05"\]/);
  assert.match(sources,/mant:\["insumos","rma15_fs","rma15_jm"\]/);
});
