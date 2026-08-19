import {requireSupabase} from "./supabaseClient.js";
import {readCachedSource,writeCachedSource,clearDatasetCache} from "./appCache.js";

const CACHE_PREFIX="supabase_taller_movements:";
const TYPES=["SUBIDA","BAJA","MOVILIZACION","CAMBIO_EQUIPO"];
const actor=()=>String(sessionStorage.getItem("dm_user")||"APP").trim().toLowerCase()||"APP";
const normalizeType=value=>String(value||"").trim().toUpperCase().replace(/\s+/g,"_");
const text=value=>String(value||"").trim().toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const cacheKey=type=>`${CACHE_PREFIX}${normalizeType(type)}`;

async function rpc(name,args={}){
  const {data,error}=await requireSupabase().rpc(name,args);
  if(error)throw new Error(error.message||`Supabase ${name}`);
  if(data?.ok===false)throw new Error(data?.error?.message||`No se pudo completar ${name}`);
  return data;
}

function classifyMovement(row){
  const explicit=normalizeType(row?.TIPO||row?.tipo||row?.TIPO_MOVIMIENTO||row?.tipoMovimiento);
  const motivo=text(row?.MOTIVO||row?.motivo);
  const observacion=text(row?.OBSERVACION||row?.observacion);
  const combined=`${motivo} ${observacion}`;
  const incoming=String(row?.INTERNO_ENTRA||row?.internoEntra||row?.EQUIPO_ENTRA||row?.equipoEntra||"").trim();
  const destino=text(row?.PROYECTO_DESTINO||row?.proyectoDestino);
  if(incoming||combined.includes("CAMBIO_EQUIPO")||combined.includes("TALLER_CAMBIO_EQUIPO")||combined.includes("SE CAMBIA EQUIPO")||combined.includes("CAMBIA EQUIPO POR"))return "CAMBIO_EQUIPO";
  if(combined.includes("SE BAJA")||combined.includes("TALLER_BAJA")||explicit==="BAJA")return "BAJA";
  if(combined.includes("SE MOVILIZA")||combined.includes("MOVILIZACION")||combined.includes("TALLER_MOVILIZACION"))return "MOVILIZACION";
  if(combined.includes("SUBIDA DE EQUIPO")||combined.includes("TALLER_SUBIDA")||explicit==="SUBIDA")return "SUBIDA";
  if(TYPES.includes(explicit))return explicit;
  if(destino==="SAN JUAN")return "BAJA";
  return "";
}

function normalizeMovement(row){const type=classifyMovement(row);return{...row,TIPO:type};}

export function getCachedTallerMovements(type){
  const expected=normalizeType(type);
  if(!TYPES.includes(expected))return[];
  try{
    const parsed=JSON.parse(localStorage.getItem(cacheKey(expected))||"[]");
    return Array.isArray(parsed)?parsed.map(normalizeMovement).filter(row=>row.TIPO===expected):[];
  }catch(_){return[];}
}

async function persist(type,rows,version=0){
  const key=cacheKey(type);
  try{localStorage.setItem(key,JSON.stringify(rows));}catch(_){}
  await writeCachedSource(key,{ok:true,data:rows,meta:{serverVersion:Number(version||Date.now()),source:"supabase"}}).catch(()=>{});
}

export async function getAllTallerMovements({force=false}={}){
  if(!force){
    const cached=TYPES.flatMap(getCachedTallerMovements);
    if(cached.length){getAllTallerMovements({force:true}).catch(()=>{});return cached;}
  }
  const res=await rpc("app_taller_movements_snapshot",{p_type:null,p_active_only:true});
  const rows=(Array.isArray(res?.data)?res.data:[]).map(normalizeMovement).filter(row=>row.TIPO);
  await Promise.all(TYPES.map(type=>persist(type,rows.filter(row=>row.TIPO===type),res?.meta?.serverVersion)));
  return rows;
}

export async function getTallerMovements(type,{force=false}={}){
  const expected=normalizeType(type);
  if(!TYPES.includes(expected))throw new Error(`Tipo de movimiento no soportado: ${type}`);
  if(!force){
    const cached=await readCachedSource(cacheKey(expected)).catch(()=>null);
    const rows=cached?.data?.data;
    if(Array.isArray(rows)&&rows.length){getTallerMovements(expected,{force:true}).catch(()=>{});return rows.map(normalizeMovement).filter(row=>row.TIPO===expected);}
  }
  const res=await rpc("app_taller_movements_snapshot",{p_type:expected,p_active_only:true});
  const rows=(Array.isArray(res?.data)?res.data:[]).map(normalizeMovement).filter(row=>row.TIPO===expected);
  await persist(expected,rows,res?.meta?.serverVersion);
  return rows;
}

async function invalidate(type){
  const keys=type&&TYPES.includes(normalizeType(type))?[normalizeType(type)]:TYPES;
  await clearDatasetCache(keys.map(cacheKey)).catch(()=>{});
  try{keys.forEach(t=>localStorage.removeItem(cacheKey(t)));}catch(_){}
}

export async function saveTallerMovement(movement){
  const value=await rpc("app_taller_movement_save",{p_movement:movement||{},p_actor:actor()});
  await invalidate(movement?.tipo);
  return value;
}
export async function updateTallerMovement(id,movement){return saveTallerMovement({...movement,id:String(id||"")});}
export async function deleteTallerMovement(id,_usuario){
  const value=await rpc("app_taller_movement_delete",{p_id:String(id||""),p_actor:actor()});
  await invalidate();return value;
}
