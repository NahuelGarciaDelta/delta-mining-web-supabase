import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { abastecimientoWriteReliabilityVitePlugin } from "../scripts/abastecimiento-write-reliability-vite-plugin.mjs";

const source=fs.readFileSync(new URL("../src/modules/abastecimiento/AbastecimientoModule.jsx",import.meta.url),"utf8");
const plugin=abastecimientoWriteReliabilityVitePlugin();
const transformed=plugin.transform(source,"/repo/src/modules/abastecimiento/AbastecimientoModule.jsx")?.code||source;

test("el remito no desaparece de la UI antes de que Supabase confirme el borrado",()=>{
  const start=transformed.indexOf("const deleteRemito=async(id)=>");
  const end=transformed.indexOf("const badgeStyle",start);
  const block=transformed.slice(start,end);
  assert.ok(start>=0&&end>start);
  assert.match(block,/await deleteAbastecimientoRemito\(id\)/);
  assert.doesNotMatch(block,/setRemitos\(prev=>prev\.filter/);
  assert.match(block,/await loadRemitosCompartidos\(\{silent:true\}\)\.catch/);
  assert.match(block,/No se pudo eliminar el remito\. No se ocultó localmente/);
});

test("Guardar datos sólo envía filas cuyo resultado FIFO cambió",()=>{
  assert.match(transformed,/cantidadEnviadaFuente:/);
  assert.match(transformed,/numeroRemitoFuente:/);
  assert.match(transformed,/fechaSalidaFuente:/);
  assert.match(transformed,/cantidadRemitoFuente:/);
  assert.match(transformed,/\.filter\(r=>r\._changed\)/);
  assert.match(transformed,/RABA03 ya está actualizado\. No hay cambios para guardar/);
});

test("assignedRows queda declarado después del motor de asignación",()=>{
  const allocation=transformed.indexOf("const abastecimientoAllocation=useMemo");
  const assigned=transformed.indexOf("const assignedRows=useMemo");
  assert.ok(allocation>=0,"falta abastecimientoAllocation");
  assert.ok(assigned>allocation,"assignedRows debe declararse después de abastecimientoAllocation");
});
