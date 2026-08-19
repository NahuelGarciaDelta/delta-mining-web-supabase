import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'delta-original-'));
const sourceRepo='https://github.com/NahuelGarciaDelta/delta-mining-ops.git';
const run=(cmd,args,cwd=root)=>execFileSync(cmd,args,{cwd,stdio:'inherit'});
const write=(p,s)=>{const full=path.join(root,p);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,s);};
const source=p=>fs.readFileSync(path.join(tmp,p),'utf8');
const copy=p=>write(p,source(p));

run('git',['clone','--depth=1',sourceRepo,tmp]);
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:tmp,encoding:'utf8'}).trim();

// SOLO archivos visuales/dominio que deben ser idénticos.
// Nunca se copian App.jsx, vite.config.js ni servicios de transporte/persistencia,
// porque la versión Supabase debe conservar su backend propio.
[
  'src/components/CalendarPeriodMonthYear.jsx',
  'src/hooks/useProgressiveRows.js',
  'src/modules/equipment/EquipmentProfileWithLastRop02.jsx',
  'src/modules/equipment/equipmentCode.js',
  'src/modules/equipment/equipmentMovementHistory.js',
  'src/modules/equipment/index.js',
  'src/modules/home/ViewBienvenidaProjectFilter.jsx',
  'src/modules/home/homeAvailability.js',
  'src/modules/home/index.js',
  'src/modules/informe-costos/InformeCostosRoute.jsx',
  'src/modules/informe-costos/InformeCostosView.jsx',
  'src/modules/mantenimiento/MantenimientoProgramadoView.jsx',
  'src/modules/oficina-tecnica/OficinaTecnicaRoute.jsx',
  'src/services/appCache.js',
  'src/services/dataRefreshPolicy.js',
  'src/services/equipmentMovementsDomain.js',
  'src/shared/projects.js',
  'tests/equipmentCode.test.mjs',
  'tests/projects.test.mjs',
  'scripts/atraso-ichc-fixes-vite-plugin.mjs',
  'scripts/intelligent-refresh-vite-plugin.mjs',
  'scripts/vehicle-km-maintenance-vite-plugin.mjs',
  'scripts/pm-vehicle-scope-vite-plugin.mjs'
].forEach(copy);

// Capas protegidas Supabase: deben existir y no se modifican por este script.
[
  'src/services/supabaseClient.js',
  'src/services/operationalSupabase.js',
  'src/services/supabaseReadBridge.js',
  'src/services/tallerMovements.js',
  'src/services/equipmentMovements.js',
  'src/data/historicalDataService.js',
  'src/main.jsx',
  'src/App.jsx',
  'vite.config.js'
].forEach(file=>{
  if(!fs.existsSync(path.join(root,file)))throw new Error(`Falta capa protegida Supabase: ${file}`);
});

fs.mkdirSync(path.join(root,'docs'),{recursive:true});
write('docs/original-parity.json',JSON.stringify({
  sourceRepository:'NahuelGarciaDelta/delta-mining-ops',
  sourceCommit,
  syncedAt:new Date().toISOString(),
  policy:'UI, filtros, pestañas, navegación, cálculos, permisos, vistas y lógica de dominio desde original; transporte, lectura, escritura, autenticación y persistencia remota permanecen Supabase-first.',
  status:'ported-pending-validation',
  notes:'El port automático solo copia archivos seguros. Las capas Supabase y vite.config.js están protegidas para impedir regresiones a Apps Script.'
},null,2)+'\n');

console.log(`Archivos seguros portados desde delta-mining-ops@${sourceCommit}. Ejecutá npm run verify:all antes de publicar.`);
