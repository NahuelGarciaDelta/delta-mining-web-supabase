import {requireSupabase} from "./supabaseClient.js";
import {readCachedSource,writeCachedSource,clearDatasetCache} from "./appCache.js";

const CACHE_PREFIX="supabase_taller_movements:";
const TYPES=new Set(["SUBIDA","BAJA","MOVILIZACION","CAMBIO_EQUIPO"]);
const actor=()=>String(sessionStorage.getItem("dm_user")||"APP").trim().toLowerCase()||"APP";
const normalizeType=value=>String(value||"").trim().toUpperCase().replace(/\s+/g,"_");
const cacheKey=type=>`${CACHE_PREFIX}${normalizeType(type)}`;

async function rpc(name,args={}){
  const {data,error}=await requireSupabase().rpc(name,args);
  if(error)throw new Error(error.message||`Supabase ${name}`);
  if(data?.ok===false)throw new Error(data?.error?.message||`No se pudo completar ${name}`);
  return data;
}

export function getCachedTallerMovements(type){
  const expected=normalizeType(type);
  if(!TYPES.has(expected))return[];
  try{
    const raw=localStorage.getItem(cacheKey(expected));
    const parsed=raw?JSON.parse(raw):[];
    return Array.isArray(parsed)?parsed:[];
  }catch(_){return[];}
}

async function persist(type,rows,version=0){
  const key=cacheKey(type);
  try{localStorage.setItem(key,JSON.stringify(rows));}catch(_){}
  await writeCachedSource(key,{ok:true,data:rows,meta:{serverVersion:Number(version||Date.now()),source:"supabase"}}).catch(()=>{});
}

export async function getTallerMovements(type,{force=false}={}){
  const expected=normalizeType(type);
  if(!TYPES.has(expected))throw new Error(`Tipo de movimiento no soportado: ${type}`);
  if(!force){
    const cached=await readCachedSource(cacheKey(expected)).catch(()=>null);
    const rows=cached?.data?.data;
    if(Array.isArray(rows)&&rows.length){
      getTallerMovements(expected,{force:true}).catch(()=>{});
      return rows;
    }
  }
  const res=await rpc("app_taller_movements_snapshot",{p_type:expected,p_active_only:true});
  const rows=Array.isArray(res?.data)?res.data:[];
  await persist(expected,rows,res?.meta?.serverVersion);
  return rows;
}

export async function saveTallerMovement(movement){
  const value=await rpc("app_taller_movement_save",{p_movement:movement||{},p_actor:actor()});
  const type=normalizeType(movement?.tipo);
  if(TYPES.has(type))await clearDatasetCache([cacheKey(type)]).catch(()=>{});
  return value;
}

export async function updateTallerMovement(id,movement){
  return saveTallerMovement({...movement,id:String(id||"")});
}

export async function deleteTallerMovement(id,_usuario){
  const value=await rpc("app_taller_movement_delete",{p_id:String(id||""),p_actor:actor()});
  await clearDatasetCache([...TYPES].map(cacheKey)).catch(()=>{});
  try{for(const type of TYPES)localStorage.removeItem(cacheKey(type));}catch(_){}
  return value;
}
