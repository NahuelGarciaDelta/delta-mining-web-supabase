import {isSupabaseConfigured,requireSupabase} from "./supabaseClient.js";
import {getOperationalSource} from "../data/operationalRepository.js";

const TYPED_SUPABASE_SOURCES=new Set([
  "rop02_fs","rop02_jm","rop02_filosur","rop02_zorro",
  "rop05","rma15_fs","rma15_jm","lista_equipos","insumos"
]);

const GENERIC_SUPABASE_SOURCES=new Set([
  "raba03","remitos_cargados","licitaciones_db","licitacion_hitos_db","licitacion_equipos_db",
  "pm_config","pm_registros","movimientos_equipos"
]);

const SPECIAL_CACHE_ACTIONS=Object.freeze({
  mantenimiento_programado:"mantenimiento_programado",
  estados_solicitudes:"estados_solicitudes",
  licitaciones_compartidas:"licitaciones_compartidas",
  stock_excel_status:"stock_excel_status",
  stock_excel_data:"stock_excel_data",
  get_equipment_movements:"equipment_movements_all",
  get_active_equipment_movements:"equipment_movements_active",
});

async function readGenericSourceFromSupabase_(source){
  if(!GENERIC_SUPABASE_SOURCES.has(source)||!isSupabaseConfigured)return null;
  const db=requireSupabase();
  const {data,error}=await db.rpc("read_delta_dataset",{p_dataset:source});
  if(error)throw error;
  const rows=Array.isArray(data)?data:[];
  const latest=rows.reduce((max,row)=>Math.max(max,Number(row?.source_version||0)),0);
  const latestSync=rows.reduce((max,row)=>{
    const t=new Date(row?.synced_at||0).getTime();
    return Number.isFinite(t)?Math.max(max,t):max;
  },0);
  return{
    ok:true,
    source:"supabase",
    data:rows.map(row=>({...((row&&row.row_data)||{}),_sourceRow:row?.source_row,_sourceDataset:source})),
    meta:{source,rows:rows.length,returnedRows:rows.length,serverVersion:latest||latestSync,serverTime:new Date(latestSync||Date.now()).toISOString()},
  };
}

export async function fetchSupabaseCachedAction(action){
  const cacheKey=SPECIAL_CACHE_ACTIONS[action];
  if(!cacheKey||!isSupabaseConfigured)return null;
  const db=requireSupabase();
  const {data,error}=await db.from("delta_special_cache").select("payload,updated_at").eq("cache_key",cacheKey).maybeSingle();
  if(error)throw error;
  if(!data?.payload)return null;
  return{...data.payload,source:"supabase-cache",cacheUpdatedAt:data.updated_at};
}

async function fetchSupabaseVersions_(){
  if(!isSupabaseConfigured)return null;
  const db=requireSupabase();
  const {data,error}=await db.rpc("delta_source_versions");
  if(error)throw error;
  const versions={};
  (data||[]).forEach(row=>{versions[row.source_key]=Number(row.server_version||0);});
  return{ok:true,versions,source:"supabase",serverTime:new Date().toISOString()};
}

export function expandCompactSource(src){
  if(!src||!src.compact||!Array.isArray(src.headers)||!Array.isArray(src.rows))return src;
  return {
    ...src,
    compact:false,
    data:src.rows.map(arr=>{
      const obj={};
      src.headers.forEach((h,i)=>{obj[h]=arr?.[i]??"";});
      return obj;
    })
  };
}

export function expandCompactResponse(json){
  if(!json)return json;
  if(json.compact)return expandCompactSource(json);
  if(json.sources){
    const sources={};
    Object.entries(json.sources).forEach(([key,val])=>{sources[key]=expandCompactSource(val);});
    return {...json,sources};
  }
  return json;
}

export function buildAppsScriptUrl(baseUrl,action,params={}){
  const cleanBase=String(baseUrl||"").trim().replace(/\/+$/,"");
  const u=new URL(cleanBase);
  u.searchParams.set("action",action);
  u.searchParams.set("_t",String(Date.now()));
  Object.entries(params||{}).forEach(([k,v])=>{
    if(v!==undefined&&v!==null&&v!=="")u.searchParams.set(k,String(v));
  });
  return u.toString();
}

export function sleep_(ms){return new Promise(resolve=>setTimeout(resolve,ms));}

function authEndpointLabel(url){
  try{
    const parsed=new URL(String(url||"").trim());
    return `${parsed.origin}/macros/s/[deployment]/exec`;
  }catch(_){
    return "Apps Script (URL invalida)";
  }
}

export async function authenticateUser(url,email,password){
  const endpoint=String(url||"").trim();
  if(!endpoint||/REEMPLAZAR|TU_DEPLOYMENT|YOUR_/i.test(endpoint)){
    throw new Error("VITE_APPS_SCRIPT_URL no contiene un deployment valido de Apps Script.");
  }

  const startedAt=Date.now();
  let response;
  try{
    response=await fetch(endpoint,{
      method:"POST",
      headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
      body:new URLSearchParams({payload:JSON.stringify({action:"authenticate_user",email,password})}),
      cache:"no-store",
      redirect:"follow"
    });
  }catch(error){
    console.error("Error de red al autenticar con Apps Script",{
      endpoint:authEndpointLabel(endpoint),action:"authenticate_user",
      elapsedMs:Date.now()-startedAt,error:error?.name||"NetworkError"
    });
    throw new Error("No se pudo conectar con el servicio de autenticacion de Apps Script.");
  }

  const contentType=response.headers.get("content-type")||"";
  const text=await response.text();
  const isHtml=/^\s*</.test(text)||contentType.toLowerCase().includes("text/html");
  console.info("Respuesta de autenticacion Apps Script",{
    endpoint:authEndpointLabel(endpoint),action:"authenticate_user",
    status:response.status,contentType,isHtml,elapsedMs:Date.now()-startedAt
  });

  if(!response.ok)throw new Error(`Apps Script respondio HTTP ${response.status}.`);
  if(isHtml)throw new Error("Apps Script devolvio HTML en lugar de JSON. Verifica el deployment configurado.");
  let json;
  try{json=JSON.parse(text);}catch(_){throw new Error("Apps Script devolvio una respuesta que no es JSON valido.");}
  return json;
}

export async function runWithConcurrency_(items,limit,worker){
  const results=new Array(items.length);
  let cursor=0;
  const runners=Array.from({length:Math.min(Math.max(1,limit),items.length)},async()=>{
    while(true){
      const index=cursor++;
      if(index>=items.length)return;
      try{results[index]={status:"fulfilled",value:await worker(items[index],index)};}
      catch(reason){results[index]={status:"rejected",reason};}
    }
  });
  await Promise.all(runners);
  return results;
}

async function fetchAppsScriptAction_(url,action,{force=false,compact=true,retries=2,since="",timeoutMs=45000}={}){
  const params={};
  if(force)params.force="1";
  if(since&&!force)params.since=since;
  if(compact&&!['health','diag','clear_cache','sync','versions','get_data_versions'].includes(action))params.compact="1";
  if(action==="rop05")params.limit="all";

  let lastErr=null;
  for(let attempt=0;attempt<=retries;attempt++){
    const controller=typeof AbortController!=="undefined"?new AbortController():null;
    const timer=controller?setTimeout(()=>controller.abort(),timeoutMs):null;
    try{
      const requestUrl=buildAppsScriptUrl(url,action,params);
      const res=await fetch(requestUrl,{cache:"no-store",redirect:"follow",signal:controller?.signal});
      if(!res.ok)throw new Error(`HTTP ${res.status} desde el Apps Script`);
      const text=await res.text();
      let json;
      try{json=JSON.parse(text);}catch(_){throw new Error("El Apps Script devolvió HTML. Verificá que esté publicado como 'Cualquier persona'.");}
      json=expandCompactResponse(json);
      if(!json.ok&&!json.sources)throw new Error(json.error?.message||"Respuesta inválida del Apps Script");
      return json;
    }catch(err){
      lastErr=err?.name==="AbortError"
        ?new Error(`La consulta ${action} superó ${Math.round(timeoutMs/1000)} segundos`)
        :err;
      if(attempt<retries)await sleep_(700*(attempt+1));
    }finally{
      if(timer)clearTimeout(timer);
    }
  }
  throw lastErr;
}

export async function fetchAction(url,action,options={}){
  if(SPECIAL_CACHE_ACTIONS[action]){
    try{
      const cached=await fetchSupabaseCachedAction(action);
      if(cached)return cached;
    }catch(error){console.warn(`[${action}] caché Supabase no disponible; fallback Apps Script`,error);}
  }
  return fetchAppsScriptAction_(url,action,options);
}

export async function fetchHealth(url){return fetchAppsScriptAction_(url,"health",{compact:false});}

export async function fetchSource(url,source,{force=false,since=""}={}){
  if(TYPED_SUPABASE_SOURCES.has(source)&&isSupabaseConfigured){
    try{return await getOperationalSource(source);}
    catch(error){console.warn(`[${source}] Supabase tipado no disponible; fallback Apps Script`,error);}
  }
  if(GENERIC_SUPABASE_SOURCES.has(source)){
    try{
      const value=await readGenericSourceFromSupabase_(source);
      if(value)return value;
    }catch(error){console.warn(`[${source}] Supabase no disponible; fallback Apps Script`,error);}
  }
  return fetchAppsScriptAction_(url,source,{force,compact:true,since});
}

export async function fetchSyncVersions(url){
  try{
    const sync=await fetchSupabaseVersions_();
    if(sync)return sync;
  }catch(error){console.warn("Manifest Supabase no disponible; fallback Apps Script",error);}
  try{return await fetchAppsScriptAction_(url,"get_data_versions",{compact:false,retries:1});}
  catch(_){
    try{return await fetchAppsScriptAction_(url,"sync",{compact:false,retries:1});}
    catch(__){return null;}
  }
}

export async function fetchDatasetQuery(url,params={}){
  const controller=typeof AbortController!=="undefined"?new AbortController():null;
  const timer=controller?setTimeout(()=>controller.abort(),60000):null;
  try{
    const response=await fetch(buildAppsScriptUrl(url,"query_dataset",params),{cache:"no-store",redirect:"follow",signal:controller?.signal});
    if(!response.ok)throw new Error(`HTTP ${response.status} desde Apps Script`);
    const text=await response.text();
    let json;try{json=JSON.parse(text);}catch(_){throw new Error("Apps Script no devolvió JSON válido");}
    if(!json?.ok)throw new Error(json?.error?.message||"Consulta de dataset inválida");
    return{...json,payloadBytes:new Blob([text]).size};
  }finally{if(timer)clearTimeout(timer);}
}
