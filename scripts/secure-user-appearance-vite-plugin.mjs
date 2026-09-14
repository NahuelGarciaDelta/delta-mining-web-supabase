const normalizeId=id=>String(id||"").replace(/\\/g,"/").split("?")[0];

export function secureUserAppearanceVitePlugin(){
  return{
    name:"delta-secure-user-appearance",
    enforce:"pre",
    transform(code,id){
      const file=normalizeId(id);
      if(!file.endsWith("/src/services/userAppearance.js"))return null;
      let next=code;
      const importLine='import {requireSupabase} from "./supabaseClient.js";';
      if(!next.includes(importLine))throw new Error("[secure-appearance] No se encontró import Supabase esperado.");
      next=next.replace(importLine,`${importLine}\nimport {getAuthContext} from "./authSession.js";\nconst appearanceAuthToken=()=>{const token=String(getAuthContext()?.authToken||\"\").trim();if(!token)throw new Error(\"La sesión no es válida. Volvé a iniciar sesión.\");return token;};`);

      const replacements=[
        ['rpc("app_get_user_appearance",{p_email:String(email||"")})','rpc("app_get_user_appearance_v2",{p_auth_token:appearanceAuthToken()})'],
        ['rpc("app_upload_user_background",{p_email:String(email||""),p_name:String(name||"Mi fondo"),p_data_url:String(dataUrl||"")})','rpc("app_upload_user_background_v2",{p_name:String(name||"Mi fondo"),p_data_url:String(dataUrl||""),p_auth_token:appearanceAuthToken()})'],
        ['rpc("app_save_user_appearance",{p_email:String(email||""),p_appearance:normalized})','rpc("app_save_user_appearance_v2",{p_appearance:normalized,p_auth_token:appearanceAuthToken()})'],
      ];
      for(const [before,after] of replacements){
        if(!next.includes(before))throw new Error(`[secure-appearance] No se encontró llamada esperada: ${before}`);
        next=next.replace(before,after);
      }
      return{code:next,map:null};
    }
  };
}
