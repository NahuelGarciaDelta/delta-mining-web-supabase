import {fetchSupabaseCachedAction} from "./appsScriptApi.js";

const CACHE_ACTIONS=new Set([
  "mantenimiento_programado",
  "estados_solicitudes",
  "licitaciones_compartidas",
  "stock_excel_status",
  "stock_excel_data",
  "get_equipment_movements",
  "get_active_equipment_movements",
]);

let installed=false;

function requestInfo(input,init={}){
  const method=String(init?.method||(input instanceof Request?input.method:"GET")||"GET").toUpperCase();
  const raw=input instanceof Request?input.url:String(input||"");
  try{
    const url=new URL(raw,window.location.href);
    return{method,url,action:String(url.searchParams.get("action")||"").trim().toLowerCase()};
  }catch(_){return{method,url:null,action:""};}
}

function isAppsScriptRead({method,url,action}){
  if(method!=="GET"||!url||!CACHE_ACTIONS.has(action))return false;
  return url.hostname==="script.google.com"&&url.pathname.includes("/macros/s/");
}

export function installSupabaseReadBridge(){
  if(installed||typeof window==="undefined"||typeof window.fetch!=="function")return;
  installed=true;
  const nativeFetch=window.fetch.bind(window);
  window.fetch=async(input,init={})=>{
    const info=requestInfo(input,init);
    if(isAppsScriptRead(info)){
      try{
        const payload=await fetchSupabaseCachedAction(info.action);
        if(payload){
          return new Response(JSON.stringify(payload),{
            status:200,
            headers:{"Content-Type":"application/json;charset=UTF-8","X-Delta-Source":"supabase-cache"},
          });
        }
      }catch(error){
        console.warn(`[${info.action}] no se pudo leer caché Supabase; se usa Apps Script`,error);
      }
    }
    return nativeFetch(input,init);
  };
}
