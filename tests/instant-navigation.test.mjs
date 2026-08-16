import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const app=fs.readFileSync("src/App.jsx","utf8");
const historical=fs.readFileSync("src/data/historicalDataService.js","utf8");
const operational=fs.readFileSync("src/services/operationalSupabase.js","utf8");

test("las vistas pesadas montan sin esperar dataHydrated o arrays no vacíos",()=>{
  for(const label of ["Cargando Distribución de mantenimientos","Cargando Mantenimiento Programado","Cargando Informe de Costos","Cargando Costos Unitarios","Cargando Ranking","Cargando control de horas mensuales"]) assert.doesNotMatch(app,new RegExp(label));
});

test("consultas históricas devuelven cache y revalidan detrás",()=>{
  assert.match(historical,/if\(cached\)[\s\S]*fetchDatasetPage\(dataset,params\)\.catch/);
  assert.match(historical,/return cached/);
});

test("snapshots operativos usan IndexedDB y preload global",()=>{
  assert.match(operational,/readCachedSource/);
  assert.match(operational,/writeCachedSource/);
  assert.match(operational,/preloadOperationalSnapshots/);
  assert.match(app,/preloadOperationalSnapshots\(\)\.catch/);
});
