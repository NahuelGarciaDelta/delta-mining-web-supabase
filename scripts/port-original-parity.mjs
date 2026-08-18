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

// Archivos visuales y de dominio puros: paridad 1:1 con la app original.
[
  'scripts/progressive-rows-vite-plugin.mjs',
  'src/components/CalendarPeriodMonthYear.jsx',
  'src/config/moduleDeps.jsx',
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
  'src/modules/oficina-tecnica/OficinaTecnicaRoute.jsx',
  'src/services/appCache.js',
  'src/services/dataRefreshPolicy.js',
  'src/services/equipmentMovementsDomain.js',
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

// Movimientos de equipos: se mantiene la UX/dominio de la original, pero la
// persistencia continúa en los RPC dedicados de Supabase.
write('src/services/equipmentMovements.js',`import {useCallback,useEffect,useMemo,useState} from "react";\nimport {readCachedSource,writeCachedSource} from "./appCache.js";\nimport {registerRefreshTask} from "./refreshManager.js";\nimport {equipmentProjectKey,normalizeRop02Project} from "../modules/home/homeAvailability.js";\nimport {appendEquipmentMovementLinkMetadata,getMovimientoVigentePorEquipo,movementsToAtrasoMap,normalizeEquipmentMovementCode} from "./equipmentMovementsDomain.js";\nimport {getEquipmentMovementsSnapshot,saveEquipmentMovementSupabase,cancelEquipmentMovementSupabase} from "./operationalSupabase.js";\n\nexport {getMovimientoVigentePorEquipo,movementsToAtrasoMap} from "./equipmentMovementsDomain.js";\n\nlet cache={data:[],loaded:false,loading:null,error:"",version:0};\nconst listeners=new Set();\nconst emit=()=>listeners.forEach(listener=>listener(cache));\nconst CACHE_KEY="movimientos_equipos";\nconst persistCache_=async(version=0)=>{cache={...cache,version:Number(version||cache.version||0)};return writeCachedSource(CACHE_KEY,{ok:true,data:cache.data,meta:{serverVersion:cache.version}}).catch(()=>{});};\n\nexport async function loadEquipmentMovements({force=false,revalidate=true}={}){\n  if(cache.loading)return cache.loading;\n  cache.loading=(async()=>{\n    if(!cache.loaded){const record=await readCachedSource(CACHE_KEY).catch(()=>null);if(record?.data?.ok&&Array.isArray(record.data.data)){cache={data:record.data.data,loaded:true,loading:cache.loading,error:"",version:Number(record.data?.meta?.serverVersion||record.version||0)};emit();}}\n    if(cache.loaded&&!force&&!revalidate)return cache;\n    const response=await getEquipmentMovementsSnapshot(false,{force});\n    cache={data:Array.isArray(response?.data)?response.data:[],loaded:true,loading:cache.loading,error:"",version:Number(response?.meta?.serverVersion||Date.now())};\n    await persistCache_(cache.version);emit();return cache;\n  })().catch(error=>{cache={...cache,loaded:true,loading:null,error:error?.message||"No fue posible cargar movimientos de equipos."};emit();if(cache.data.length)return cache;throw error;}).finally(()=>{cache={...cache,loading:null};emit();});\n  return cache.loading;\n}\n\nexport async function saveEquipmentMovement(movement){\n  const prepared={...movement};\n  if(String(prepared.tipoMovimiento||"").toUpperCase()==="CAMBIO_PROYECTO"){\n    const pending=typeof window!=="undefined"?window.__dmPendingEquipmentMovementLink:null;\n    if(!prepared.internoDestino&&pending?.valid){const pendingProject=normalizeRop02Project(pending.destinationProject||"");const movementProject=normalizeRop02Project(prepared.proyectoDestino||"");if(!pendingProject||!movementProject||pendingProject===movementProject){prepared.internoDestino=pending.destinationCode||"";prepared.fechaPrimerRop02Destino=pending.firstDestinationDate||"";}}\n    if(prepared.internoDestino)prepared.observacion=appendEquipmentMovementLinkMetadata(prepared.observacion,prepared.internoDestino,prepared.fechaPrimerRop02Destino);\n  }\n  const response=await saveEquipmentMovementSupabase(prepared);\n  if(typeof window!=="undefined")window.__dmPendingEquipmentMovementLink=null;\n  const saved=response?.movement;\n  if(saved){const next=cache.data.map(item=>item.activo&&item.internoNormalizado===saved.internoNormalizado&&item.proyectoOrigen===saved.proyectoOrigen?{...item,activo:false,estado:"SUPERADO"}:item);cache={data:[...next,saved],loaded:true,loading:null,error:"",version:Number(response.version||Date.now())};await persistCache_(cache.version);emit();}\n  return response;\n}\n\nexport async function cancelEquipmentMovement(id,_usuario){const response=await cancelEquipmentMovementSupabase(id);cache={data:cache.data.map(item=>String(item.id)===String(id)?{...item,activo:false,estado:"CANCELADO"}:item),loaded:true,loading:null,error:"",version:Number(response.version||Date.now())};await persistCache_(cache.version);emit();return response;}\n\nexport function useEquipmentMovements(rop02Rows=[],views=[]){\n  const[snapshot,setSnapshot]=useState(cache);\n  useEffect(()=>{listeners.add(setSnapshot);loadEquipmentMovements().catch(()=>{});return()=>listeners.delete(setSnapshot)},[]);\n  useEffect(()=>registerRefreshTask("equipment-movements",()=>loadEquipmentMovements({revalidate:true}),{views,priority:15}),[JSON.stringify(views)]);\n  const latestRop02ByEquipmentProject=useMemo(()=>{const latest=new Map();for(const row of Array.isArray(rop02Rows)?rop02Rows:[]){const code=normalizeEquipmentMovementCode(row?.maquina||row?._internoRaw);const project=normalizeRop02Project(row?.proyecto||row?.lugar);const date=String(row?.fecha||"").slice(0,10);const key=equipmentProjectKey(code,project);if(code&&project&&date&&(!latest.has(key)||date>latest.get(key)))latest.set(key,date);}return latest;},[rop02Rows]);\n  const activeMovementByEquipment=useMemo(()=>getMovimientoVigentePorEquipo(snapshot.data,latestRop02ByEquipmentProject),[snapshot.data,latestRop02ByEquipmentProject]);\n  const admitidos=useMemo(()=>movementsToAtrasoMap(activeMovementByEquipment),[activeMovementByEquipment]);\n  return{...snapshot,loading:Boolean(snapshot.loading)||!snapshot.loaded,movements:snapshot.data,activeMovementByEquipment,admitidos,reload:useCallback(()=>loadEquipmentMovements({force:true}),[])};\n}\n`);

// Precarga adaptada a Supabase. El modo force saltea caché y recalienta las tres fuentes.
write('src/services/globalPreload.js',`import {getRop02,getRop05,getRma15,refreshHistoricalDataset} from "../data/historicalDataService.js";\n\nlet preloadPromise=null;\nlet preloadDone=false;\n\nexport function isHistoricalPreloadReady(){return preloadDone;}\n\nexport function preloadHistoricalDatasets({force=false}={}){\n  if(preloadDone&&!force)return Promise.resolve(true);\n  if(preloadPromise&&!force)return preloadPromise;\n  const common={limit:"all",offset:0,sortBy:"fecha",sortDirection:"desc"};\n  const jobs=force\n    ?[refreshHistoricalDataset("rop02",common),refreshHistoricalDataset("rop05",common),refreshHistoricalDataset("rma15",common)]\n    :[getRop02(common),getRop05(common),getRma15(common)];\n  const task=Promise.allSettled(jobs).then(results=>{preloadDone=results.some(result=>result.status==="fulfilled");return preloadDone;}).finally(()=>{if(preloadPromise===task)preloadPromise=null;});\n  preloadPromise=task;\n  return task;\n}\n`);

// main.jsx: conservar el puente Supabase y limpieza SW en DEV, agregando la política
// global de refresco de la app original.
{
  let s=read('src/main.jsx');
  if(!s.includes('dataRefreshPolicy.js')){
    s=replaceOrThrow(s,
      'import { installSupabaseReadBridge } from "./services/supabaseReadBridge.js";\n',
      'import { installSupabaseReadBridge } from "./services/supabaseReadBridge.js";\nimport {preloadHistoricalDatasets} from "./services/globalPreload.js";\nimport {DATA_REFRESH_INTERVAL_MS,dispatchDataRefreshPolicyTick,installLegacyRefreshIntervalPolicy} from "./services/dataRefreshPolicy.js";\n',
      'imports main refresh');
    s=replaceOrThrow(s,'installSupabaseReadBridge();\n','installSupabaseReadBridge();\ninstallLegacyRefreshIntervalPolicy();\n','instalación política refresh');
    const anchor='createRoot(document.getElementById("root")).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);\n';
    const block=`${anchor}\nif(typeof window!=="undefined"){\n  let lastHistoricalRefresh=Date.now();\n  const refreshHistorical=()=>{if(document.hidden||navigator.onLine===false)return;lastHistoricalRefresh=Date.now();dispatchDataRefreshPolicyTick("auto");preloadHistoricalDatasets({force:true}).catch(()=>{});};\n  const id=window.setInterval(refreshHistorical,DATA_REFRESH_INTERVAL_MS);\n  const onVisible=()=>{if(!document.hidden&&Date.now()-lastHistoricalRefresh>=DATA_REFRESH_INTERVAL_MS)refreshHistorical();};\n  const onOnline=()=>refreshHistorical();\n  document.addEventListener("visibilitychange",onVisible);window.addEventListener("online",onOnline);\n  window.addEventListener("beforeunload",()=>{window.clearInterval(id);document.removeEventListener("visibilitychange",onVisible);window.removeEventListener("online",onOnline);},{once:true});\n}\n`;
    s=replaceOrThrow(s,anchor,block,'bloque de precarga main');
  }
  write('src/main.jsx',s);
}

// Login conserva authenticateUser() encapsulado en esta app y suma protección de doble submit.
{
  let s=read('src/modules/auth/Login.jsx');
  if(!s.includes('submitInFlightRef')){
    s=replaceOrThrow(s,'  const[validando,setValidando]=React.useState(false);\n','  const[validando,setValidando]=React.useState(false);\n  const submitInFlightRef=React.useRef(false);\n','login submit ref');
    s=replaceOrThrow(s,'  const handleSubmit=async()=>{\n    const mail=normalizarMail(usuario);','  const handleSubmit=async()=>{\n    if(submitInFlightRef.current)return;\n    const mail=normalizarMail(usuario);','login guard');
    s=replaceOrThrow(s,'    setValidando(true);\n    try{','    submitInFlightRef.current=true;\n    setValidando(true);\n    try{','login start');
    s=replaceOrThrow(s,'    }finally{\n      setValidando(false);\n    }','    }finally{\n      submitInFlightRef.current=false;\n      setValidando(false);\n    }','login finally');
    s=s.replace('value={usuario}\n            onChange=', 'value={usuario}\n            disabled={validando}\n            onChange=');
    s=s.replace('value={pass}\n            onChange=', 'value={pass}\n            disabled={validando}\n            onChange=');
  }
  write('src/modules/auth/Login.jsx',s);
}

fs.mkdirSync(path.join(root,'docs'),{recursive:true});
write('docs/original-parity.json',JSON.stringify({
  sourceRepository:'NahuelGarciaDelta/delta-mining-ops',
  sourceCommit,
  syncedAt:new Date().toISOString(),
  policy:'UI, filtros, vistas y lógica de dominio desde original; lectura/escritura, autenticación y persistencia remota permanecen Supabase-first.'
},null,2)+'\n');

console.log(`Paridad funcional portada desde delta-mining-ops@${sourceCommit}`);
