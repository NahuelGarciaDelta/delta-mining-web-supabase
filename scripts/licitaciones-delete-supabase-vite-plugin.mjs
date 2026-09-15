export function licitacionesDeleteSupabaseVitePlugin(){
  return {
    name:'delta-licitaciones-delete-supabase',
    enforce:'pre',
    transform(code,id){
      if(!id.endsWith('/src/modules/licitaciones/LicitacionesModule.jsx'))return null;
      let s=code;
      s=s.replace(
        'import {getLicitacionesSnapshot,saveLicitacion} from "../../services/operationalSupabase.js";',
        'import {getLicitacionesSnapshot,saveLicitacion,deleteLicitacion} from "../../services/operationalSupabase.js";'
      );
      s=s.replace(
        'if(payload?.action==="guardar_licitacion"||payload?.action==="save_licitacion")return saveLicitacion(payload.licitacion);\n    throw new Error(`Acción de licitaciones no soportada: ${payload?.action||""}`);',
        'if(payload?.action==="guardar_licitacion"||payload?.action==="save_licitacion")return saveLicitacion(payload.licitacion);\n    if(payload?.action==="eliminar_licitacion"||payload?.action==="delete_licitacion")return deleteLicitacion(payload.idLicitacion||payload.id||"");\n    throw new Error(`Acción de licitaciones no soportada: ${payload?.action||""}`);'
      );
      return s===code?null:{code:s,map:null};
    }
  };
}
