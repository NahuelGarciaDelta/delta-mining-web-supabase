/* =========================================================
   DELTA MINING OPS — PATCH AUTORITATIVO 2026-09-15
   Sheets -> Supabase: altas, cambios Y BAJAS para datasets
   especiales que no usan source_row tipado.
   ========================================================= */

function deltaSyncSpecialSnapshots_(){
  var out={};
  try{
    var lic=handleGetLicitacionesCompartidas_();
    out.licitaciones=deltaSupabaseRpc_("sync_authoritative_app_dataset",{
      p_dataset:"licitaciones",
      p_rows:(lic&&lic.data)||[],
      p_meta:{source:"Sheets",authoritative:true}
    });
  }catch(e){out.licitaciones={ok:false,error:e.message};}

  try{
    var pm=handleGetMantenimientoProgramado_()||{};
    out.pm_config=deltaSupabaseRpc_("sync_authoritative_app_dataset",{
      p_dataset:"pm_config",p_rows:pm.config||[],p_meta:{source:"Sheets",authoritative:true}
    });
    out.pm_registros=deltaSupabaseRpc_("sync_authoritative_app_dataset",{
      p_dataset:"pm_registros",p_rows:pm.registros||[],p_meta:{source:"Sheets",authoritative:true}
    });
    out.pm_programaciones=deltaSupabaseRpc_("sync_authoritative_app_dataset",{
      p_dataset:"pm_programaciones",p_rows:pm.programaciones||[],p_meta:{source:"Sheets",authoritative:true}
    });
    out.pm_repuestos=deltaSupabaseRpc_("sync_authoritative_app_dataset",{
      p_dataset:"pm_repuestos",p_rows:pm.repuestos||[],p_meta:{source:"Sheets",authoritative:true}
    });
  }catch(pmErr){out.pm={ok:false,error:pmErr.message};}

  return{ok:Object.keys(out).every(function(k){return out[k]&&out[k].ok!==false;}),results:out};
}
