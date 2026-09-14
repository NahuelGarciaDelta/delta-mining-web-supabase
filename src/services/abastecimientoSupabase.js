import {requireSupabase} from "./supabaseClient.js";
import {clearDatasetCache} from "./appCache.js";
import {getAuthContext} from "./authSession.js";

let snapshotPromise=null;
let snapshotCache=null;
let snapshotAt=0;
const SNAPSHOT_TTL_MS=5000;
const RABA03_LOCAL_CACHE_KEY="abastecimiento_raba03_rows_v1";

const authToken_=()=>{
  const token=String(getAuthContext()?.authToken||"").trim();
  if(!token)throw new Error("La sesión no es válida. Volvé a iniciar sesión.");
  return token;
};

async function rpc_(name,args,label){
  const {data,error}=await requireSupabase().rpc(name,args||{});
  if(error)throw new Error(`${label||name}: ${error.message}`);
  return data||{ok:true};
}

export async function getAbastecimientoSnapshot({force=false}={}){
  const now=Date.now();
  if(!force&&snapshotCache&&now-snapshotAt<SNAPSHOT_TTL_MS)return snapshotCache;
  if(snapshotPromise&&!force)return snapshotPromise;
  snapshotPromise=(async()=>{
    const value=await rpc_("abastecimiento_snapshot",{},"Supabase Abastecimiento");
    const normalized={...value,ok:true,raba03Source:"supabase"};
    snapshotCache=normalized;
    snapshotAt=Date.now();
    clearDatasetCache(RABA03_LOCAL_CACHE_KEY).catch(()=>{});
    return normalized;
  })();
  try{return await snapshotPromise;}finally{snapshotPromise=null;}
}

export function invalidateAbastecimientoSnapshot(){
  snapshotCache=null;
  snapshotAt=0;
}

export async function saveAbastecimientoRemito(remito){
  const data=await rpc_("abastecimiento_save_remito_v2",{
    p_remito:remito||{},
    p_auth_token:authToken_()
  },"No se pudo guardar el remito en Supabase");
  invalidateAbastecimientoSnapshot();
  return data;
}

export async function deleteAbastecimientoRemito(id){
  const data=await rpc_("abastecimiento_delete_remito_v2",{
    p_id:String(id||""),
    p_auth_token:authToken_()
  },"No se pudo eliminar el remito en Supabase");
  invalidateAbastecimientoSnapshot();
  return data;
}

export async function setAbastecimientoEstado(payload){
  const data=await rpc_("abastecimiento_set_estado_v2",{
    p_payload:payload||{},
    p_auth_token:authToken_()
  },"No se pudo actualizar el estado en Supabase");
  invalidateAbastecimientoSnapshot();
  return data;
}

export async function appendAbastecimientoRaba03(rows){
  const data=await rpc_("abastecimiento_append_raba03_v2",{
    p_rows:Array.isArray(rows)?rows:[],
    p_auth_token:authToken_()
  },"No se pudieron agregar solicitudes RABA03 en Supabase");
  invalidateAbastecimientoSnapshot();
  clearDatasetCache(RABA03_LOCAL_CACHE_KEY).catch(()=>{});
  return data;
}

export async function updateAbastecimientoRaba03(action,rows){
  const normalized=String(action||"").trim().toLowerCase();
  if(!["cant_enviada","codigos"].includes(normalized)){
    throw new Error(`Acción RABA03 no soportada: ${action}`);
  }
  const data=await rpc_("abastecimiento_update_raba03_v2",{
    p_action:normalized,
    p_rows:Array.isArray(rows)?rows:[],
    p_auth_token:authToken_()
  },"No se pudo actualizar RABA03 en Supabase");
  invalidateAbastecimientoSnapshot();
  clearDatasetCache(RABA03_LOCAL_CACHE_KEY).catch(()=>{});
  return data;
}

export async function deleteAbastecimientoRaba03Solicitud(numeroSolicitud){
  const numero=String(numeroSolicitud||"").trim();
  if(!numero)throw new Error("Indicá el N° de solicitud a eliminar.");
  const data=await rpc_("abastecimiento_delete_raba03_solicitud_v2",{
    p_numero_solicitud:numero,
    p_auth_token:authToken_()
  },"No se pudo eliminar la solicitud RABA03 en Supabase");
  invalidateAbastecimientoSnapshot();
  clearDatasetCache(RABA03_LOCAL_CACHE_KEY).catch(()=>{});
  return data;
}
