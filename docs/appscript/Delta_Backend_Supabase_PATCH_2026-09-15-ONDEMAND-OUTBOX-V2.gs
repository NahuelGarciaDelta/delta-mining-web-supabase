/* =========================================================
   DELTA MINING OPS — PATCH FINAL 2026-09-15
   Se concatena al backend completo vigente para generar
   Delta_Backend_Supabase_FINAL_2026-09-15.gs
   ========================================================= */

DELTA_BACKEND_VERSION_ = "2026-09-15-ONDEMAND-RABA03-OUTBOX-V2";

function deltaNormalizeRaba03Solicitud_(value){
  return String(value===null||value===undefined?"":value).trim();
}

function deltaRaba03SolicitudFromRow_(row){
  return deltaNormalizeRaba03Solicitud_(deltaPick_(row||{},["N° de solicitud","Nº de solicitud","Numero de solicitud","Número de solicitud"]));
}

function deltaRaba03ActiveTombstones_(){
  var values=deltaSupabaseRpc_("abastecimiento_raba03_active_tombstones",{})||[];
  var set={};
  (Array.isArray(values)?values:[]).forEach(function(value){
    var key=deltaNormalizeRaba03Solicitud_(value);
    if(key)set[key]=true;
  });
  return set;
}

/* Reemplaza la sincronización RABA03 para impedir que una fila eliminada
   desde la app reaparezca desde Sheets mientras la baja física está en outbox. */
function deltaSyncRaba03_(){
  var s=deltaReadSourceRows_("raba03");
  var tombstones=deltaRaba03ActiveTombstones_();
  var rows=s.rows.filter(function(entry){
    return !tombstones[deltaRaba03SolicitudFromRow_(entry.row_data||{})];
  });
  var a=deltaSupabaseRpc_("sync_generic_dataset",{p_dataset:"raba03",p_rows:rows,p_source_version:getDatasetVersion_("raba03")});
  var b=deltaSupabaseRpc_("sync_authoritative_abastecimiento_storage",{p_dataset:"abastecimiento_raba03",p_rows:rows,p_meta:{source:"Sheets"}});
  return{ok:true,generic:a,abastecimiento:b,sheetRows:rows.length,sourceRows:s.rows.length,tombstones:Object.keys(tombstones).length};
}

function deltaRaba03SheetInfo_(){
  var cfg=SHEETS_CONFIG.raba03;
  if(!cfg)throw new Error("No existe configuración RABA03.");
  var ss=SpreadsheetApp.openById(cfg.id);
  var sh=findSheetByGidOrName(ss,cfg.gid,cfg.sheet);
  if(!sh)throw new Error("No se encontró la hoja RABA03: "+cfg.sheet);
  var headerRow=Number(cfg.headerRow||6),lastCol=sh.getLastColumn();
  if(lastCol<1)throw new Error("RABA03 no tiene columnas.");
  var headers=sh.getRange(headerRow,1,1,lastCol).getValues()[0];
  var normalize=function(value){
    return String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  };
  var wanted={"NDESOLICITUD":true,"NUMERODESOLICITUD":true};
  var idx=-1;
  headers.some(function(header,i){if(wanted[normalize(header)]){idx=i;return true;}return false;});
  if(idx<0)throw new Error("No se encontró la columna N° de solicitud en RABA03.");
  return{sheet:sh,headerRow:headerRow,lastCol:lastCol,solicitudCol:idx+1};
}

function deltaDeleteRaba03SolicitudFromSheets_(numeroSolicitud){
  var numero=deltaNormalizeRaba03Solicitud_(numeroSolicitud);
  if(!numero)throw new Error("N° de solicitud vacío en outbox RABA03.");
  var info=deltaRaba03SheetInfo_(),sh=info.sheet,lastRow=sh.getLastRow(),rows=[];
  if(lastRow>info.headerRow){
    var values=sh.getRange(info.headerRow+1,info.solicitudCol,lastRow-info.headerRow,1).getValues();
    values.forEach(function(row,index){
      if(deltaNormalizeRaba03Solicitud_(row[0])===numero)rows.push(info.headerRow+1+index);
    });
  }
  rows.sort(function(a,b){return b-a;}).forEach(function(rowNumber){sh.deleteRow(rowNumber);});
  SpreadsheetApp.flush();
  var confirm=deltaSupabaseRpc_("abastecimiento_raba03_confirm_sheet_delete",{p_numero_solicitud:numero});
  if(confirm&&confirm.ok===false)throw new Error("Supabase no confirmó la baja física RABA03: "+JSON.stringify(confirm));
  return{ok:true,numeroSolicitud:numero,deletedRows:rows.length};
}

function deltaAssertOutboxOk_(result,label){
  if(result&&result.ok===false){
    var msg=result.error&&result.error.message?result.error.message:(result.error||JSON.stringify(result));
    throw new Error(label+": "+msg);
  }
  return result;
}

/* Override del despachador maestro: conserva dominios existentes y agrega RABA03. */
function deltaApplyOutboxEvent_(event){
  var p=event.payload||{},domain=String(event.domain||""),op=String(event.operation||"").toLowerCase();
  if(domain==="raba03"){
    if(op==="cant_enviada")return deltaAssertOutboxOk_(handleSaveRABA03CantEnviada_(p.rows||[]),"RABA03 cant_enviada");
    if(op==="codigos")return deltaAssertOutboxOk_(handleSaveRABA03Codigos_(p.rows||[]),"RABA03 codigos");
    if(op==="delete_solicitud"||op==="delete")return deltaDeleteRaba03SolicitudFromSheets_(p.numeroSolicitud||event.record_key||"");
    throw new Error("Operación RABA03 de outbox no implementada: "+op);
  }
  if(domain==="movimientos_equipos"){
    if(op==="cancel"||op==="delete")return deltaAssertOutboxOk_(handleCancelEquipmentMovement_(event.record_key||p.id,p.usuario||"APP"),"Cancelar movimiento");
    return deltaAssertOutboxOk_(handleSaveEquipmentMovement_(p),"Guardar movimiento");
  }
  if(domain==="remitos_cargados"||domain==="abastecimiento_remitos"){
    if(op==="delete")return deltaAssertOutboxOk_(handleDeleteRemitoCargado_(event.record_key||p.id),"Eliminar remito");
    return deltaAssertOutboxOk_(handleSaveRemitoCargado_(p),"Guardar remito");
  }
  if(domain==="abastecimiento_estados"){
    if(op==="delete")return deltaAssertOutboxOk_(handleDeleteEstadoSolicitud_(event.record_key||p.clave),"Eliminar estado");
    return deltaAssertOutboxOk_(handleSaveEstadoSolicitud_(p),"Guardar estado");
  }
  if(domain==="usuarios"){
    var info=getUsuariosSheetInfo_(),rowNum=findUsuarioRowByEmail_(info,p.email||event.record_key);
    if(rowNum<0)throw new Error("Usuario inexistente en Sheets: "+(p.email||event.record_key));
    var values=info.sheet.getRange(rowNum,1,1,info.headers.length).getValues()[0];
    if(p.password)values[info.passwordIdx]=p.password;
    if(p.nombre)values[info.nombreIdx]=p.nombre;
    if((String(values[info.rolIdx]||"").toUpperCase()==="ADMIN"||String(values[info.rolIdx]||"").toUpperCase()==="ADMINISTRADOR")&&p.area!==undefined)values[info.areaIdx]=p.area;
    info.sheet.getRange(rowNum,1,1,values.length).setValues([values]);
    return{ok:true};
  }
  throw new Error("Dominio de outbox no implementado: "+domain);
}
