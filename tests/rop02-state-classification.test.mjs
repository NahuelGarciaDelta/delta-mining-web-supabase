import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {classifyRop02State} from "../src/shared/rop02State.js";

const classify=(hours,description,originalState="")=>classifyRop02State({hours,description,originalState});

test("horas positivas tienen prioridad TRABAJO",()=>assert.equal(classify(9,"Equipo fuera de servicio"),"TRABAJO"));
test("cero horas clasifica FS",()=>{
  assert.equal(classify(0,"Equipo fuera de servicio"),"FS");
  assert.equal(classify(0,"FS"),"FS");
});
test("cero horas clasifica OD",()=>{
  assert.equal(classify(0,"OD"),"OD");
  assert.equal(classify(0,"A disposición"),"OD");
  assert.equal(classify(0,"A disposicion"),"OD");
});
test("cero horas clasifica EM",()=>{
  assert.equal(classify(0,"EM"),"EM");
  assert.equal(classify(0,"En mantenimiento"),"EM");
  assert.equal(classify(0,"Mantenimiento"),"EM");
});
test("EXC-0034 del 13/08/2026 no es TRABAJO",()=>{
  const state=classify(0,"Equipo fuera de servicio");
  assert.equal(state,"FS");assert.notEqual(state,"TRABAJO");
});
test("vista y RPCs SQL consumen la clasificación común",()=>{
  const sql=fs.readFileSync(new URL("../docs/supabase/rop02_state_fix.sql",import.meta.url),"utf8");
  assert.match(sql,/rop02_classify_state\(r\.cantidad_horas,r\.descripcion_trabajos,r\.observaciones\) estado/);
  assert.match(sql,/from public\.rop02_frontend r/);
  assert.match(sql,/returns setof public\.rop02_frontend/);
  assert.match(sql,/A DISPOSICION/);
});
