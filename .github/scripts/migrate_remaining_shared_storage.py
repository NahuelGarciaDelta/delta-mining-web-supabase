from pathlib import Path

def replace_once(path, old, new):
    p=Path(path); s=p.read_text(encoding='utf-8')
    if old not in s: raise SystemExit(f'Pattern missing: {path}: {old[:100]!r}')
    p.write_text(s.replace(old,new,1),encoding='utf-8')

# PM: Supabase directo para lectura y escritura.
p='src/modules/mantenimiento/MantenimientoProgramadoView.jsx'
replace_once(p,'import { APPS_SCRIPT_URL as DEFAULT_APPS_SCRIPT_URL } from "../../config/app.js";','import {getPmSnapshot,savePmAction} from "../../services/operationalSupabase.js";')
replace_once(p,'  const { C, Card, Badge, StatCard, MultiSel, LoadingMotoniveladora, APPS_SCRIPT_URL: injectedAppsScriptUrl, appAlert, appConfirm } = deps;\n  const APPS_SCRIPT_URL = injectedAppsScriptUrl || DEFAULT_APPS_SCRIPT_URL;','  const { C, Card, Badge, StatCard, MultiSel, LoadingMotoniveladora, appAlert, appConfirm } = deps;')
old='''  const post = useCallback(async payload => {
    if (readOnly) throw new Error("Modo solo lectura: no tiene permiso para modificar Mantenimiento Programado.");
    if (!APPS_SCRIPT_URL) throw new Error("No está configurada la URL del Apps Script.");
    const body = new URLSearchParams({ payload: JSON.stringify(payload) });
    const response = await fetch(APPS_SCRIPT_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" }, body });
    const json = await readJsonResponse(response, "Guardado PM");
    if (!json?.ok) throw new Error(json?.error?.message || "No se pudo guardar.");
    return json;
  }, [APPS_SCRIPT_URL, readOnly]);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      if (!APPS_SCRIPT_URL) throw new Error("No está configurada la URL del Apps Script.");
      const response = await fetch(`${APPS_SCRIPT_URL}?action=mantenimiento_programado&ts=${Date.now()}`, { cache: "no-store" });
      const json = await readJsonResponse(response, "Carga de Mantenimiento Programado");
      if (!json?.ok) throw new Error(json?.error?.message || "No se pudo cargar Mantenimiento Programado.");
      setConfigs(Array.isArray(json.config) ? json.config : []);
      setRegistros(Array.isArray(json.registros) ? json.registros : []);
      setProgramaciones(Array.isArray(json.programaciones) ? json.programaciones : JSON.parse(localStorage.getItem("dm_pm_programaciones") || "[]"));
      setRepuestos(Array.isArray(json.repuestos) ? json.repuestos : JSON.parse(localStorage.getItem("dm_pm_repuestos") || "[]"));
    } catch (err) {
      appAlert?.(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [APPS_SCRIPT_URL, appAlert]);'''
new='''  const post = useCallback(async payload => {
    if (readOnly) throw new Error("Modo solo lectura: no tiene permiso para modificar Mantenimiento Programado.");
    return savePmAction(payload);
  }, [readOnly]);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const json = await getPmSnapshot();
      setConfigs(Array.isArray(json?.config) ? json.config : []);
      setRegistros(Array.isArray(json?.registros) ? json.registros : []);
      setProgramaciones(Array.isArray(json?.programaciones) ? json.programaciones : []);
      setRepuestos(Array.isArray(json?.repuestos) ? json.repuestos : []);
    } catch (err) {
      appAlert?.(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [appAlert]);'''
replace_once(p,old,new)

# Licitaciones: Supabase directo.
p='src/modules/licitaciones/LicitacionesModule.jsx'
anchor='import {normalizeROP02} from "../../shared/domain/index.jsx";'
replace_once(p,anchor,anchor+'\nimport {getLicitacionesSnapshot,saveLicitacion} from "../../services/operationalSupabase.js";')
old='''  const { APPS_SCRIPT_URL, C, Icon, Spinner, MultiSel, multiIsAll, appAlert, appConfirm, dmNormKey, canonicalEquivalentMachineCode, cleanMachine, mainMachineCode } = __deps;'''
new='''  const { C, Icon, Spinner, MultiSel, multiIsAll, appAlert, appConfirm, dmNormKey, canonicalEquivalentMachineCode, cleanMachine, mainMachineCode } = __deps;'''
replace_once(p,old,new)
old='''  const postLicitaciones=useCallback(async(payload)=>{
    const res=await fetch(APPS_SCRIPT_URL,{method:"POST",cache:"no-store",redirect:"follow",headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},body:new URLSearchParams({payload:JSON.stringify(payload)}).toString()});
    if(!res.ok)throw new Error(`Error HTTP ${res.status}`);
    const json=await res.json();
    if(!json.ok)throw new Error(json?.error?.message||"No se pudo guardar la licitación.");
    return json;
  },[]);'''
new='''  const postLicitaciones=useCallback(async(payload)=>{
    if(payload?.action==="guardar_licitacion"||payload?.action==="save_licitacion")return saveLicitacion(payload.licitacion);
    throw new Error(`Acción de licitaciones no soportada: ${payload?.action||""}`);
  },[]);'''
replace_once(p,old,new)
old='''      const res=await fetch(`${APPS_SCRIPT_URL}?action=licitaciones_compartidas&_=${Date.now()}`,{cache:"no-store"});
      const json=await res.json();
      if(!json.ok)throw new Error(json?.error?.message||"No se pudieron cargar las licitaciones.");'''
new='''      const json=await getLicitacionesSnapshot();
      if(!json?.ok)throw new Error("No se pudieron cargar las licitaciones desde Supabase.");'''
replace_once(p,old,new)
replace_once(p,'  },[APPS_SCRIPT_URL]);','  },[]);')

# Abastecimiento: la eliminación de remitos también es Supabase.
p='src/modules/abastecimiento/AbastecimientoModule.jsx'
replace_once(p,'import { getAbastecimientoSnapshot, saveAbastecimientoRemito, setAbastecimientoEstado, appendAbastecimientoRaba03, updateAbastecimientoRaba03 } from "../../services/abastecimientoSupabase.js";','import { getAbastecimientoSnapshot, saveAbastecimientoRemito, deleteAbastecimientoRemito, setAbastecimientoEstado, appendAbastecimientoRaba03, updateAbastecimientoRaba03 } from "../../services/abastecimientoSupabase.js";')
old='''      const res=await fetch(APPS_SCRIPT_URL,{
        method:"POST",
        cache:"no-store",
        redirect:"follow",
        headers:{"Content-Type":"application/x-www-form-urlencoded;charset=UTF-8"},
        body:new URLSearchParams({payload:JSON.stringify({action:"delete_remito_cargado",idRemito:id})}).toString()
      });
      const json=await res.json();
      if(!json.ok)throw new Error(json?.error?.message||"No se pudo eliminar el remito compartido.");'''
replace_once(p,old,'      await deleteAbastecimientoRemito(id);')

# appsScriptApi: todas las lecturas operativas especiales van a tablas/RPC canónicos Supabase.
p='src/services/appsScriptApi.js'; s=Path(p).read_text(encoding='utf-8')
start=s.index('export async function fetchSupabaseCachedAction(action){')
end=s.index('\nasync function fetchSupabaseVersions_()',start)
newfun='''export async function fetchSupabaseCachedAction(action){
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
'''
s=s[:start]+newfun+s[end:]
old='''export async function fetchAction(url,action,options={}){
  if(SPECIAL_CACHE_ACTIONS[action]){
    try{
      const cached=await fetchSupabaseCachedAction(action);
      if(cached)return cached;
    }catch(error){console.warn(`[${action}] caché Supabase no disponible; fallback Apps Script`,error);}
  }
  return fetchAppsScriptAction_(url,action,options);
}

export async function fetchHealth(url){return fetchAppsScriptAction_(url,"health",{compact:false});}'''
new='''export async function fetchAction(url,action,options={}){
  if(SPECIAL_CACHE_ACTIONS[action]&&isSupabaseConfigured){
    const value=await fetchSupabaseCachedAction(action);
    if(value)return value;
    throw new Error(`Acción ${action} no disponible en Supabase`);
  }
  return fetchAppsScriptAction_(url,action,options);
}

export async function fetchHealth(_url){
  if(!isSupabaseConfigured)return{ok:false,source:"supabase",error:{message:"Supabase no configurado"}};
  const started=performance.now();const {error}=await requireSupabase().from("rop02").select("id",{head:true,count:"exact"}).limit(1);
  if(error)throw error;return{ok:true,source:"supabase",latencyMs:Math.round(performance.now()-started),serverTime:new Date().toISOString()};
}'''
if old not in s: raise SystemExit('fetchAction/health pattern missing')
s=s.replace(old,new,1)
old='''export async function fetchSyncVersions(url){
  try{
    const sync=await fetchSupabaseVersions_();
    if(sync)return sync;
  }catch(error){console.warn("Manifest Supabase no disponible; fallback Apps Script",error);}
  try{return await fetchAppsScriptAction_(url,"get_data_versions",{compact:false,retries:1});}
  catch(_){
    try{return await fetchAppsScriptAction_(url,"sync",{compact:false,retries:1});}
    catch(__){return null;}
  }
}'''
new='''export async function fetchSyncVersions(_url){
  try{return await fetchSupabaseVersions_();}
  catch(error){console.warn("Manifest Supabase no disponible",error);return null;}
}'''
if old not in s: raise SystemExit('fetchSyncVersions pattern missing')
s=s.replace(old,new,1)
Path(p).write_text(s,encoding='utf-8')

# Historical reads: never fall back to Apps Script for the operational datasets.
p='src/data/historicalDataService.js'; s=Path(p).read_text(encoding='utf-8')
s=s.replace('import {APPS_SCRIPT_URL} from "../config/app.js";\n','')
s=s.replace('import {fetchDatasetQuery,fetchSyncVersions} from "../services/appsScriptApi.js";\n','')
s=s.replace('const ROP02_SOURCE=String(import.meta.env.VITE_ROP02_SOURCE||"supabase").toLowerCase();\nconst TYPED_SOURCE=String(import.meta.env.VITE_TYPED_SOURCE||"supabase").toLowerCase();\n','')
start=s.index('export async function fetchDatasetPage(dataset,params={}){')
end=s.index('\nexport async function getDataset(dataset,params={}){',start)
newpage='''export async function fetchDatasetPage(dataset,params={}){
  const key=buildDatasetQueryKey(dataset,params);
  if(pending.has(key))return pending.get(key);
  const started=performance.now();
  const supabaseRop02Request=()=>params.limit==="all"?(async()=>{const data=[];const meta=await fetchAllRop02Pages(params,page=>data.push(...page));return{ok:true,data,rows:data.length,total:meta.total,hasMore:false,nextOffset:null,source:"supabase"};})():getRop02Page({...params,limit:params.limit||250,offset:params.offset||0});
  const typedGetter=dataset==="rop05"?getRop05Page:dataset==="rma15"?getRma15Page:null;
  if(dataset!=="rop02"&&!typedGetter)throw new Error(`Dataset histórico no soportado por Supabase: ${dataset}`);
  const network=dataset==="rop02"?supabaseRop02Request():typedGetter(params);
  const task=network.then(async response=>{const value={...response,cacheHit:false,cacheLevel:"network",elapsedMs:Math.round(performance.now()-started)};remember_(key,value);await writeCachedSource(`query:${key}`,value);return value;}).finally(()=>{if(pending.get(key)===task)pending.delete(key);});
  pending.set(key,task);return task;
}
'''
s=s[:start]+newpage+s[end:]
start=s.index('export async function getDataset(dataset,params={}){')
end=s.index('\nexport const getRop02=params=>',start)
newget='''export async function getDataset(dataset,params={}){
  const cached=await readDatasetQuery(dataset,params);
  try{return await fetchDatasetPage(dataset,params);}
  catch(error){if(cached)return cached;throw error;}
}
'''
s=s[:start]+newget+s[end:]
# Remove legacy special-action helper block completely.
if 'async function fetchSpecialAction_' in s:
    st=s.index('async function fetchSpecialAction_'); en=s.index('\nfunction fullOperationalWindowParams_',st); s=s[:st]+s[en:]
s=s.replace('export const getRop02LatestByEquipmentProject=params=>ROP02_SOURCE==="legacy"?fetchSpecialAction_("get_rop02_latest_by_equipment_project",params):getLatestRop02ByEquipment(params).catch(error=>{console.warn("[ROP02] fallback latest legacy",error);return fetchSpecialAction_("get_rop02_latest_by_equipment_project",params);});','export const getRop02LatestByEquipmentProject=params=>getLatestRop02ByEquipment(params);')
s=s.replace('export const getRop02MonthlySummary=params=>ROP02_SOURCE==="legacy"?fetchSpecialAction_("get_rop02_monthly_summary",params):getSupabaseMonthlySummary(params).catch(error=>{console.warn("[ROP02] fallback summary legacy",error);return fetchSpecialAction_("get_rop02_monthly_summary",params);});','export const getRop02MonthlySummary=params=>getSupabaseMonthlySummary(params);')
s=s.replace('  return ROP02_SOURCE==="legacy"\n    ?getRop02({...p,limit:"all"})\n    :getSupabaseOperationalSnapshot(p).catch(error=>{console.warn("[ROP02] fallback operational snapshot legacy",error);return getRop02({...p,limit:"all"});});','  return getSupabaseOperationalSnapshot(p);')
s=s.replace('export const getRop02Stats=params=>ROP02_SOURCE==="legacy"?Promise.resolve(null):getSupabaseRop02Stats(params);','export const getRop02Stats=params=>getSupabaseRop02Stats(params);')
s=s.replace('export const getRop02Facets=params=>ROP02_SOURCE==="legacy"?Promise.resolve(null):getSupabaseRop02Facets(params);','export const getRop02Facets=params=>getSupabaseRop02Facets(params);')
s=s.replace('export const getRop02Rop05Control=params=>ROP02_SOURCE==="legacy"?Promise.resolve(null):getSupabaseRop02Rop05Control(params);','export const getRop02Rop05Control=params=>getSupabaseRop02Rop05Control(params);')
s=s.replace('export const getRma15EquipmentUniverse=params=>TYPED_SOURCE==="legacy"?fetchSpecialAction_("get_rma15_equipment_universe",params):getRma15EquipmentUniverseSupabase(params).catch(error=>{console.error("[RMA15] Supabase equipment universe falló",error);throw error;});','export const getRma15EquipmentUniverse=params=>getRma15EquipmentUniverseSupabase(params);')
s=s.replace('export const getRma15OpenOtSummary=params=>TYPED_SOURCE==="legacy"?fetchSpecialAction_("get_rma15_open_ot_summary",params):getRma15OpenOtSummarySupabase(params).catch(error=>{console.error("[RMA15] Supabase open OT summary falló",error);throw error;});','export const getRma15OpenOtSummary=params=>getRma15OpenOtSummarySupabase(params);')
s=s.replace('  if(dataset==="rop02"&&ROP02_SOURCE!=="legacy")return fetchAllRop02Pages(params,onPage);\n  if((dataset==="rop05"||dataset==="rma15")&&TYPED_SOURCE!=="legacy")return fetchAllOperationalPages(dataset,params,onPage);','  if(dataset==="rop02")return fetchAllRop02Pages(params,onPage);\n  if(dataset==="rop05"||dataset==="rma15")return fetchAllOperationalPages(dataset,params,onPage);')
Path(p).write_text(s,encoding='utf-8')
