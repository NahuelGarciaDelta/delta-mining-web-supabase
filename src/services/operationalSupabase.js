import {requireSupabase} from "./supabaseClient.js";
import {clearDatasetCache,readCachedSource,writeCachedSource} from "./appCache.js";

const actor=()=>String(sessionStorage.getItem("dm_user")||"APP").trim().toLowerCase()||"APP";
const snapshotPending=new Map();
const SNAPSHOT_PREFIX="supabase_snapshot:";

const rpc=async(name,args={})=>{
  const {data,error}=await requireSupabase().rpc(name,args);
  if(error)throw new Error(error.message||`Supabase ${name}`);
  if(data?.ok===false)throw new Error(data?.error?.message||`No se pudo completar ${name}`);
  return data;
};

async function fetchSnapshot_(cacheKey,name,args={}){
  const fullKey=SNAPSHOT_PREFIX+cacheKey;
  if(snapshotPending.has(fullKey))return snapshotPending.get(fullKey);
  const task=rpc(name,args).then(async data=>{
    await writeCachedSource(fullKey,{ok:true,data,meta:{updatedAt:new Date().toISOString(),source:"supabase"}}).catch(()=>{});
    return data;
  }).finally(()=>snapshotPending.delete(fullKey));
  snapshotPending.set(fullKey,task);
  return task;
}

async function cachedSnapshot_(cacheKey,name,args={},options={}){
  const force=Boolean(options?.force);
  const fullKey=SNAPSHOT_PREFIX+cacheKey;
  if(!force){
    const cached=await readCachedSource(fullKey).catch(()=>null);
    if(cached?.data?.ok&&cached.data.data!==undefined){
      // Apertura inmediata con la última copia válida y refresh silencioso detrás.
      fetchSnapshot_(cacheKey,name,args).catch(()=>{});
      return cached.data.data;
    }
  }
  return fetchSnapshot_(cacheKey,name,args);
}

async function invalidate_(keys){
  const full=(Array.isArray(keys)?keys:[keys]).filter(Boolean).map(key=>SNAPSHOT_PREFIX+key);
  if(full.length)await clearDatasetCache(full).catch(()=>{});
}

export const getPmSnapshot=options=>cachedSnapshot_("pm","app_pm_snapshot",{},options);
export const savePmAction=async payload=>{
  const value=await rpc("app_pm_save",{p_action:String(payload?.action||""),p_payload:payload||{},p_actor:actor()});
  await invalidate_("pm");return value;
};

export const getLicitacionesSnapshot=options=>cachedSnapshot_("licitaciones","app_licitaciones_snapshot",{},options);
export const saveLicitacion=async licitacion=>{
  const value=await rpc("app_licitacion_save",{p_licitacion:licitacion||{},p_actor:actor()});
  await invalidate_("licitaciones");return value;
};
export const deleteLicitacion=async id=>{
  const value=await rpc("app_licitacion_delete",{p_id:String(id||""),p_actor:actor()});
  await invalidate_("licitaciones");return value;
};

export const getStockSnapshot=options=>cachedSnapshot_("stock","app_stock_snapshot",{},options);
export const replaceStock=async(meta,rows)=>{
  const value=await rpc("app_stock_replace",{p_meta:meta||{},p_rows:Array.isArray(rows)?rows:[],p_actor:actor()});
  await invalidate_("stock");return value;
};
export const clearStock=async()=>{
  const value=await rpc("app_stock_clear",{p_actor:actor()});
  await invalidate_("stock");return value;
};

export const getEquipmentMovementsSnapshot=(activeOnly=false,options)=>cachedSnapshot_(`movimientos:${activeOnly?"active":"all"}`,"app_equipment_movements_snapshot",{p_active_only:Boolean(activeOnly)},options);
export const saveEquipmentMovementSupabase=async movement=>{
  const value=await rpc("app_equipment_movement_save",{p_movement:movement||{},p_actor:actor()});
  await invalidate_(["movimientos:active","movimientos:all"]);return value;
};
export const cancelEquipmentMovementSupabase=async id=>{
  const value=await rpc("app_equipment_movement_cancel",{p_id:String(id||""),p_actor:actor()});
  await invalidate_(["movimientos:active","movimientos:all"]);return value;
};

export const runOperationalWrite=(action,payload={})=>rpc("app_write_action",{p_action:String(action||""),p_payload:payload||{},p_actor:actor()});
export const deleteAbastecimientoRemito=id=>rpc("abastecimiento_delete_remito",{p_id:String(id||""),p_actor:actor()});

export async function preloadOperationalSnapshots(){
  await Promise.allSettled([
    getPmSnapshot(),
    getLicitacionesSnapshot(),
    getStockSnapshot(),
    getEquipmentMovementsSnapshot(false),
    getEquipmentMovementsSnapshot(true),
  ]);
}

export async function getSupabaseHealth(){
  const started=performance.now();
  const {error}=await requireSupabase().from("rop02").select("id",{head:true,count:"exact"}).limit(1);
  if(error)throw new Error(error.message);
  return{ok:true,source:"supabase",latencyMs:Math.round(performance.now()-started),serverTime:new Date().toISOString()};
}
