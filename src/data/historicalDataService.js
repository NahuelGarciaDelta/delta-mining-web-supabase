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
const HISTORICAL_UPDATED_EVENT="dm-historical-dataset-updated";
const COMMON_HISTORICAL_QUERY=Object.freeze({limit:"all",offset:0,sortBy:"fecha",sortDirection:"desc"});

function remember_(key,value){
  memory.delete(key);memory.set(key,value);
  while(memory.size>MAX_MEMORY_QUERIES)memory.delete(memory.keys().next().value);
}

function notifyDatasetUpdated_(dataset,key,value,params){
  if(typeof window==="undefined"||typeof window.dispatchEvent!=="function")return;
  try{window.dispatchEvent(new CustomEvent(HISTORICAL_UPDATED_EVENT,{detail:{dataset,key,value,params:{...(params||{})}}}));}catch(_){}
}

export async function readDatasetQuery(dataset,params={}){
  const key=buildDatasetQueryKey(dataset,params);
  if(memory.has(key)){const value=memory.get(key);remember_(key,value);return{...value,cacheHit:true,cacheLevel:"memory"};}
  const record=await readCachedSource(`query:${key}`).catch(()=>null);
  if(record?.data?.ok){remember_(key,record.data);return{...record.data,cacheHit:true,cacheLevel:"indexeddb",cacheUpdatedAt:record.updatedAt||null};}
  return null;
}

export async function fetchDatasetPage(dataset,params={}){
  const key=buildDatasetQueryKey(dataset,params);
  if(pending.has(key))return pending.get(key);
  const started=performance.now();
  const supabaseRop02Request=()=>params.limit==="all"?(async()=>{const data=[];const meta=await fetchAllRop02Pages(params,page=>data.push(...page));return{ok:true,data,rows:data.length,total:meta.total,hasMore:false,nextOffset:null,source:"supabase"};})():getRop02Page({...params,limit:params.limit||250,offset:params.offset||0});
  const typedGetter=dataset==="rop05"?getRop05Page:dataset==="rma15"?getRma15Page:null;
  if(dataset!=="rop02"&&!typedGetter)throw new Error(`Dataset histórico no soportado por Supabase: ${dataset}`);
  const network=dataset==="rop02"?supabaseRop02Request():typedGetter(params);
  const task=network.then(async response=>{
    const value={...response,cacheHit:false,cacheLevel:"network",elapsedMs:Math.round(performance.now()-started)};
    remember_(key,value);
    await writeCachedSource(`query:${key}`,value);
    notifyDatasetUpdated_(dataset,key,value,params);
    return value;
  }).finally(()=>{if(pending.get(key)===task)pending.delete(key);});
  pending.set(key,task);return task;
}

export async function getDataset(dataset,params={}){
  const cached=await readDatasetQuery(dataset,params);
  if(cached){
    fetchDatasetPage(dataset,params).catch(()=>{});
    return cached;
  }
  return fetchDatasetPage(dataset,params);
}

export const getRop02=params=>getDataset("rop02",params);
export const getRop05=params=>getDataset("rop05",params);
export const getRma15=params=>getDataset("rma15",params);
export const refreshHistoricalDataset=(dataset,params={})=>fetchDatasetPage(dataset,params);
export const HISTORICAL_DATASET_UPDATED_EVENT=HISTORICAL_UPDATED_EVENT;

export async function refreshCommonHistoricalDatasets(){
  return Promise.allSettled([
    fetchDatasetPage("rop02",COMMON_HISTORICAL_QUERY),
    fetchDatasetPage("rop05",COMMON_HISTORICAL_QUERY),
    fetchDatasetPage("rma15",COMMON_HISTORICAL_QUERY),
  ]);
}

function fullOperationalWindowParams_(params={}){
  const days=Math.max(1,Number(params.days)||7);
  const hasExplicitRange=Boolean(params.desde||params.hasta);
  if(days>=45&&!hasExplicitRange){
    const {days:_days,snapshot:_snapshot,...rest}=params;
    return{...rest,limit:"all",sortBy:"fecha",sortDirection:"asc"};
  }
  const endIso=String(params.hasta||"").slice(0,10);
  const end=endIso?new Date(`${endIso}T12:00:00`):new Date();
  const start=new Date(end);
  start.setDate(start.getDate()-(days-1));
  const ymd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  return{
    ...params,
    desde:params.desde||ymd(start),
    hasta:params.hasta||ymd(end),
    limit:"all",
    sortBy:"fecha",
    sortDirection:"asc",
  };
}

export const getRop02LatestByEquipmentProject=params=>getLatestRop02ByEquipment(params);
export const getRop02MonthlySummary=params=>getSupabaseMonthlySummary(params);
export const getRop02OperationalSnapshot=params=>{
  const p=params||{};
  if(p.snapshot||(Number(p.days)||7)>7)return getDataset("rop02",fullOperationalWindowParams_(p));
  return getSupabaseOperationalSnapshot(p);
};
export const getRop02Stats=params=>getSupabaseRop02Stats(params);
export const getRop02Facets=params=>getSupabaseRop02Facets(params);
export const getRop02Rop05Control=params=>getSupabaseRop02Rop05Control(params);
export const getRma15EquipmentUniverse=params=>getRma15EquipmentUniverseSupabase(params);
export async function getRma15OpenOtSummary(params={}){
  const response=await getRma15OpenOtSummarySupabase(params);
  // Igual que la app original: un resumen vacío no reemplaza el cálculo local
  // sobre RMA15 completo. Se fuerza el fallback de Bienvenida.
  if(!Array.isArray(response?.data)||response.data.length===0){
    throw new Error("Resumen de OT abiertas vacío; recalcular desde RMA15 completo");
  }
  return response;
}

export async function getEquipmentHistory({equipo,desde="",hasta=""}){
  if(!String(equipo||"").trim())return{rop02:[],rop05:[],rma15:[]};
  const params={equipo,desde,hasta,limit:"all",offset:0};
  const [rop02,rop05,rma15]=await Promise.all([getRop02(params),getRop05(params),getRma15(params)]);
  return{rop02:rop02.data||[],rop05:rop05.data||[],rma15:rma15.data||[],meta:{rop02,rop05,rma15}};
}
export function clearHistoricalQueryMemory(){memory.clear();pending.clear();}

export function createHistoricalPagedController(){return createPagedController(fetchDatasetPage);}

export async function fetchAllDatasetPages(dataset,params={},onPage){
  if(dataset==="rop02")return fetchAllRop02Pages(params,onPage);
  if(dataset==="rop05"||dataset==="rma15")return fetchAllOperationalPages(dataset,params,onPage);
  let offset=0,total=0,hasMore=true;
  while(hasMore){
    const page=await fetchDatasetPage(dataset,{...params,limit:2000,offset});
    const rows=page.data||[];total=Number(page.total||total);hasMore=Boolean(page.hasMore);offset=Number(page.nextOffset||offset+rows.length);
    await onPage(rows,{offset,total,hasMore});
    if(!rows.length)break;
  }
  return{total};
}
