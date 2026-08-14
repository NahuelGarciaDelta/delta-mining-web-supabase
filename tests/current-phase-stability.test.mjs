import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const sql=fs.readFileSync("docs/supabase/phase_current_stability_incremental.sql","utf8");
const repo=fs.readFileSync("src/data/rop02Repository.js","utf8");
const historical=fs.readFileSync("src/data/historicalDataService.js","utf8");
const office=fs.readFileSync("src/modules/oficina-tecnica/OficinaTecnicaModule.jsx","utf8");

test("ROP02 operacional excluye vehículos antes de SUM, COUNT, facets y paginación",()=>{
  assert.match(sql,/rop02_is_excluded_equipment/);
  assert.match(sql,/view public\.rop02_operational_frontend/);
  assert.match(sql,/from public\.rop02_operational_frontend r/);
  assert.match(repo,/params\.operationalOnly\?OPERATIONAL_TABLE:TABLE/);
  assert.match(office,/operationalOnly:remoteDataset==="rop02"/);
});

test("las horas de estados no productivos permanecen en cero y los estados no se eliminan",()=>{
  const stateSql=fs.readFileSync("docs/supabase/rop02_state_fix.sql","utf8");
  assert.match(stateSql,/coalesce\(p_hours,0\)>0 then 'TRABAJO'/);
  for(const state of ["OD","FS","EM"])assert.match(stateSql,new RegExp(`then '${state}'`));
  assert.match(sql,/sum\(coalesce\(f\.cantidad_horas,0\)\)/);
});

test("KPIs y facets ROP02 provienen de RPC y no de la página visible",()=>{
  assert.match(repo,/rpc\("rop02_filtered_stats"/);
  assert.match(repo,/rpc\("rop02_facets"/);
  assert.match(sql,/create or replace function public\.rop02_facets/);
  assert.match(sql,/p_projects is null or proyecto=any\(p_projects\)/);
  assert.match(office,/remoteFacets\?\.proyecto\|\|opts\.proyecto/);
  assert.match(office,/remoteStats\?\.registros\?\?remoteTotal/);
});

test("exportación ROP02 recupera todas las páginas del universo operacional",()=>{
  assert.match(office,/fetchAllDatasetPages\(remoteDataset,\{\.\.\.remoteParams,operationalOnly:remoteDataset==="rop02"\}/);
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
