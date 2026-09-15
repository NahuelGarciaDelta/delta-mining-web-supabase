import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import {equipmentProfileLocationVehicleLabelVitePlugin} from "../scripts/equipment-profile-location-vehicle-label-vite-plugin.mjs";
import {equipmentProfileCodeHistoryVitePlugin} from "../scripts/equipment-profile-code-history-vite-plugin.mjs";
import {equipmentProfileAliasProjectMultiselectVitePlugin} from "../scripts/equipment-profile-alias-project-multiselect-vite-plugin.mjs";
import {equipmentProfileDeduplicateLastRop02VitePlugin} from "../scripts/equipment-profile-deduplicate-last-rop02-vite-plugin.mjs";

const source=fs.readFileSync(new URL("../src/modules/equipment/EquipmentProfileView.jsx",import.meta.url),"utf8");
const id="/src/modules/equipment/EquipmentProfileView.jsx";
const transformed=()=>[
  equipmentProfileCodeHistoryVitePlugin(),
  equipmentProfileAliasProjectMultiselectVitePlugin(),
  equipmentProfileDeduplicateLastRop02VitePlugin(),
  equipmentProfileLocationVehicleLabelVitePlugin(),
].reduce((code,plugin)=>plugin.transform(code,id)?.code||code,source);

test("el transform final activa patente por Familia o Tipo y contempla encabezados alternativos",()=>{
  const code=transformed();
  assert.match(code,/familyNorm\.includes\("CAMIONETA"\)\|\|familyNorm\.includes\("CAMION"\)/);
  for(const header of ["Patente","Dominio","Código de Drusila","Codigo Drusila"])assert.match(code,new RegExp(header));
  assert.match(code,/\^\[A-Z\]\{2\}\[0-9\]\{3\}\[A-Z\]\{2\}\$/);
  assert.match(code,/\^\[A-Z\]\{3\}\[0-9\]\{3\}\$/);
});

test("selector y cabecera muestran INTERNO (PATENTE) sólo cuando corresponde",()=>{
  const code=transformed();
  assert.match(code,/vehiclePatent&&canonicalEquipmentCode\(vehiclePatent\)!==canonicalEquipmentCode\(detailCode\)/);
  assert.match(code,/displayPreferred=patente&&canonicalEquipmentCode\(patente\)!==canonicalEquipmentCode\(preferred\)/);
  assert.doesNotMatch(code,/\$\{detailCode\} \(\$\{vehiclePatent\}\).*:\s*`?\$\{detailCode\} \(\)`?/);
  assert.match(code,/\{displayDetailCode\|\|"Seleccioná un equipo"\}/);
});

test("último proyecto y lugar actual permanecen separados de los filtros visuales",()=>{
  const code=transformed();
  assert.match(code,/const lastProject=String\(summary\.lastOp\?\.proyecto/);
  assert.match(code,/const currentRentalPlace=String\(pick\(master\|\|\{\},\["Lugar de alquiler"/);
  assert.match(code,/Último proyecto:/);
  assert.match(code,/Lugar actual:/);
});

test("el transform falla completo si el componente pierde sus anclas",()=>{
  assert.throws(()=>equipmentProfileLocationVehicleLabelVitePlugin().transform("function sourceCode(row){}",id),/Transform de patente\/ubicación incompleto/);
});
