import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const domain=fs.readFileSync(new URL("../src/shared/domain/index.jsx",import.meta.url),"utf8");

test("el badge de Control ROP02 vs ROP05 ignora registros anteriores a julio 2026",()=>{
  assert.match(domain,/FECHA_CORTE_CONTROL_ROP="2026-07-01"/);
  assert.match(domain,/problemasPost31=faltanEn05\.filter\(r=>r\.fecha>=FECHA_CORTE_CONTROL_ROP\)/);
});
