import {requireSupabase} from "./supabaseClient.js";
import {getAuthContext} from "./authSession.js";

const authToken=()=>{
  const token=String(getAuthContext()?.authToken||"").trim();
  if(!token)throw new Error("La sesión no es válida. Volvé a iniciar sesión.");
  return token;
};

export async function getWearCatalog(){
  const sb=requireSupabase();
  const {data,error}=await sb.from("app_wear_articles").select("codigo,descripcion,descripcion_adicional,clasificacion,orden").order("orden",{ascending:true});
  if(error)throw error;
  return (data||[]).map(x=>({codigo:String(x.codigo||""),articulo:String(x.descripcion||""),descripcionAdicional:String(x.descripcion_adicional||""),clasificacion:String(x.clasificacion||"")}));
}

export async function replaceWearCatalog(rows){
  const sb=requireSupabase();
  const payload=(rows||[]).map(x=>({codigo:String(x.codigo||""),articulo:String(x.articulo||x.descripcion||""),descripcionAdicional:String(x.descripcionAdicional||x.descripcion_adicional||""),clasificacion:String(x.clasificacion||"")}));
  const {data,error}=await sb.rpc("app_replace_wear_articles_v2",{p_rows:payload,p_auth_token:authToken()});
  if(error)throw error;
  return data||{ok:true,rows:payload.length};
}
