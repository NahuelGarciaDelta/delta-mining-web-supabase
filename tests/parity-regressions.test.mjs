import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { equipmentProfileCodeHistoryVitePlugin } from "../scripts/equipment-profile-code-history-vite-plugin.mjs";

const read=path=>fs.readFileSync(path,"utf8");

test("Bienvenida replica el filtro actual de OPS y preserva el histórico del Dashboard",()=>{
  const source=read("src/modules/home/ViewBienvenidaProjectFilter.jsx");
  const bienvenida=read("src/modules/home/ViewBienvenida.jsx");
  assert.match(source,/window\.__dmHomeSummaryExternalFilter=true/);
  assert.match(source,/window\.__dmHomeSummaryProject="TODOS"/);
  assert.match(source,/selectedSet\.has\(projectFromRow\(row\)\)/);
  assert.match(source,/const dailySummaryRop02=effectiveDay\?projectFilteredRop02\.filter/);
  assert.match(source,/if\(dashboardVisible\)/);
  assert.match(source,/rop02All:Array\.isArray\(props\.rop02All\)\?props\.rop02All:\[\]/);
  assert.match(source,/rop05:Array\.isArray\(props\.rop05\)\?props\.rop05:\[\]/);
  assert.match(source,/rma15:Array\.isArray\(props\.rma15\)\?props\.rma15:\[\]/);
  assert.match(source,/summaryDayFiltered:false/);
  assert.match(source,/rop02All:dailySummaryRop02/);
  assert.match(source,/rop05:filterRows\(props\.rop05\)/);
  assert.match(bienvenida,/summaryDayFiltered&&Array\.isArray\(summaryRop02\)/);
  assert.match(bienvenida,/<ExecutiveDashboard rop02All=\{rop02All\}/);
  assert.doesNotMatch(bienvenida,/<ExecutiveDashboard rop02All=\{(?:summaryRop02|effectiveRop02)\}/);
});

test("Control por Equipo mantiene los saltos pendientes definidos y consistentes",()=>{
  const source=read("src/modules/oficina-tecnica/OficinaTecnicaModule.jsx");
  assert.match(source,/const saltosPendientes=saltosFiltrados\.filter\(r=>!r\.admitido\);/);
  assert.match(source,/Saltos de carga por equipo \(\$\{saltosPendientes\.length\}\)/);
  assert.match(source,/rows=\{saltosPendientes\}/);
});

test("la migración de estados devuelve filas eliminadas tras la sincronización autoritativa",()=>{
  const sql=read("supabase/sql/20260908_abastecimiento_estados_authoritative_return.sql");
  assert.match(sql,/delete from public\.abastecimiento_solicitud_estados e/i);
  assert.match(sql,/get diagnostics v_deleted=row_count/i);
  assert.match(sql,/'deleted',v_deleted/i);
});

test("el transformador de perfil de equipo declara selectedProject antes de usarlo",()=>{
  const source=read("src/modules/equipment/EquipmentProfileView.jsx");
  const result=equipmentProfileCodeHistoryVitePlugin().transform(source,"/src/modules/equipment/EquipmentProfileView.jsx");

  assert.ok(result?.code);
  assert.match(result.code,/const \[selectedProject,setSelectedProject\]=useState\(""\)/);
});

test("Control de horas conserva el control diario con filtros y exportación",()=>{
  const index=read("src/modules/analytics/index.js");
  const source=read("src/modules/analytics/ViewCambiosTurnoEnhanced.jsx");

  assert.match(index,/ViewCambiosTurnoEnhanced/);
  assert.match(source,/Control diario de Hi y N°/);
  assert.match(source,/const \[dailyProyecto,setDailyProyecto\]/);
  assert.match(source,/const exportControlDiario=/);
  assert.match(source,/N° parte a cargar/);
});

test("MultiSel conserva selecciones hasta cerrar su menú y App navega fechas únicas",()=>{
  const ui=read("src/components/ui/index.jsx");
  const app=read("src/App.jsx");

  assert.match(ui,/commitOnClose=true/);
  assert.match(ui,/data-multisel-menu="true"/);
  assert.match(ui,/e\.target\?\.closest\?\.\('\[data-multisel-menu="true"\]'\)/);
  assert.match(app,/const onDateArrow=\(event\)=>/);
  assert.match(app,/if\(inputs\.length!==1\)return/);
  assert.doesNotMatch(app,/const globalPreloadRef=/);
});

test("login reintenta fallas transitorias sin reemplazar el adaptador de autenticación",()=>{
  const login=read("src/modules/auth/Login.jsx");

  assert.match(login,/const AUTH_TIMEOUT_MS=25000/);
  assert.match(login,/const AUTH_MAX_ATTEMPTS=2/);
  assert.match(login,/for\(let intento=1;intento<=AUTH_MAX_ATTEMPTS;intento\+\+\)/);
  assert.match(login,/authenticateUser\(APPS_SCRIPT_URL,mail,pass\)/);
});
