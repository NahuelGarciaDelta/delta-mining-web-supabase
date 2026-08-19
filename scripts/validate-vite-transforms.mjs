import fs from 'node:fs';
import path from 'node:path';
import {ESLint} from 'eslint';
import {tallerCentralNavigationVitePlugin} from './taller-central-navigation-vite-plugin.mjs';
import {atrasoIchcFixesVitePlugin} from './atraso-ichc-fixes-vite-plugin.mjs';
import {intelligentRefreshVitePlugin} from './intelligent-refresh-vite-plugin.mjs';
import {vehicleKmMaintenanceVitePlugin} from './vehicle-km-maintenance-vite-plugin.mjs';
import {pmVehicleScopeVitePlugin} from './pm-vehicle-scope-vite-plugin.mjs';
import {pmVehicleDisplayVitePlugin} from './pm-vehicle-display-vite-plugin.mjs';
import {equipmentProfileCodeHistoryVitePlugin} from './equipment-profile-code-history-vite-plugin.mjs';
import {equipmentProfileAliasProjectMultiselectVitePlugin} from './equipment-profile-alias-project-multiselect-vite-plugin.mjs';
import {equipmentProfileDeduplicateLastRop02VitePlugin} from './equipment-profile-deduplicate-last-rop02-vite-plugin.mjs';
import {equipmentProfileLocationVehicleLabelVitePlugin} from './equipment-profile-location-vehicle-label-vite-plugin.mjs';
import {equipmentProfileVehicleArrowsVitePlugin} from './equipment-profile-vehicle-arrows-vite-plugin.mjs';
import {equipmentProfileLayoutVitePlugin} from './equipment-profile-layout-vite-plugin.mjs';

const root=process.cwd();
const plugins=[
  intelligentRefreshVitePlugin(),
  vehicleKmMaintenanceVitePlugin(),
  pmVehicleScopeVitePlugin(),
  pmVehicleDisplayVitePlugin(),
  equipmentProfileCodeHistoryVitePlugin(),
  equipmentProfileAliasProjectMultiselectVitePlugin(),
  equipmentProfileDeduplicateLastRop02VitePlugin(),
  equipmentProfileLocationVehicleLabelVitePlugin(),
  equipmentProfileVehicleArrowsVitePlugin(),
  equipmentProfileLayoutVitePlugin(),
  tallerCentralNavigationVitePlugin(),
  atrasoIchcFixesVitePlugin(),
];

function filesUnder(dir){
  const out=[];
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())out.push(...filesUnder(full));
    else if(/\.(js|jsx)$/.test(entry.name))out.push(full);
  }
  return out;
}

const eslint=new ESLint({cwd:root});
let failed=false;
for(const file of filesUnder(path.join(root,'src'))){
  const original=fs.readFileSync(file,'utf8');
  let code=original;
  const id=file.replace(/\\/g,'/');
  for(const plugin of plugins){
    if(typeof plugin.transform!=='function')continue;
    const result=await plugin.transform(code,id);
    if(result?.code)code=result.code;
  }
  if(code===original)continue;
  const [result]=await eslint.lintText(code,{filePath:file});
  const errors=(result?.messages||[]).filter(message=>message.severity===2);
  if(errors.length){
    failed=true;
    console.error(`Transform inválido: ${path.relative(root,file)}`);
    for(const error of errors)console.error(`  ${error.line}:${error.column} ${error.ruleId||'error'} ${error.message}`);
  }
}
if(failed)process.exit(1);
console.log('Transforms Vite: sintaxis/variables OK');