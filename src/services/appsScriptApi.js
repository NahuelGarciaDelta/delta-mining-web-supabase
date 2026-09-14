import {isSupabaseConfigured,requireSupabase} from "./supabaseClient.js";
import {getOperationalSource} from "../data/operationalRepository.js";
import {getAuthContext} from "./authSession.js";

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

const authToken_=()=>{
  const token=String(getAuthContext()?.authToken||"").trim();
  if(!token)throw new Error("La sesión no es válida. Volvé a iniciar sesión.");
  return token;
};

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
  if(!isSupabaseConfigured)return null;
  const db=requireSupabase();
  if(action==="mantenimiento_programado"){
    const {data,error}=await db.rpc("app_pm_snapshot",{});if(error)throw error;return data;
  }
  if(action==="licitaciones_compartidas"){
    const {data,error}=await db.rpc("app_licitaciones_snapshot",{});if(error)throw error;return data;
  }
  if(action==="stock_excel_status"||action==="stock_excel_data"){
    const {data,error}=await db.rpc("app_stock_snapshot",{});if(error)throw error;
    return action==="stock_excel_status"?{ok:true,meta:data?.meta||{active:false},source:"supabase"}:{...data,source:"supabase"};
  }
  if(action==="get_equipment_movements"||action==="get_active_equipment_movements"){
    const {data,error}=await db.rpc("app_equipment_movements_snapshot",{p_active_only:action==="get_active_equipment_movements"});if(error)throw error;return data;
  }
  if(action==="estados_solicitudes"){
    const {data,error}=await db.rpc("abastecimiento_snapshot",{});if(error)throw error;return{ok:true,data:data?.estados||[],source:"supabase"};
  }
  const cacheKey=SPECIAL_CACHE_ACTIONS[action];
  if(!cacheKey)return null;
  const {data,error}=await db.from("delta_special_cache").select("payload,updated_at").eq("cache_key",cacheKey).maybeSingle();
  if(error)throw error;if(!data?.payload)return null;return{...data.payload,source:"supabase-cache",cacheUpdatedAt:data.updated_at};
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

export async function authenticateUser(_url,email,password){
  const {data,error}=await requireSupabase().rpc("app_authenticate_user",{p_email:String(email||""),p_password:String(password||"")});
  if(error)throw new Error(`Supabase app_authenticate_user: ${error.message}`);
  return data||{ok:false,error:{message:"Respuesta de autenticación inválida."}};
}

export async function updateUserProfile(_url,{currentPassword="",newPassword="",nombre="",area=""}={}){
  const {data,error}=await requireSupabase().rpc("app_update_user_profile_v2",{
    p_current_password:String(currentPassword||""),p_new_password:String(newPassword||""),p_nombre:String(nombre||""),p_area:String(area||""),p_auth_token:authToken_()
  });
  if(error)throw new Error(`Supabase app_update_user_profile_v2: ${error.message}`);
  return data||{ok:false,error:{message:"Respuesta de perfil inválida."}};
}

async function fetchSupabaseSource_(source){
  if(SPECIAL_CACHE_ACTIONS[source]){
    const value=await fetchSupabaseCachedAction(source);
    if(value)return value;
  }
  if(TYPED_SUPABASE_SOURCES.has(source))return getOperationalSource(source);
  if(GENERIC_SUPABASE_SOURCES.has(source)){
    const value=await readGenericSourceFromSupabase_(source);
    if(value)return value;
  }
  throw new Error(`Acción ${source} no está disponible en Supabase.`);
}

export const fetchAction=async(_url,action,_options={})=>fetchSupabaseSource_(action);

export async function fetchHealth(_url){
  if(!isSupabaseConfigured)return{ok:false,source:"supabase",error:{message:"Supabase no configurado"}};
  const started=performance.now();const {error}=await requireSupabase().from("rop02").select("id",{head:true,count:"exact"}).limit(1);
  if(error)throw error;return{ok:true,source:"supabase",latencyMs:Math.round(performance.now()-started),serverTime:new Date().toISOString()};
}

export const fetchSource=async(_url,source,_options={})=>fetchSupabaseSource_(source);

export async function fetchSyncVersions(_url){
  try{return await fetchSupabaseVersions_();}
  catch(error){console.warn("Manifest Supabase no disponible",error);return null;}
}

export async function fetchDatasetQuery(_url,_params={}){throw new Error("Las consultas históricas se resuelven con los repositorios Supabase.");}
