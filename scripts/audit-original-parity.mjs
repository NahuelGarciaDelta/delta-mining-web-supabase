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
const parity=JSON.parse(read('docs/original-parity.json'));

const currentSourceCommit=execFileSync('git',['ls-remote',sourceRepo,'refs/heads/main'],{encoding:'utf8'}).trim().split(/\s+/)[0]||'';
if(currentSourceCommit&&parity.sourceCommit!==currentSourceCommit){
  console.warn(`PARITY NOTICE: delta-mining-ops avanzó desde ${parity.sourceCommit} hasta ${currentSourceCommit}. Portar cambios y actualizar baseline cuando corresponda.`);
}

execFileSync('git',['init',tmp],{stdio:'inherit'});
execFileSync('git',['remote','add','origin',sourceRepo],{cwd:tmp,stdio:'inherit'});
execFileSync('git',['fetch','--depth=1','origin',parity.sourceCommit],{cwd:tmp,stdio:'inherit'});
execFileSync('git',['checkout','--detach','FETCH_HEAD'],{cwd:tmp,stdio:'inherit'});
const checkedSourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:tmp,encoding:'utf8'}).trim();
if(checkedSourceCommit!==parity.sourceCommit)fail(`No se pudo validar el baseline esperado ${parity.sourceCommit}; se obtuvo ${checkedSourceCommit}.`);

const exactFiles=[
  'src/components/CalendarPeriodMonthYear.jsx',
  'src/hooks/useProgressiveRows.js',
  'src/modules/equipment/EquipmentProfileWithLastRop02.jsx',
  'src/modules/equipment/equipmentCode.js',
  'src/modules/equipment/equipmentMovementHistory.js',
  'src/modules/equipment/index.js',
  'src/modules/home/index.js',
  'src/services/appCache.js',
  'src/services/equipmentMovementsDomain.js',
  'tests/equipmentCode.test.mjs',
  'tests/projects.test.mjs'
];
for(const file of exactFiles){
  try{if(read(file)!==source(file))fail(`${file} difiere de delta-mining-ops@${parity.sourceCommit}.`);}
  catch(error){fail(`${file}: ${error.message}`);}
}

const contracts=[
  ['src/modules/home/ViewBienvenidaProjectFilter.jsx',[/project/i,/filter/i]],
  ['src/modules/home/homeAvailability.js',[/calculateHomeAvailabilityFromRop02/,/calculateOpenOtItems/,/calculateAtrasoRop02/]],
  ['src/modules/informe-costos/InformeCostosRoute.jsx',[/getRma15EquipmentUniverse/,/getRma15\(/,/getRop02\(/]],
  ['src/modules/informe-costos/InformeCostosView.jsx',[/MemoViewCostosMant|ViewCostosMant/]],
  ['src/modules/mantenimiento/MantenimientoProgramadoView.jsx',[/mantenimiento/i,/programado/i]],
  ['src/modules/oficina-tecnica/OficinaTecnicaRoute.jsx',[/OficinaTecnica/]],
  ['src/services/dataRefreshPolicy.js',[/refresh/i]],
  ['src/shared/projects.js',[/project|proyecto/i]],
];
for(const [file,patterns] of contracts){
  let text='';try{text=read(file);}catch(error){fail(`${file}: ${error.message}`);continue;}
  for(const pattern of patterns){pattern.lastIndex=0;if(!pattern.test(text))fail(`${file} no cumple contrato funcional requerido: ${pattern}`);}
}

const forbidden=[
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
      const text=fs.readFileSync(full,'utf8');
      for(const pattern of forbidden){pattern.lastIndex=0;if(pattern.test(text))fail(`${rel} contiene dependencia prohibida de Apps Script: ${pattern}`);}
    }
  }
}
walk(path.join(root,'src'));

const requiredSupabase=[
  'src/services/supabaseClient.js','src/services/operationalSupabase.js','src/services/supabaseReadBridge.js',
  'src/services/tallerMovements.js','src/services/abastecimientoSupabase.js','src/services/stockService.js'
];
for(const file of requiredSupabase)if(!fs.existsSync(path.join(root,file)))fail(`Falta capa Supabase requerida: ${file}`);

const writeActions=read('src/services/writeActions.js');
if(!writeActions.includes('runOperationalWrite'))fail('writeActions.js no está conectado a operationalSupabase.');
const stockService=read('src/services/stockService.js');
if(!stockService.includes('./operationalSupabase.js'))fail('stockService.js no está conectado a Supabase.');
const apiAdapter=read('src/services/appsScriptApi.js');
if(!apiAdapter.includes('requireSupabase')||!apiAdapter.includes('getOperationalSource'))fail('appsScriptApi.js no funciona como adapter Supabase.');

if(!process.exitCode)console.log(`Paridad estática OK contra delta-mining-ops@${parity.sourceCommit}${currentSourceCommit&&currentSourceCommit!==parity.sourceCommit?` (main original actual: ${currentSourceCommit})`:''}`);
