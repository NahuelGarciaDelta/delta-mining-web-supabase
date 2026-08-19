import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'delta-parity-audit-'));
const sourceRepo='https://github.com/NahuelGarciaDelta/delta-mining-ops.git';
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const source=p=>fs.readFileSync(path.join(tmp,p),'utf8');
const fail=message=>{console.error(`PARITY ERROR: ${message}`);process.exitCode=1;};

execFileSync('git',['clone','--depth=1',sourceRepo,tmp],{stdio:'inherit'});
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:tmp,encoding:'utf8'}).trim();
const parity=JSON.parse(read('docs/original-parity.json'));
if(parity.sourceCommit!==sourceCommit)fail(`La app original avanzó: baseline ${parity.sourceCommit}, main actual ${sourceCommit}.`);

// Estos archivos contienen UI/dominio puro y deben ser idénticos a la app original.
const exactFiles=[
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
  'tests/projects.test.mjs'
];
for(const file of exactFiles){
  try{
    if(read(file)!==source(file))fail(`${file} difiere de delta-mining-ops.`);
  }catch(error){fail(`${file}: ${error.message}`);}
}

// La versión Supabase no puede recuperar dependencias de runtime hacia Apps Script.
const forbidden=[
  /APPS_SCRIPT_URL/g,
  /postToAppsScript/g,
  /from\s+["'][^"']*appsScriptApi\.js["']/g,
  /google\.script\.run/g
];
function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full);
    else if(/\.(js|jsx|mjs)$/.test(entry.name)){
      const text=fs.readFileSync(full,'utf8');
      for(const pattern of forbidden){pattern.lastIndex=0;if(pattern.test(text))fail(`${path.relative(root,full)} contiene dependencia prohibida de Apps Script: ${pattern}`);}
    }
  }
}
walk(path.join(root,'src'));

const requiredSupabase=[
  'src/services/supabaseClient.js',
  'src/services/operationalSupabase.js',
  'src/services/supabaseReadBridge.js',
  'src/services/tallerMovements.js'
];
for(const file of requiredSupabase)if(!fs.existsSync(path.join(root,file)))fail(`Falta capa Supabase requerida: ${file}`);

if(!process.exitCode)console.log(`Paridad estática OK contra delta-mining-ops@${sourceCommit}`);
