import {requireSupabase} from "./supabaseClient.js";
import {markCacheHit,markCacheMiss,runDedupedRequest} from "./requestCoordinator.js";

let snapshotCache=null;
let snapshotAt=0;
const SNAPSHOT_TTL_MS=5000;
const SNAPSHOT_REQUEST_KEY="abastecimiento:snapshot";
const actor=()=>String(sessionStorage.getItem("dm_user")||"APP").trim().toLowerCase()||"APP";

export async function getAbastecimientoSnapshot({force=false}={}){
  const now=Date.now();
  if(!force&&snapshotCache&&now-snapshotAt<SNAPSHOT_TTL_MS){
    markCacheHit(SNAPSHOT_REQUEST_KEY,{dataset:"abastecimiento"});
    return snapshotCache;
  }
  markCacheMiss(SNAPSHOT_REQUEST_KEY,{dataset:"abastecimiento",force:Boolean(force)});
  // Incluso un refresh forzado comparte la consulta que ya esté en vuelo. El
  // objetivo de force es saltar la caché resuelta, no duplicar requests.
  return runDedupedRequest(SNAPSHOT_REQUEST_KEY,async()=>{
    const {data,error}=await requireSupabase().rpc("abastecimiento_snapshot",{});
    if(error)throw new Error(`Supabase Abastecimiento: ${error.message}`);
    const value={ok:true,raba03:[],remitos:[],estados:[],...(data||{}),raba03Source:"supabase"};
    snapshotCache=value;
    snapshotAt=Date.now();
    return value;
  },{dataset:"abastecimiento"});
}

export function invalidateAbastecimientoSnapshot(){snapshotCache=null;snapshotAt=0;}

export async function saveAbastecimientoRemito(remito){
  const {data,error}=await requireSupabase().rpc("abastecimiento_save_remito",{p_remito:remito||{}});
  if(error)throw new Error(`No se pudo guardar el remito en Supabase: ${error.message}`);
  invalidateAbastecimientoSnapshot();return data||{ok:true};
}
export async function deleteAbastecimientoRemito(id){
  const {data,error}=await requireSupabase().rpc("abastecimiento_delete_remito",{p_id:String(id||""),p_actor:actor()});
  if(error)throw new Error(`No se pudo eliminar el remito en Supabase: ${error.message}`);
  invalidateAbastecimientoSnapshot();return data||{ok:true};
}
export async function setAbastecimientoEstado(payload){
  const {data,error}=await requireSupabase().rpc("abastecimiento_set_estado",{p_payload:payload||{}});
  if(error)throw new Error(`No se pudo actualizar el estado en Supabase: ${error.message}`);
  invalidateAbastecimientoSnapshot();return data||{ok:true};
}

export async function appendAbastecimientoRaba03(rows){
  const {data,error}=await requireSupabase().rpc("abastecimiento_append_raba03",{p_rows:Array.isArray(rows)?rows:[]});
  if(error)throw new Error(`No se pudieron agregar solicitudes en Supabase: ${error.message}`);
  invalidateAbastecimientoSnapshot();
  return data||{ok:true,insertedRows:0};
}

export async function updateAbastecimientoRaba03(action,rows){
  const normalized=String(action||"").trim().toLowerCase();
  if(!["cant_enviada","codigos"].includes(normalized))throw new Error(`Acción RABA03 no soportada: ${action}`);
  const {data,error}=await requireSupabase().rpc("abastecimiento_update_raba03",{p_action:normalized,p_rows:Array.isArray(rows)?rows:[]});
  if(error)throw new Error(`No se pudo actualizar RABA03 en Supabase: ${error.message}`);
  invalidateAbastecimientoSnapshot();
  return data||{ok:true,updatedRows:0};
}

export async function deleteAbastecimientoRaba03Solicitud(numeroSolicitud){
  const numero=String(numeroSolicitud||"").trim();
  if(!numero)throw new Error("Falta el N° de solicitud a eliminar.");
  const {data,error}=await requireSupabase().rpc("abastecimiento_delete_raba03_solicitud",{
    p_numero_solicitud:numero,p_actor:actor()
  });
  if(error)throw new Error(`No se pudo eliminar la solicitud en Supabase: ${error.message}`);
  invalidateAbastecimientoSnapshot();
  return data||{ok:true,deletedRows:0};
}
