import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const sourceRepo='https://github.com/NahuelGarciaDelta/delta-mining-ops.git';
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const fail=message=>{console.error(`PARITY ERROR: ${message}`);process.exitCode=1;};
const networkGitArgs=args=>process.platform==='win32'?['-c','http.sslBackend=openssl',...args]:args;
const parity=JSON.parse(read('docs/original-parity.json'));

const currentSourceCommit=execFileSync('git',networkGitArgs(['ls-remote',sourceRepo,'refs/heads/main']),{encoding:'utf8'}).trim().split(/\s+/)[0]||'';
if(!currentSourceCommit)fail('No se pudo resolver main de delta-mining-ops.');
if(currentSourceCommit&&parity.sourceCommit!==currentSourceCommit){
  console.warn(`PARITY NOTICE: delta-mining-ops avanzó desde ${parity.sourceCommit} hasta ${currentSourceCommit}. Revisar esos commits; la adaptación Supabase se valida por contratos funcionales.`);
}

const contracts=[
 ['vite.config.js',[/intelligentRefreshVitePlugin/,/vehicleKmMaintenanceVitePlugin/,/pmVehicleScopeVitePlugin/,/pmVehicleDisplayVitePlugin/,/equipmentProfileCodeHistoryVitePlugin/,/equipmentProfileAliasProjectMultiselectVitePlugin/,/equipmentProfileDeduplicateLastRop02VitePlugin/,/equipmentProfileLocationVehicleLabelVitePlugin/,/equipmentProfileVehicleArrowsVitePlugin/,/tallerCentralNavigationVitePlugin/,/atrasoIchcFixesVitePlugin/,/progressiveRowsVitePlugin/,/supabaseSourceThrottleVitePlugin/,/abastecimientoWriteReliabilityVitePlugin/]],
 ['scripts/taller-central-navigation-vite-plugin.mjs',[/tallerCentralNavigationVitePlugin/,/tallerMovimientoSubida/,/tallerMovimientoBaja/,/tallerMovimientoMovilizacion/,/tallerMovimientoCambio/,/Movimiento de equipos/]],
 ['scripts/vehicle-km-maintenance-vite-plugin.mjs',[/vehicleKmMaintenanceVitePlugin/,/MantenimientoProgramadoView/,/kil[oó]metro|\bkm\b/i]],
 ['scripts/equipment-profile-code-history-vite-plugin.mjs',[/equipmentProfileCodeHistoryVitePlugin/,/Código anterior|Codigo anterior/,/physicalIdentity/,/projectMovements/]],
 ['scripts/equipment-profile-alias-project-multiselect-vite-plugin.mjs',[/equipmentProfileAliasProjectMultiselectVitePlugin/,/selectedProject|selectedProjects/,/profileAliasKeys|alias/i,/proyecto/i]],
 ['src/modules/equipment/EquipmentProfileView.jsx',[/EquipmentPicker/,/useEquipmentMovements/,/mergeEquipmentMovements/]],
 ['src/modules/home/ExecutiveDashboard.jsx',[/ExecutiveDashboard/]],
 ['src/modules/home/ViewBienvenida.jsx',[/ViewBienvenida/,/getRop02LatestByEquipmentProject/,/getRma15OpenOtSummary/]],
 ['src/modules/informe-costos/InformeCostosRoute.jsx',[/InformeCostosRoute/,/buildReportSnapshot/,/snapshotRef/,/rma15:\s*cloneRows\(props\.rma15\)/,/rop02:\s*cloneRows\(props\.rop02\)/,/listaEquipos:\s*cloneRows\(props\.listaEquipos\)/,/insumos:\s*cloneRecord\(props\.insumos\)/,/equipmentUniverse:\s*null/]],
 ['src/modules/informe-costos/InformeCostosView.jsx',[/MemoViewCostosMant|ViewCostosMant/]],
 ['src/modules/mantenimiento/MantenimientoProgramadoView.jsx',[/mantenimiento/i,/programado/i]],
 ['src/modules/oficina-tecnica/OficinaTecnicaRoute.jsx',[/OficinaTecnica/]],
 ['src/services/dataRefreshPolicy.js',[/refresh/i]],
 ['src/services/requestCoordinator.js',[/pendingRequests/,/request-deduplicated/,/AbortController/,/stableRequestParams/]],
 ['src/services/operationalSupabase.js',[/runDedupedRequest/,/preloadOperationalSnapshots/,/if\(!requested\.length\)return\[\]/]],
 ['src/services/abastecimientoSupabase.js',[/abastecimiento_snapshot/,/runDedupedRequest/,/abastecimiento_delete_raba03_solicitud/]],
 ['scripts/abastecimiento-write-reliability-vite-plugin.mjs',[/deleteAbastecimientoRaba03Solicitud/,/deleteSolicitudRABA03/,/>Eliminar<\/button>/,/cantidadEnviadaFuente/,/\.filter\(r=>r\._changed\)/]],
 ['src/modules/abastecimiento/enviosSinSolicitud.js',[/allocateAbastecimientoRemitos/,/Math\.min/,/remaining|restante/i]],
 ['src/shared/rop02State.js',[/OD/,/FS/,/EM/]],
 ['src/data/operationalRepository.js',[/rop02_frontend/,/ROP02_SOURCE_KEY_PREFIX/]],
 ['src/modules/auth/Login.jsx',[/AUTH_MAX_ATTEMPTS/,/authenticateUser/]],
];
for(const [file,patterns] of contracts){
  let text='';
  try{text=read(file);}catch(error){fail(`${file}: ${error.message}`);continue;}
  for(const pattern of patterns){pattern.lastIndex=0;if(!pattern.test(text))fail(`${file} no cumple contrato funcional requerido: ${pattern}`);}
}

const forbidden=[/google\.script\.run/g,/script\.google\.com\/macros/g,/VITE_APPS_SCRIPT_URL/g];
const appsScriptAllowlist=new Map([['src/config/app.js',new Set(['/script\\.google\\.com\\/macros/g','/VITE_APPS_SCRIPT_URL/g'])],['src/services/appsScriptApi.js',new Set(['/VITE_APPS_SCRIPT_URL/g'])]]);
function isAllowedAppsScriptReference(rel,pattern){return appsScriptAllowlist.get(rel)?.has(String(pattern))===true;}
function walk(dir){
  for(const entry of fs.readdirSync(dir,{withFileTypes:true})){
    const full=path.join(dir,entry.name);
    if(entry.isDirectory())walk(full);
    else if(/\.(js|jsx|mjs)$/.test(entry.name)){
      const rel=path.relative(root,full).replace(/\\/g,'/');
      const text=fs.readFileSync(full,'utf8');
      for(const pattern of forbidden){pattern.lastIndex=0;if(pattern.test(text)&&!isAllowedAppsScriptReference(rel,pattern))fail(`${rel} contiene dependencia prohibida de Apps Script: ${pattern}`);}
    }
  }
}
walk(path.join(root,'src'));

const requiredSupabase=['src/services/supabaseClient.js','src/services/operationalSupabase.js','src/services/supabaseReadBridge.js','src/services/tallerMovements.js','src/services/abastecimientoSupabase.js','src/services/stockService.js','src/data/operationalRepository.js','src/services/requestCoordinator.js'];
for(const file of requiredSupabase)if(!fs.existsSync(path.join(root,file)))fail(`Falta capa Supabase requerida: ${file}`);

const writeActions=read('src/services/writeActions.js');
if(!writeActions.includes('runOperationalWrite'))fail('writeActions.js no está conectado a operationalSupabase.');
const stockService=read('src/services/stockService.js');
if(!stockService.includes('./operationalSupabase.js'))fail('stockService.js no está conectado a Supabase.');
const apiAdapter=read('src/services/appsScriptApi.js');
if(!apiAdapter.includes('requireSupabase')||!apiAdapter.includes('getOperationalSource'))fail('appsScriptApi.js no funciona como adapter Supabase.');
const operationalRepository=read('src/data/operationalRepository.js');
const homeFilter=read('src/modules/home/ViewBienvenidaProjectFilter.jsx');
if(/__dmHomeSummary(?:ExternalFilter|Project)/.test(homeFilter))fail('ViewBienvenidaProjectFilter.jsx vuelve a forzar un filtro global ajeno a la selección real.');
const app=read('src/App.jsx');
if(!app.includes('const onDateArrow=(event)=>'))fail('App.jsx no conserva la navegación ←/→ para vistas de un solo día.');
if(app.includes('const globalPreloadRef='))fail('App.jsx sigue compitiendo con la vista activa mediante una precarga global remota.');
const equipmentFieldContracts=[['Código nuevo',['"Código nuevo"','"Codigo nuevo"']],['Código anterior',['"Código anterior"','"Codigo anterior"']],['Código de Drusila',['"Código de Drusila"','"Codigo de Drusila"']],['Familia',['Familia:']],['Lugar de alquiler',['"Lugar de alquiler"']]];
for(const [field,markers] of equipmentFieldContracts){if(!markers.some(marker=>operationalRepository.includes(marker)))fail(`operationalRepository.js no expone el campo de Lista Maestra requerido por la original: ${field}`);}

if(!process.exitCode)console.log(`Paridad funcional Supabase OK contra delta-mining-ops baseline ${parity.sourceCommit}${currentSourceCommit!==parity.sourceCommit?` (main actual: ${currentSourceCommit})`:''}`);
