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
  try{if(read(file)!==source(file))fail(`${file} difiere de delta-mining-ops.`);}
  catch(error){fail(`${file}: ${error.message}`);}
}

// Se prohíben dependencias de red/runtime hacia Apps Script. Los nombres heredados
// de funciones adaptadoras son compatibles si internamente terminan en operationalSupabase.
const forbidden=[
  /from\s+["'][^"']*appsScriptApi\.js["']/g,
  /from\s+["'][^"']*config\/app\.js["']/g,
  /google\.script\.run/g,
  /script\.google\.com\/macros/g,
  /VITE_APPS_SCRIPT_URL/g
];
function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full);
    else if(/\.(js|jsx|mjs)$/.test(entry.name)){
      const rel=path.relative(root,full).replace(/\\/g,'/');
      // app.js y appsScriptApi.js pueden permanecer como archivos legacy no importados;
      // lo que se impide es que la aplicación activa vuelva a depender de ellos.
      if(rel==='src/config/app.js'||rel==='src/services/appsScriptApi.js')continue;
      const text=fs.readFileSync(full,'utf8');
      for(const pattern of forbidden){pattern.lastIndex=0;if(pattern.test(text))fail(`${rel} contiene dependencia prohibida de Apps Script: ${pattern}`);}
    }
  }
}
walk(path.join(root,'src'));

const requiredSupabase=[
  'src/services/supabaseClient.js',
  'src/services/operationalSupabase.js',
  'src/services/supabaseReadBridge.js',
  'src/services/tallerMovements.js',
  'src/services/abastecimientoSupabase.js',
  'src/services/stockService.js'
];
for(const file of requiredSupabase)if(!fs.existsSync(path.join(root,file)))fail(`Falta capa Supabase requerida: ${file}`);

const writeActions=read('src/services/writeActions.js');
if(!writeActions.includes('runOperationalWrite'))fail('writeActions.js no está conectado a operationalSupabase.');
const stockService=read('src/services/stockService.js');
if(!stockService.includes('./operationalSupabase.js'))fail('stockService.js no está conectado a Supabase.');

if(!process.exitCode)console.log(`Paridad estática OK contra delta-mining-ops@${sourceCommit}`);
