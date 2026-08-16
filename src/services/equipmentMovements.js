import {useCallback,useEffect,useMemo,useState} from "react";
import {readCachedSource,writeCachedSource} from "./appCache.js";
import {registerRefreshTask} from "./refreshManager.js";
import {equipmentProjectKey,normalizeRop02Project} from "../modules/home/homeAvailability.js";
import {getMovimientoVigentePorEquipo,movementsToAtrasoMap,normalizeEquipmentMovementCode} from "./equipmentMovementsDomain.js";
import {getEquipmentMovementsSnapshot,saveEquipmentMovementSupabase,cancelEquipmentMovementSupabase} from "./operationalSupabase.js";

export {getMovimientoVigentePorEquipo,movementsToAtrasoMap} from "./equipmentMovementsDomain.js";

let cache={data:[],loaded:false,loading:null,error:"",version:0};
const listeners=new Set();
const emit=()=>listeners.forEach(listener=>listener(cache));
const CACHE_KEY="movimientos_equipos";
const persistCache_=async(version=0)=>{
  cache={...cache,version:Number(version||cache.version||0)};
  return writeCachedSource(CACHE_KEY,{ok:true,data:cache.data,meta:{serverVersion:cache.version}}).catch(()=>{});
};

export async function loadEquipmentMovements({force=false,revalidate=true}={}){
  if(cache.loading)return cache.loading;
  cache.loading=(async()=>{
    if(!cache.loaded){
      const record=await readCachedSource(CACHE_KEY).catch(()=>null);
      if(record?.data?.ok&&Array.isArray(record.data.data)){
        cache={data:record.data.data,loaded:true,loading:cache.loading,error:"",version:Number(record.data?.meta?.serverVersion||record.version||0)};
        emit();
      }
    }
    if(cache.loaded&&!force&&!revalidate)return cache;
    const response=await getEquipmentMovementsSnapshot(false);
    cache={data:Array.isArray(response?.data)?response.data:[],loaded:true,loading:cache.loading,error:"",version:Number(response?.meta?.serverVersion||Date.now())};
    await persistCache_(cache.version);emit();return cache;
  })().catch(error=>{
    cache={...cache,loaded:true,loading:null,error:error?.message||"No fue posible cargar movimientos de equipos."};emit();
    if(cache.data.length)return cache;
    throw error;
  }).finally(()=>{cache={...cache,loading:null};emit();});
  return cache.loading;
}

export async function saveEquipmentMovement(movement){
  const response=await saveEquipmentMovementSupabase(movement);
  const saved=response?.movement;
  if(saved){
    const next=cache.data.map(item=>item.activo&&item.internoNormalizado===saved.internoNormalizado&&item.proyectoOrigen===saved.proyectoOrigen?{...item,activo:false,estado:"SUPERADO"}:item);
    cache={data:[...next,saved],loaded:true,loading:null,error:"",version:Number(response.version||Date.now())};
    await persistCache_(cache.version);emit();
  }
  return response;
}

export async function cancelEquipmentMovement(id,_usuario){
  const response=await cancelEquipmentMovementSupabase(id);
  cache={data:cache.data.map(item=>String(item.id)===String(id)?{...item,activo:false,estado:"CANCELADO"}:item),loaded:true,loading:null,error:"",version:Number(response.version||Date.now())};
  await persistCache_(cache.version);emit();
  return response;
}

export function useEquipmentMovements(rop02Rows=[],views=[]){
  const[snapshot,setSnapshot]=useState(cache);
  useEffect(()=>{listeners.add(setSnapshot);loadEquipmentMovements().catch(()=>{});return()=>listeners.delete(setSnapshot)},[]);
  useEffect(()=>registerRefreshTask("equipment-movements",()=>loadEquipmentMovements({revalidate:true}),{views,priority:15}),[JSON.stringify(views)]);
  const latestRop02ByEquipmentProject=useMemo(()=>{
    const latest=new Map();
    for(const row of Array.isArray(rop02Rows)?rop02Rows:[]){
      const code=normalizeEquipmentMovementCode(row?.maquina||row?._internoRaw);
      const project=normalizeRop02Project(row?.proyecto||row?.lugar);
      const date=String(row?.fecha||"").slice(0,10);
      const key=equipmentProjectKey(code,project);
      if(code&&project&&date&&(!latest.has(key)||date>latest.get(key)))latest.set(key,date);
    }
    return latest;
  },[rop02Rows]);
  const activeMovementByEquipment=useMemo(()=>getMovimientoVigentePorEquipo(snapshot.data,latestRop02ByEquipmentProject),[snapshot.data,latestRop02ByEquipmentProject]);
  const admitidos=useMemo(()=>movementsToAtrasoMap(activeMovementByEquipment),[activeMovementByEquipment]);
  return{...snapshot,loading:Boolean(snapshot.loading)||!snapshot.loaded,movements:snapshot.data,activeMovementByEquipment,admitidos,reload:useCallback(()=>loadEquipmentMovements({force:true}),[])};
}
