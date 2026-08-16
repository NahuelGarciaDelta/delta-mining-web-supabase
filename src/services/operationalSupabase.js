import {requireSupabase} from "./supabaseClient.js";

const actor=()=>String(sessionStorage.getItem("dm_user")||"APP").trim().toLowerCase()||"APP";
const rpc=async(name,args={})=>{
  const {data,error}=await requireSupabase().rpc(name,args);
  if(error)throw new Error(error.message||`Supabase ${name}`);
  if(data?.ok===false)throw new Error(data?.error?.message||`No se pudo completar ${name}`);
  return data;
};

export const getPmSnapshot=()=>rpc("app_pm_snapshot");
export const savePmAction=payload=>rpc("app_pm_save",{p_action:String(payload?.action||""),p_payload:payload||{},p_actor:actor()});

export const getLicitacionesSnapshot=()=>rpc("app_licitaciones_snapshot");
export const saveLicitacion=licitacion=>rpc("app_licitacion_save",{p_licitacion:licitacion||{},p_actor:actor()});
export const deleteLicitacion=id=>rpc("app_licitacion_delete",{p_id:String(id||""),p_actor:actor()});

export const getStockSnapshot=()=>rpc("app_stock_snapshot");
export const replaceStock=(meta,rows)=>rpc("app_stock_replace",{p_meta:meta||{},p_rows:Array.isArray(rows)?rows:[],p_actor:actor()});
export const clearStock=()=>rpc("app_stock_clear",{p_actor:actor()});

export const getEquipmentMovementsSnapshot=(activeOnly=false)=>rpc("app_equipment_movements_snapshot",{p_active_only:Boolean(activeOnly)});
export const saveEquipmentMovementSupabase=movement=>rpc("app_equipment_movement_save",{p_movement:movement||{},p_actor:actor()});
export const cancelEquipmentMovementSupabase=id=>rpc("app_equipment_movement_cancel",{p_id:String(id||""),p_actor:actor()});

export const runOperationalWrite=(action,payload={})=>rpc("app_write_action",{p_action:String(action||""),p_payload:payload||{},p_actor:actor()});
export const deleteAbastecimientoRemito=id=>rpc("abastecimiento_delete_remito",{p_id:String(id||""),p_actor:actor()});

export async function getSupabaseHealth(){
  const started=performance.now();
  const {error}=await requireSupabase().from("rop02").select("id",{head:true,count:"exact"}).limit(1);
  if(error)throw new Error(error.message);
  return{ok:true,source:"supabase",latencyMs:Math.round(performance.now()-started),serverTime:new Date().toISOString()};
}
