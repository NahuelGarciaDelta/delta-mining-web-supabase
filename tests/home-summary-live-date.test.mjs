import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const view=fs.readFileSync("src/modules/home/ViewBienvenidaProjectFilter.jsx","utf8");
const data=fs.readFileSync("src/data/homeRop02Data.js","utf8");
const sql=fs.readFileSync("supabase/sql/20260916_rop02_home_available_days.sql","utf8");
const sources=fs.readFileSync("src/config/viewSources.js","utf8");

test("Bienvenida obtiene los días ROP02 desde Supabase y no desde el caché como fuente principal",()=>{
  assert.match(view,/getHomeRop02AvailableDays/);
  assert.match(view,/const availableDays=Array\.isArray\(remoteDays\)\?remoteDays:localAvailableDays/);
  assert.match(data,/rpc\("rop02_available_days"/);
  assert.match(sql,/from public\.rop02_frontend r/);
  assert.match(sql,/order by r\.fecha desc/);
});

test("el resumen descarga desde Supabase solamente el día seleccionado",()=>{
  assert.match(view,/getHomeRop02DayRows\(effectiveDay,queryProjects\)/);
  assert.match(view,/remoteSummary\?\.key===dayScopeKey/);
  assert.match(data,/refreshHistoricalDataset\("rop02"/);
  assert.match(data,/desde:fecha/);
  assert.match(data,/hasta:fecha/);
  assert.match(data,/limit:"all"/);
});

test("Bienvenida conserva carga liviana y refresca el índice de días",()=>{
  assert.match(sources,/bienvenida:\["lista_equipos"\]/);
  assert.match(view,/HOME_DAYS_REFRESH_MS=5\*60\*1000/);
  assert.match(view,/visibilitychange/);
  assert.match(view,/window\.addEventListener\("online",onOnline\)/);
});
