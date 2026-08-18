import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'delta-original-'));
const sourceRepo='https://github.com/NahuelGarciaDelta/delta-mining-ops.git';

const run=(cmd,args,cwd=root)=>execFileSync(cmd,args,{cwd,stdio:'inherit'});
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const write=(p,s)=>{const full=path.join(root,p);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,s);};
const source=p=>fs.readFileSync(path.join(tmp,p),'utf8');
const copy=p=>write(p,source(p));
const replaceOrThrow=(text,from,to,label)=>{if(!text.includes(from))throw new Error(`No se encontró patrón ${label}`);return text.replace(from,to);};

run('git',['clone','--depth=1',sourceRepo,tmp]);
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:tmp,encoding:'utf8'}).trim();

// Archivos puramente visuales / de dominio. Se copian 1:1 desde la app original.
[
  'scripts/progressive-rows-vite-plugin.mjs',
  'src/components/CalendarPeriodMonthYear.jsx',
  'src/config/moduleDeps.jsx',
  'src/hooks/useProgressiveRows.js',
  'src/modules/equipment/EquipmentProfileWithLastRop02.jsx',
  'src/modules/equipment/equipmentCode.js',
  'src/modules/equipment/index.js',
  'src/modules/home/ViewBienvenidaProjectFilter.jsx',
  'src/modules/home/homeAvailability.js',
  'src/modules/home/index.js',
  'src/modules/informe-costos/InformeCostosRoute.jsx',
  'src/modules/informe-costos/InformeCostosView.jsx',
  'src/modules/oficina-tecnica/OficinaTecnicaRoute.jsx',
  'src/services/appCache.js',
  'src/services/dataRefreshPolicy.js',
  'src/shared/projects.js',
  'tests/equipmentCode.test.mjs',
  'tests/projects.test.mjs',
  'vite.config.js',
].forEach(copy);

// historicalDataService conserva repositorios Supabase, pero incorpora la misma
// infraestructura de actualización/remontaje usada por la app original.
{
  let s=read('src/data/historicalDataService.js');
  if(!s.includes('HISTORICAL_UPDATED_EVENT')){
    s=replaceOrThrow(s,
      'const MAX_MEMORY_QUERIES=8;\n',
      'const MAX_MEMORY_QUERIES=8;\nconst HISTORICAL_UPDATED_EVENT="dm-historical-dataset-updated";\nconst COMMON_HISTORICAL_QUERY=Object.freeze({limit:"all",offset:0,sortBy:"fecha",sortDirection:"desc"});\n\nfunction notifyDatasetUpdated_(dataset,key,value,params){\n  if(typeof window==="undefined"||typeof window.dispatchEvent!=="function")return;\n  try{window.dispatchEvent(new CustomEvent(HISTORICAL_UPDATED_EVENT,{detail:{dataset,key,value,params:{...(params||{})}}}));}catch(_){}\n}\n',
      'constantes de evento histórico');

    s=replaceOrThrow(s,
      'remember_(key,value);await writeCachedSource(`query:${key}`,value);return value;',
      'remember_(key,value);await writeCachedSource(`query:${key}`,value);notifyDatasetUpdated_(dataset,key,value,params);return value;',
      'notificación al actualizar dataset');

    s=replaceOrThrow(s,
      'export const getRma15=params=>getDataset("rma15",params);\n',
      'export const getRma15=params=>getDataset("rma15",params);\nexport const refreshHistoricalDataset=(dataset,params={})=>fetchDatasetPage(dataset,params);\nexport const HISTORICAL_DATASET_UPDATED_EVENT=HISTORICAL_UPDATED_EVENT;\nexport async function refreshCommonHistoricalDatasets(){\n  return Promise.allSettled([\n    fetchDatasetPage("rop02",COMMON_HISTORICAL_QUERY),\n    fetchDatasetPage("rop05",COMMON_HISTORICAL_QUERY),\n    fetchDatasetPage("rma15",COMMON_HISTORICAL_QUERY),\n  ]);\n}\n',
      'exports de refresh histórico');
  }
  write('src/data/historicalDataService.js',s);
}

// Precarga adaptada a Supabase. El modo force saltea caché y recalienta las tres fuentes.
write('src/services/globalPreload.js',`import {getRop02,getRop05,getRma15,refreshHistoricalDataset} from "../data/historicalDataService.js";\n\nlet preloadPromise=null;\nlet preloadDone=false;\n\nexport function isHistoricalPreloadReady(){return preloadDone;}\n\nexport function preloadHistoricalDatasets({force=false}={}){\n  if(preloadDone&&!force)return Promise.resolve(true);\n  if(preloadPromise&&!force)return preloadPromise;\n  const common={limit:"all",offset:0,sortBy:"fecha",sortDirection:"desc"};\n  const jobs=force\n    ?[refreshHistoricalDataset("rop02",common),refreshHistoricalDataset("rop05",common),refreshHistoricalDataset("rma15",common)]\n    :[getRop02(common),getRop05(common),getRma15(common)];\n  const task=Promise.allSettled(jobs).then(results=>{\n    preloadDone=results.some(result=>result.status==="fulfilled");\n    return preloadDone;\n  }).finally(()=>{if(preloadPromise===task)preloadPromise=null;});\n  preloadPromise=task;\n  return task;\n}\n`);

// main.jsx: conservar el puente Supabase y limpieza SW en DEV, agregando la política
// global de refresco de la app original.
{
  let s=read('src/main.jsx');
  if(!s.includes('dataRefreshPolicy.js')){
    s=replaceOrThrow(s,
      'import { installSupabaseReadBridge } from "./services/supabaseReadBridge.js";\n',
      'import { installSupabaseReadBridge } from "./services/supabaseReadBridge.js";\nimport {preloadHistoricalDatasets} from "./services/globalPreload.js";\nimport {DATA_REFRESH_INTERVAL_MS,dispatchDataRefreshPolicyTick,installLegacyRefreshIntervalPolicy} from "./services/dataRefreshPolicy.js";\n',
      'imports main refresh');
    s=replaceOrThrow(s,
      'installSupabaseReadBridge();\n',
      'installSupabaseReadBridge();\ninstallLegacyRefreshIntervalPolicy();\n',
      'instalación política refresh');
    const anchor='createRoot(document.getElementById("root")).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n';
    const block=`${anchor}\n// Mantiene calientes ROP02/ROP05/RMA15 desde Supabase sin bloquear ninguna vista.\nif(typeof window!=="undefined"){\n  let lastHistoricalRefresh=Date.now();\n  const refreshHistorical=()=>{\n    if(document.hidden||navigator.onLine===false)return;\n    lastHistoricalRefresh=Date.now();\n    dispatchDataRefreshPolicyTick("auto");\n    preloadHistoricalDatasets({force:true}).catch(()=>{});\n  };\n  const id=window.setInterval(refreshHistorical,DATA_REFRESH_INTERVAL_MS);\n  const onVisible=()=>{if(!document.hidden&&Date.now()-lastHistoricalRefresh>=DATA_REFRESH_INTERVAL_MS)refreshHistorical();};\n  const onOnline=()=>refreshHistorical();\n  document.addEventListener("visibilitychange",onVisible);\n  window.addEventListener("online",onOnline);\n  window.addEventListener("beforeunload",()=>{\n    window.clearInterval(id);\n    document.removeEventListener("visibilitychange",onVisible);\n    window.removeEventListener("online",onOnline);\n  },{once:true});\n}\n`;
    s=replaceOrThrow(s,anchor,block,'bloque de precarga main');
  }
  write('src/main.jsx',s);
}

// Login: conservar authenticateUser() encapsulado en la versión Supabase y portar
// protección de doble submit + bloqueo visual de la app original.
{
  let s=read('src/modules/auth/Login.jsx');
  if(!s.includes('submitInFlightRef')){
    s=replaceOrThrow(s,
      '  const[validando,setValidando]=React.useState(false);\n',
      '  const[validando,setValidando]=React.useState(false);\n  const submitInFlightRef=React.useRef(false);\n',
      'login submit ref');
    s=replaceOrThrow(s,
      '  const handleSubmit=async()=>{\n    const mail=normalizarMail(usuario);',
      '  const handleSubmit=async()=>{\n    if(submitInFlightRef.current)return;\n    const mail=normalizarMail(usuario);',
      'login guard');
    s=replaceOrThrow(s,
      '    setValidando(true);\n    try{',
      '    submitInFlightRef.current=true;\n    setValidando(true);\n    try{',
      'login start');
    s=replaceOrThrow(s,
      '    }finally{\n      setValidando(false);\n    }',
      '    }finally{\n      submitInFlightRef.current=false;\n      setValidando(false);\n    }',
      'login finally');
    s=s.replace('value={usuario}\n            onChange=', 'value={usuario}\n            disabled={validando}\n            onChange=');
    s=s.replace('value={pass}\n            onChange=', 'value={pass}\n            disabled={validando}\n            onChange=');
  }
  write('src/modules/auth/Login.jsx',s);
}

// Registro de baseline: permite que próximas sincronizaciones comparen sólo cambios nuevos.
fs.mkdirSync(path.join(root,'docs'),{recursive:true});
write('docs/original-parity.json',JSON.stringify({
  sourceRepository:'NahuelGarciaDelta/delta-mining-ops',
  sourceCommit,
  syncedAt:new Date().toISOString(),
  policy:'UI, filtros, vistas y lógica de dominio desde original; lectura/escritura y caché remota permanecen Supabase-first.'
},null,2)+'\n');

console.log(`Paridad funcional portada desde delta-mining-ops@${sourceCommit}`);
