import {fetchSupabaseCachedAction} from "./appsScriptApi.js";
import {isSupabaseConfigured,requireSupabase} from "./supabaseClient.js";

const CACHE_ACTIONS=new Set([
  "mantenimiento_programado",
  "estados_solicitudes",
  "licitaciones_compartidas",
  "stock_excel_status",
  "stock_excel_data",
  "get_equipment_movements",
  "get_active_equipment_movements",
]);
const DATASET_ACTIONS=new Set([
  "raba03","remitos_cargados","licitaciones_db","licitacion_hitos_db","licitacion_equipos_db",
  "pm_config","pm_registros","movimientos_equipos"
]);

let installed=false;

function requestInfo(input,init={}){
  const method=String(init?.method||(input instanceof Request?input.method:"GET")||"GET").toUpperCase();
  const raw=input instanceof Request?input.url:String(input||"");
  try{
    const url=new URL(raw,window.location.href);
    return{method,url,action:String(url.searchParams.get("action")||"").trim().toLowerCase()};
  }catch(_){return{method,url:null,action:""};}
}

function isAppsScriptRead({method,url,action}){
  if(method!=="GET"||!url||(!CACHE_ACTIONS.has(action)&&!DATASET_ACTIONS.has(action)))return false;
  return url.hostname==="script.google.com"&&url.pathname.includes("/macros/s/");
}

async function datasetPayload_(dataset){
  if(!isSupabaseConfigured)return null;
  const db=requireSupabase();
  const {data,error}=await db.rpc("read_delta_dataset",{p_dataset:dataset});
  if(error)throw error;
  const records=Array.isArray(data)?data:[];
  const rows=records.map(row=>({...((row&&row.row_data)||{}),_sourceRow:row?.source_row,_sourceDataset:dataset}));
  const serverVersion=records.reduce((max,row)=>Math.max(max,Number(row?.source_version||0)),0);
  return{ok:true,fromCache:false,source:"supabase",meta:{source:dataset,rows:rows.length,returnedRows:rows.length,offset:0,limit:null,hasMore:false,nextOffset:null,serverVersion,serverTime:new Date().toISOString()},data:rows};
}

export function installSupabaseReadBridge(){
  if(installed||typeof window==="undefined"||typeof window.fetch!=="function")return;
  installed=true;
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    const info=requestInfo(input,init);
    if(isAppsScriptRead(info)){
      try{
        const payload=CACHE_ACTIONS.has(info.action)
          ?await fetchSupabaseCachedAction(info.action)
          :await datasetPayload_(info.action);
        if(payload){
          return new Response(JSON.stringify(payload),{
            status:200,
            headers:{"Content-Type":"application/json;charset=UTF-8","X-Delta-Source":"supabase"},
          });
        }
      }catch(error){
        console.warn(`[${info.action}] no se pudo leer Supabase; se usa Apps Script`,error);
      }
    }
    return nativeFetch(input,init);
  };
}
