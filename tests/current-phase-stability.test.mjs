import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const sql=fs.readFileSync("docs/supabase/phase_current_stability_incremental.sql","utf8");
const repo=fs.readFileSync("src/data/rop02Repository.js","utf8");
const historical=fs.readFileSync("src/data/historicalDataService.js","utf8");
const office=fs.readFileSync("src/modules/oficina-tecnica/OficinaTecnicaModule.jsx","utf8");
const vite=fs.readFileSync("vite.config.js","utf8");
const completeRop02Plugin=fs.readFileSync("scripts/rop02-complete-data-vite-plugin.mjs","utf8");

test("ROP02 operacional excluye vehículos antes de SUM, COUNT y facets",()=>{
  assert.match(sql,/rop02_is_excluded_equipment/);
  assert.match(sql,/view public\.rop02_operational_frontend/);
  assert.match(sql,/from public\.rop02_operational_frontend r/);
  assert.match(repo,/params\.operationalOnly\?OPERATIONAL_TABLE:TABLE/);
});

test("ROP02 principal no usa una página parcial de 250 filas como fuente de verdad",()=>{
  assert.match(vite,/rop02CompleteDataVitePlugin/);
  assert.match(completeRop02Plugin,/const remoteDataset=view==="rop05"\?"rop05":"";/);
  assert.match(completeRop02Plugin,/rop02All=\{effectiveRop02\}/);
  assert.match(completeRop02Plugin,/remoteTotal=\{effectiveRop02\.length\}/);
  assert.match(completeRop02Plugin,/remoteHasMore=\{false\}/);
  assert.match(completeRop02Plugin,/sourceHasData\("rop02_jm"\)/);
});

test("la fecha automática ROP02 avanza con datos nuevos pero respeta fechas históricas elegidas",()=>{
  assert.match(completeRop02Plugin,/_latestSeen/);
  assert.match(completeRop02Plugin,/currentDate===previousLatest&&latestRop02Date>previousLatest/);
  assert.match(completeRop02Plugin,/fecha:shouldAdvance\?latestRop02Date:state\.fecha/);
});

test("las horas de estados no productivos permanecen en cero y los estados no se eliminan",()=>{
  const stateSql=fs.readFileSync("docs/supabase/rop02_state_fix.sql","utf8");
  assert.match(stateSql,/coalesce\(p_hours,0\)>0 then 'TRABAJO'/);
  for(const state of ["OD","FS","EM"])assert.match(stateSql,new RegExp(`then '${state}'`));
  assert.match(sql,/sum\(coalesce\(f\.cantidad_horas,0\)\)/);
});

test("RPC de KPIs y facets ROP02 sigue disponible para consultas resumidas",()=>{
  assert.match(repo,/rpc\("rop02_filtered_stats"/);
  assert.match(repo,/rpc\("rop02_facets"/);
  assert.match(sql,/create or replace function public\.rop02_facets/);
  assert.match(sql,/p_projects is null or proyecto=any\(p_projects\)/);
  assert.match(office,/const localStats=useMemo/);
});

test("exportación ROP02 usa el mismo dataset completo mostrado en pantalla",()=>{
  assert.match(completeRop02Plugin,/onRemoteExport=\{async\(\)=>effectiveRop02\}/);
  assert.match(repo,/while\(offset<total\)/);
});

test("Control ROP02 vs ROP05 y resúmenes RMA15 están implementados en PostgreSQL",()=>{
  assert.match(sql,/function public\.rop02_rop05_control/);
  assert.match(sql,/not exists\(select 1 from r05/);
  assert.match(sql,/function public\.rma15_equipment_universe/);
  assert.match(sql,/function public\.rma15_open_ot_summary/);
  assert.match(historical,/getRma15EquipmentUniverseSupabase/);
  assert.match(historical,/getRma15OpenOtSummarySupabase/);
  assert.doesNotMatch(historical,/getRma15EquipmentUniverse=params=>fetchSpecialAction_/);
});

test("el SQL incremental no modifica registros operativos",()=>{
  assert.doesNotMatch(sql,/\b(insert|update|delete|truncate)\s+(into\s+|from\s+)?public\.(rop02|rop05|rma15)\b/i);
});