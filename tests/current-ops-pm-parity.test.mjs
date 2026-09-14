import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {
  TRUCK_PM_INTERVAL_HOURS,
  getNextTruckPmHour,
  hasInconsistentPmReadings,
  isCanonicalTruckFamily,
  positiveOr,
  selectMaintenanceCounter,
} from "../src/modules/mantenimiento/pmRules.js";

const read=path=>fs.readFileSync(new URL(`../${path}`,import.meta.url),"utf8");

test("reglas PM actuales de OPS para camiones",()=>{
  for(const value of ["CAMION","CAMIÓN REGADOR","Camion Volcador","CAMION COMBUSTIBLE","CAMION TRACTOR"]){
    assert.equal(isCanonicalTruckFamily(value),true,value);
  }
  for(const value of ["CAMIONETA","CAMIONETA CON MOCHILA","CTA"]){
    assert.equal(isCanonicalTruckFamily(value),false,value);
  }
  assert.equal(TRUCK_PM_INTERVAL_HOURS,500);
  assert.equal(selectMaintenanceCounter({horometerCandidates:[1380,1375],mileageCandidates:[125000,126500]},{isTruck:true}),1380);
  assert.equal(getNextTruckPmHour(1380,1000),1500);
  assert.equal(getNextTruckPmHour(1500,1500),2000);
  assert.equal(getNextTruckPmHour(680,1380),1500);
  assert.equal(positiveOr(-200,250),250);
  assert.equal(hasInconsistentPmReadings(680,1380),true);
});

test("Vite aplica paridad PM actual antes de los plugins compartidos",()=>{
  const vite=read("vite.config.js");
  const sourceParity=read("scripts/current-ops-pm-source-parity-vite-plugin.mjs");
  assert.match(vite,/currentOpsPmSourceParityVitePlugin\(\).*vehicleKmMaintenanceVitePlugin\(\)/s);
  assert.match(sourceParity,/TRUCK_PM_INTERVAL_HOURS/);
  assert.match(sourceParity,/truckInternos/);
  assert.match(sourceParity,/REVISAR DATOS/);
  assert.match(sourceParity,/categoriaPorInterno/);
  assert.match(sourceParity,/usoCategoriaFiltro/);
  assert.match(sourceParity,/pmInfo\.currentH/);
});

test("filtros globales no se inyectan en gráficos",()=>{
  const filters=read("src/services/globalTableColumnFilters.js");
  assert.match(filters,/recharts-wrapper/);
  assert.match(filters,/recharts-responsive-container/);
});
