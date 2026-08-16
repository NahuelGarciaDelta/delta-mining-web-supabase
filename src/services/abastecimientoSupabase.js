import {requireSupabase} from "./supabaseClient.js";

let snapshotPromise=null;
let snapshotCache=null;
let snapshotAt=0;
const SNAPSHOT_TTL_MS=5000;

export async function getAbastecimientoSnapshot({force=false}={}){
  const now=Date.now();
  if(!force&&snapshotCache&&now-snapshotAt<SNAPSHOT_TTL_MS)return snapshotCache;
  if(snapshotPromise&&!force)return snapshotPromise;
  snapshotPromise=(async()=>{
    const {data,error}=await requireSupabase().rpc("abastecimiento_snapshot",{});
    if(error)throw new Error(`Supabase Abastecimiento: ${error.message}`);
    const value=data||{ok:true,raba03:[],remitos:[],estados:[]};
    snapshotCache=value;
    snapshotAt=Date.now();
    return value;
  })();
  try{return await snapshotPromise;
  }finally{snapshotPromise=null;}
}

export function invalidateAbastecimientoSnapshot(){snapshotCache=null;snapshotAt=0;}

export async function saveAbastecimientoRemito(remito){
  const {data,error}=await requireSupabase().rpc("abastecimiento_save_remito",{p_remito:remito||{}});
  if(error)throw new Error(`No se pudo guardar el remito en Supabase: ${error.message}`);
  invalidateAbastecimientoSnapshot();
  return data||{ok:true};
}

export async function setAbastecimientoEstado(payload){
  const {data,error}=await requireSupabase().rpc("abastecimiento_set_estado",{p_payload:payload||{}});
  if(error)throw new Error(`No se pudo actualizar el estado en Supabase: ${error.message}`);
  invalidateAbastecimientoSnapshot();
  return data||{ok:true};
}

export async function appendAbastecimientoRaba03(rows){
  const {data,error}=await requireSupabase().rpc("abastecimiento_append_raba03",{p_rows:Array.isArray(rows)?rows:[]});
  if(error)throw new Error(`No se pudieron agregar solicitudes en Supabase: ${error.message}`);
  invalidateAbastecimientoSnapshot();
  return data||{ok:true,insertedRows:0};
}

export async function updateAbastecimientoRaba03(action,rows){
  const {data,error}=await requireSupabase().rpc("abastecimiento_update_raba03",{p_action:action,p_rows:Array.isArray(rows)?rows:[]});
  if(error)throw new Error(`No se pudo actualizar RABA03 en Supabase: ${error.message}`);
  invalidateAbastecimientoSnapshot();
  return data||{ok:true,updatedRows:0};
}
