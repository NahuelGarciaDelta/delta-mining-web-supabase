import {APPS_SCRIPT_URL} from "../config/app.js";
import {fetchDatasetQuery,fetchSyncVersions} from "../services/appsScriptApi.js";
import {readCachedSource,writeCachedSource} from "../services/appCache.js";
import {buildDatasetQueryKey} from "./historicalQueryParams.js";
import {createPagedDatasetController as createPagedController} from "./pagedDatasetController.js";
import {fetchAllRop02Pages,getLatestRop02ByEquipment,getRop02MonthlySummary as getSupabaseMonthlySummary,getRop02OperationalSnapshot as getSupabaseOperationalSnapshot,getRop02Page,getRop02Stats as getSupabaseRop02Stats,getRop02Facets as getSupabaseRop02Facets,getRop02Rop05Control as getSupabaseRop02Rop05Control} from "./rop02Repository.js";
import {fetchAllOperationalPages,getRma15Page,getRop05Page,getRma15EquipmentUniverseSupabase,getRma15OpenOtSummarySupabase} from "./operationalRepository.js";
export {buildDatasetQueryKey,operationalMonthRange,yearsForRange} from "./historicalQueryParams.js";
export {createPagedDatasetController} from "./pagedDatasetController.js";

const memory=new Map();
const pending=new Map();
const MAX_MEMORY_QUERIES=8;
const ROP02_SOURCE=String(import.meta.env.VITE_ROP02_SOURCE||"supabase").toLowerCase();
const TYPED_SOURCE=String(import.meta.env.VITE_TYPED_SOURCE||"supabase").toLowerCase();

function remember_(key,value){
  memory.delete(key);memory.set(key,value);
  while(memory.size>MAX_MEMORY_QUERIES)memory.delete(memory.keys().next().value);
}

export async function readDatasetQuery(dataset,params={}){
  const key=buildDatasetQueryKey(dataset,params);
  if(memory.has(key)){const value=memory.get(key);remember_(key,value);return{...value,cacheHit:true,cacheLevel:"memory"};}
  const record=await readCachedSource(`query:${key}`).catch(()=>null);
  if(record?.data?.ok){remember_(key,record.data);return{...record.data,cacheHit:true,cacheLevel:"indexeddb"};}
  return null;
}

export async function fetchDatasetPage(dataset,params={}){
  const key=buildDatasetQueryKey(dataset,params);
  if(pending.has(key))return pending.get(key);
  const started=performance.now();
  const supabaseRop02Request=()=>params.limit==="all"
    ?(async()=>{const data=[];const meta=await fetchAllRop02Pages(params,page=>data.push(...page));return{ok:true,data,rows:data.length,total:meta.total,hasMore:false,nextOffset:null,source:"supabase"};})()
    :getRop02Page({...params,limit:params.limit||250,offset:params.offset||0});
  const typedGetter=dataset==="rop05"?getRop05Page:dataset==="rma15"?getRma15Page:null;
  const legacyRequest=()=>fetchDatasetQuery(APPS_SCRIPT_URL,{dataset,...params,limit:params.limit||250,offset:params.offset||0}).then(value=>({...value,source:"legacy"}));
  const network=dataset==="rop02"&&ROP02_SOURCE!=="legacy"
    ?supabaseRop02Request().catch(error=>{
      console.warn("[ROP02] Supabase falló; se activa fallback legacy",error);
      return fetchDatasetQuery(APPS_SCRIPT_URL,{dataset,...params,limit:params.limit||250,offset:params.offset||0}).then(value=>({...value,source:"legacy-fallback"}));
    })
    :typedGetter&&TYPED_SOURCE!=="legacy"
      ?typedGetter(params).catch(error=>{console.warn(`[${dataset.toUpperCase()}] fallback legacy`,error);return legacyRequest().then(value=>({...value,source:"legacy-fallback"}));})
      :legacyRequest();
  const task=network.then(async response=>{
    const value={...response,cacheHit:false,cacheLevel:"network",elapsedMs:Math.round(performance.now()-started)};
    remember_(key,value);await writeCachedSource(`query:${key}`,value);
    if(import.meta.env.DEV)console.debug(`${dataset.toUpperCase()} | ${response.source||"network"} | ${response.rows||response.data?.length||0}/${response.total||0} | ${value.elapsedMs}ms | MISS`);
    return value;
  }).finally(()=>{if(pending.get(key)===task)pending.delete(key);});
  pending.set(key,task);return task;
}

export async function getDataset(dataset,params={}){
  const cached=await readDatasetQuery(dataset,params);
  if(!cached)return fetchDatasetPage(dataset,params);
  if(dataset==="rop02"&&ROP02_SOURCE!=="legacy"){
    fetchDatasetPage(dataset,params).catch(()=>{});
    if(import.meta.env.DEV)console.debug(`ROP02 | ${cached.source||"cache"} | ${cached.data?.length||0}/${cached.total||0} | 0ms | HIT`);
    return cached;
  }
  fetchSyncVersions(APPS_SCRIPT_URL).then(sync=>{
    const local=cached.versions||{},remote=sync?.versions||{};
    const changed=Object.keys(local).some(key=>Number(local[key]||0)!==Number(remote[key]||0));
    if(changed)fetchDatasetPage(dataset,params).catch(()=>{});
  }).catch(()=>{});
  return cached;
}

export const getRop02=params=>getDataset("rop02",params);
export const getRop05=params=>getDataset("rop05",params);
export const getRma15=params=>getDataset("rma15",params);
async function fetchSpecialAction_(action,params={}){
  const key=`special:${buildDatasetQueryKey(action,params)}`;
  const record=await readCachedSource(key).catch(()=>null);
  if(record?.data?.ok){
    const sync=await fetchSyncVersions(APPS_SCRIPT_URL).catch(()=>null),local=record.data.versions||{},remote=sync?.versions||{};
    const versionKeys=Object.keys(local),valid=!versionKeys.length||versionKeys.every(versionKey=>Number(local[versionKey]||0)===Number(remote[versionKey]||0));
    if(valid)return{...record.data,cacheHit:true,cacheLevel:"indexeddb"};
  }
  const started=performance.now(),response=await fetch(`${APPS_SCRIPT_URL}?${new URLSearchParams({action,...params,_t:String(Date.now())})}`,{cache:"no-store",redirect:"follow"});
  if(!response.ok)throw new Error(`HTTP ${response.status} desde Apps Script`);
  const text=await response.text();let json;try{json=JSON.parse(text);}catch(_){throw new Error("Apps Script no devolvió JSON válido");}
  if(!json?.ok)throw new Error(json?.error?.message||`Falló ${action}`);
  const value={...json,elapsedMs:Math.round(performance.now()-started),payloadBytes:new Blob([text]).size};await writeCachedSource(key,value);return value;
}
export const getRop02LatestByEquipmentProject=params=>ROP02_SOURCE==="legacy"?fetchSpecialAction_("get_rop02_latest_by_equipment_project",params):getLatestRop02ByEquipment(params).catch(error=>{console.warn("[ROP02] fallback latest legacy",error);return fetchSpecialAction_("get_rop02_latest_by_equipment_project",params);});
export const getRop02MonthlySummary=params=>ROP02_SOURCE==="legacy"?fetchSpecialAction_("get_rop02_monthly_summary",params):getSupabaseMonthlySummary(params).catch(error=>{console.warn("[ROP02] fallback summary legacy",error);return fetchSpecialAction_("get_rop02_monthly_summary",params);});
export const getRop02OperationalSnapshot=params=>ROP02_SOURCE==="legacy"?getRop02({...params,limit:"all"}):getSupabaseOperationalSnapshot(params).catch(error=>{console.warn("[ROP02] fallback operational snapshot legacy",error);return getRop02({...params,limit:"all"});});
export const getRop02Stats=params=>ROP02_SOURCE==="legacy"?Promise.resolve(null):getSupabaseRop02Stats(params);
export const getRop02Facets=params=>ROP02_SOURCE==="legacy"?Promise.resolve(null):getSupabaseRop02Facets(params);
export const getRop02Rop05Control=params=>ROP02_SOURCE==="legacy"?Promise.resolve(null):getSupabaseRop02Rop05Control(params);
export const getRma15EquipmentUniverse=params=>TYPED_SOURCE==="legacy"?fetchSpecialAction_("get_rma15_equipment_universe",params):getRma15EquipmentUniverseSupabase(params).catch(error=>{console.error("[RMA15] Supabase equipment universe falló",error);throw error;});
export const getRma15OpenOtSummary=params=>TYPED_SOURCE==="legacy"?fetchSpecialAction_("get_rma15_open_ot_summary",params):getRma15OpenOtSummarySupabase(params).catch(error=>{console.error("[RMA15] Supabase open OT summary falló",error);throw error;});
export async function getEquipmentHistory({equipo,desde="",hasta=""}){
  if(!String(equipo||"").trim())return{rop02:[],rop05:[],rma15:[]};
  const params={equipo,desde,hasta,limit:"all",offset:0};
  const [rop02,rop05,rma15]=await Promise.all([getRop02(params),getRop05(params),getRma15(params)]);
  return{rop02:rop02.data||[],rop05:rop05.data||[],rma15:rma15.data||[],meta:{rop02,rop05,rma15}};
}
export function clearHistoricalQueryMemory(){memory.clear();pending.clear();}

export function createHistoricalPagedController(){return createPagedController(fetchDatasetPage);}

export async function fetchAllDatasetPages(dataset,params={},onPage){
  if(dataset==="rop02"&&ROP02_SOURCE!=="legacy")return fetchAllRop02Pages(params,onPage);
  if((dataset==="rop05"||dataset==="rma15")&&TYPED_SOURCE!=="legacy")return fetchAllOperationalPages(dataset,params,onPage);
  let offset=0,total=0,hasMore=true;
  while(hasMore){
    const page=await fetchDatasetPage(dataset,{...params,limit:2000,offset});
    const rows=page.data||[];total=Number(page.total||total);hasMore=Boolean(page.hasMore);offset=Number(page.nextOffset||offset+rows.length);
    await onPage(rows,{offset,total,hasMore});
    if(!rows.length)break;
  }
  return{total};
}
