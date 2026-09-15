import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import {abastecimientoWriteReliabilityVitePlugin} from "../scripts/abastecimiento-write-reliability-vite-plugin.mjs";

const source=fs.readFileSync(new URL("../src/modules/abastecimiento/AbastecimientoModule.jsx",import.meta.url),"utf8");
const transformed=abastecimientoWriteReliabilityVitePlugin().transform(source,"/repo/src/modules/abastecimiento/AbastecimientoModule.jsx")?.code||source;

test("Abastecimiento expone eliminación real de solicitud RABA03",()=>{
  assert.match(transformed,/deleteAbastecimientoRaba03Solicitud/);
  assert.match(transformed,/const deleteSolicitudRABA03=useCallback/);
  assert.match(transformed,/await deleteAbastecimientoRaba03Solicitud\(numero\)/);
  assert.match(transformed,/>Eliminar<\/button>/);
  assert.match(transformed,/eliminará todas sus filas de RABA03/);
});
