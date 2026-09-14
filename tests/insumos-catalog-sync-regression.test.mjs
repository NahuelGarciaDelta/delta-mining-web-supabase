import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const script=fs.readFileSync(new URL("../docs/appscript/Delta_Backend_Supabase_FINAL_2026-09-09-POST-AUDIT.gs",import.meta.url),"utf8");

test("la sincronización de insumos preserva el código del encabezado vigente",()=>{
  const typedCatalog=script.match(/return Object\.assign\(base,\{codigo:String\(deltaPick_\(r,\[([^\]]+)\]\)/);
  assert.ok(typedCatalog,"debe existir el mapeo tipado del catálogo de insumos");
  assert.match(typedCatalog[1],/"Cód\. artículo"/);
  assert.match(typedCatalog[1],/"Cod\. artículo"/);
  assert.match(script,/sheet: "Hoja 1"/);
  assert.match(script,/label: "Informe de insumos comprados — Hoja 1"/);
  assert.match(script,/function deltaMoney_\(value\)/);
  assert.match(script,/precio_unitario:String\(deltaMoney_\(deltaPick_\(r,\["Precio unitario con IVA","PRECIO UNITARIO CON IVA","precio unitario con IVA","Precio unitario","Costo unitario"\]\)\)\)/);
  assert.match(script,/var dd=s\.length-dot-1;s=dd>0&&dd<=2/);
});
