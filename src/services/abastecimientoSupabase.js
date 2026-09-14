import {requireSupabase} from "./supabaseClient.js";
import {clearDatasetCache} from "./appCache.js";

let snapshotPromise=null;
let snapshotCache=null;
let snapshotAt=0;
const SNAPSHOT_TTL_MS=5000;
const RABA03_LOCAL_CACHE_KEY="abastecimiento_raba03_rows_v1";
const RABA03_SHEET_API_URL=String(
  (typeof import.meta!=="undefined"&&import.meta.env?.VITE_RABA03_APPS_SCRIPT_URL)||
  "https://script.google.com/macros/s/AKfycbxU-ihsxXTNn2wa5EO1OkSM5FjJ43MwxSx8dY0RjbnJRFBKF0BiNNq7QsuohWxmmeOhog/exec"
).trim();
const actor=()=>String(sessionStorage.getItem("dm_user")||"APP").trim().toLowerCase()||"APP";

async function parseSheetResponse_(response,label){
  const text=await response.text();
  let json;
  try{json=JSON.parse(text);}catch(_){throw new Error(`${label}: Google Apps Script devolvió una respuesta no JSON.`);}
  if(!response.ok||!json?.ok)throw new Error(json?.error?.message||`${label}: no se pudo completar la operación en Google Sheet.`);
  return json;
}

async function postRaba03ToGoogleSheet_(payload){
  const response=await fetch(RABA03_SHEET_API_URL,{
    method:"POST",cache:"no-store",redirect:"follow",
    headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
    body:new URLSearchParams({payload:JSON.stringify(payload||{})}).toString()
  });
  return parseSheetResponse_(response,"RABA03");
}

export async function getAbastecimientoSnapshot({force=false}={}){
  const now=Date.now();
  if(!force&&snapshotCache&&now-snapshotAt<SNAPSHOT_TTL_MS)return snapshotCache;
  if(snapshotPromise&&!force)return snapshotPromise;
  snapshotPromise=(async()=>{
    // La planilla sigue siendo el origen que sincroniza RABA03, pero la app lee
    // el espejo completo desde Supabase. El endpoint de Apps Script puede paginar
    // a 1000 filas; usar abastecimiento_snapshot evita truncar solicitudes cuando
    // el dataset supera ese límite y mantiene los contadores iguales a OPS.
    const {data,error}=await requireSupabase().rpc("abastecimiento_snapshot",{});
    if(error)throw new Error(`Supabase Abastecimiento: ${error.message}`);
    const value={...(data||{}),ok:true,raba03Source:"supabase"};
    snapshotCache=value;
    snapshotAt=Date.now();
    clearDatasetCache(RABA03_LOCAL_CACHE_KEY).catch(()=>{});
    return value;
  })();
  try{return await snapshotPromise;}finally{snapshotPromise=null;}
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

// Las escrituras RABA03 continúan confirmándose contra Sheets en esta rama mínima;
// el Apps Script instalado replica después el estado hacia Supabase.
export async function appendAbastecimientoRaba03(rows){
  const json=await postRaba03ToGoogleSheet_({
    action:"add_raba03_rows_append_only",
    rows:Array.isArray(rows)?rows:[]
  });
  invalidateAbastecimientoSnapshot();
  clearDatasetCache(RABA03_LOCAL_CACHE_KEY).catch(()=>{});
  return json||{ok:true,insertedRows:0};
}

export async function updateAbastecimientoRaba03(action,rows){
  const normalized=String(action||"").trim().toLowerCase();
  const appScriptAction=normalized==="cant_enviada"
    ?"save_raba03_cant_enviada"
    :normalized==="codigos"
      ?"save_raba03_codigos"
      :"";
  if(!appScriptAction)throw new Error(`Acción RABA03 no soportada: ${action}`);
  const json=await postRaba03ToGoogleSheet_({
    action:appScriptAction,
    rows:Array.isArray(rows)?rows:[]
  });
  invalidateAbastecimientoSnapshot();
  clearDatasetCache(RABA03_LOCAL_CACHE_KEY).catch(()=>{});
  return json||{ok:true,updatedRows:0};
}

export async function deleteAbastecimientoRaba03Solicitud(numeroSolicitud){
  const json=await postRaba03ToGoogleSheet_({
    action:"delete_raba03_solicitud_numero",
    numeroSolicitud:String(numeroSolicitud||"").trim()
  });
  invalidateAbastecimientoSnapshot();
  clearDatasetCache(RABA03_LOCAL_CACHE_KEY).catch(()=>{});
  return json||{ok:true,deletedRows:0};
}
