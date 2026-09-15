/* =========================================================
   DELTA MINING OPS — PATCH FINAL 2026-09-15
   Se concatena al backend completo vigente para generar
   Delta_Backend_Supabase_FINAL_2026-09-15.gs

   V3 garantiza el circuito:
   APP -> SUPABASE -> OUTBOX -> GOOGLE SHEETS
   y conserva SHEETS -> SUPABASE por triggers + barrido cada 5 min.
   ========================================================= */

DELTA_BACKEND_VERSION_ = "2026-09-15-FULL-CRUD-OUTBOX-V3";

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

/* Impide que una solicitud eliminada desde la app reaparezca desde Sheets
   mientras la baja física está esperando en outbox. */
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

function deltaNormalizeHeaderKey_(value){
  return String(value===null||value===undefined?"":value)
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .toUpperCase().replace(/[^A-Z0-9]/g,"");
}

/* Replica exacta por source_row. Es clave para Lista Maestra: Supabase conserva
   la fila física del Sheet y el trigger de outbox agrega _sourceRow. */
function deltaApplyPayloadAtSourceRow_(dataset,sourceRow,payload,mode){
  var cfg=SHEETS_CONFIG[dataset];
  if(!cfg)throw new Error("Dataset sin configuración Sheets: "+dataset);
  var rowNumber=Number(sourceRow||payload&&payload._sourceRow||0);
  var headerRow=Number(cfg.headerRow||1);
  if(!rowNumber||rowNumber<=headerRow)throw new Error("Fila física inválida para "+dataset+": "+rowNumber);
  var ss=SpreadsheetApp.openById(cfg.id),sheet=findSheetByGidOrName(ss,cfg.gid,cfg.sheet);
  if(!sheet)throw new Error("No se encontró la hoja "+cfg.sheet+" para "+dataset);
  if(String(mode||"").toLowerCase()==="delete"){
    if(rowNumber<=sheet.getLastRow())sheet.deleteRow(rowNumber);
    SpreadsheetApp.flush();
    try{bumpDatasetVersion_(dataset,true);}catch(_e){}
    return{ok:true,action:"delete",dataset:dataset,rowNumber:rowNumber};
  }
  var lastCol=Math.max(1,sheet.getLastColumn()),headers=sheet.getRange(headerRow,1,1,lastCol).getValues()[0];
  var values=rowNumber<=sheet.getLastRow()?sheet.getRange(rowNumber,1,1,lastCol).getValues()[0]:Array(lastCol).fill("");
  var source=payload||{},byKey={};
  Object.keys(source).forEach(function(key){
    if(key==="_sourceRow"||key==="_sourceDataset")return;
    byKey[deltaNormalizeHeaderKey_(key)]=source[key];
  });
  headers.forEach(function(header,index){
    var k=deltaNormalizeHeaderKey_(header);
    if(Object.prototype.hasOwnProperty.call(byKey,k))values[index]=byKey[k];
  });
  if(rowNumber>sheet.getMaxRows())sheet.insertRowsAfter(sheet.getMaxRows(),rowNumber-sheet.getMaxRows());
  sheet.getRange(rowNumber,1,1,lastCol).setValues([values]);
  SpreadsheetApp.flush();
  try{bumpDatasetVersion_(dataset,true);}catch(_e){}
  return{ok:true,action:String(mode||"upsert"),dataset:dataset,rowNumber:rowNumber};
}

function deltaUpsertTallerFromOutbox_(event,p){
  var id=String(event.record_key||p.id||"").trim();
  if(!id)throw new Error("Movimiento de Taller sin ID.");
  var found=findTallerMovementById_(id);
  if(found)return deltaAssertOutboxOk_(handleUpdateTallerMovement_(id,p),"Actualizar movimiento Taller");
  var type=normalizeTallerType_(p.tipo||p.tipoMovimiento),sheet=ensureTallerSheet_(type),values=tallerMovementValues_(id,p);
  sheet.appendRow(values);
  upsertGenericMovementFromTaller_(values);
  SpreadsheetApp.flush();
  try{bumpDatasetVersion_("movimientos_taller",true);}catch(_e){}
  return{ok:true,id:id,action:"insert_taller_from_outbox"};
}

/* Stock se replica sin exigir un token de navegador: el evento ya fue autenticado
   y persistido en Supabase antes de entrar a la cola. */
function deltaReplaceStockFromOutbox_(p){
  var rows=Array.isArray(p.rows)?p.rows:[],checked=stockExcelValidateRows_(rows),spreadsheet=stockExcelDb_();
  var temp=spreadsheet.getSheetByName(STOCK_TEMP_SHEET_);if(temp)spreadsheet.deleteSheet(temp);
  temp=spreadsheet.insertSheet(STOCK_TEMP_SHEET_);
  temp.getRange(1,1,1,STOCK_EXCEL_DATA_HEADERS_.length).setValues([STOCK_EXCEL_DATA_HEADERS_]).setFontWeight("bold");
  if(checked.matrix.length)temp.getRange(2,1,checked.matrix.length,STOCK_EXCEL_DATA_HEADERS_.length).setValues(checked.matrix);
  temp.setFrozenRows(1);
  var main=spreadsheet.getSheetByName(STOCK_MAIN_SHEET_);if(main)spreadsheet.deleteSheet(main);
  temp.setName(STOCK_MAIN_SHEET_);
  var oldMeta=stockExcelReadMeta_(),metaIn=p.meta||{};
  var meta={version:Number(oldMeta.version||0)+1,activeSheet:STOCK_MAIN_SHEET_,fileName:String(metaIn.fileName||"Stock.xlsx"),sourceSheet:String(metaIn.sourceSheet||""),rowCount:checked.matrix.length,updatedAt:new Date().toISOString(),updatedBy:String(metaIn.updatedBy||"SUPABASE_OUTBOX"),validRows:checked.matrix.length,rejectedRows:0,duplicateCodes:checked.duplicates||0};
  stockExcelWriteMeta_(meta);stockExcelHistory_(meta,"OUTBOX_REPLACE");SpreadsheetApp.flush();
  return{ok:true,rows:checked.matrix.length};
}

function deltaClearStockFromOutbox_(){
  var spreadsheet=stockExcelDb_(),sheet=spreadsheet.getSheetByName(STOCK_MAIN_SHEET_);
  if(sheet){sheet.clearContents();sheet.getRange(1,1,1,STOCK_EXCEL_DATA_HEADERS_.length).setValues([STOCK_EXCEL_DATA_HEADERS_]).setFontWeight("bold");}
  var oldMeta=stockExcelReadMeta_(),meta={version:Number(oldMeta.version||0)+1,activeSheet:"",fileName:"",sourceSheet:"",rowCount:0,updatedAt:new Date().toISOString(),updatedBy:"SUPABASE_OUTBOX",validRows:0,rejectedRows:0,duplicateCodes:0};
  stockExcelWriteMeta_(meta);stockExcelHistory_(meta,"OUTBOX_CLEAR");SpreadsheetApp.flush();return{ok:true,rows:0};
}

/* Despachador completo de todos los dominios que hoy puede producir la app. */
function deltaApplyOutboxEvent_(event){
  var p=event.payload||{},domain=String(event.domain||""),op=String(event.operation||"").toLowerCase();

  if(domain==="raba03"){
    if(op==="append")return deltaAssertOutboxOk_(handleAddRABA03Rows_SAFE_V2_(p.rows||[]),"Agregar RABA03");
    if(op==="cant_enviada")return deltaAssertOutboxOk_(handleSaveRABA03CantEnviada_(p.rows||[]),"RABA03 cant_enviada");
    if(op==="codigos")return deltaAssertOutboxOk_(handleSaveRABA03Codigos_(p.rows||[]),"RABA03 codigos");
    if(op==="delete_solicitud"||op==="delete")return deltaDeleteRaba03SolicitudFromSheets_(p.numeroSolicitud||event.record_key||"");
    throw new Error("Operación RABA03 de outbox no implementada: "+op);
  }

  if(domain==="lista_equipos"){
    if(op==="delete")return deltaApplyPayloadAtSourceRow_("lista_equipos",p._sourceRow||event.record_key,p,"delete");
    return deltaApplyPayloadAtSourceRow_("lista_equipos",p._sourceRow,p,op||"upsert");
  }

  if(["rop02_fs","rop02_jm","rop02_filosur","rop02_zorro"].indexOf(domain)>=0){
    if(op==="delete")return deltaApplyPayloadAtSourceRow_(domain,event.record_key,p,"delete");
    return deltaAssertOutboxOk_(handleUpdateROP02Row_(domain,{rowNumber:Number(event.record_key)},p),"Actualizar "+domain);
  }

  if(domain==="licitaciones"){
    if(op==="delete")return deltaAssertOutboxOk_(handleDeleteLicitacionCompartida_(event.record_key||p.id),"Eliminar licitación");
    return deltaAssertOutboxOk_(handleSaveLicitacionCompartida_(p),"Guardar licitación");
  }

  if(domain==="pm_config")return deltaAssertOutboxOk_(handleSavePMConfig_(p),"Guardar PM config");
  if(domain==="pm_registros")return deltaAssertOutboxOk_(handleRegistrarPMRealizado_(p),"Registrar PM realizado");
  if(domain==="pm_programacion")return deltaAssertOutboxOk_(handleSavePMProgramacion_(p),"Guardar programación PM");
  if(domain==="pm_repuestos")return deltaAssertOutboxOk_(handleSavePMRepuesto_(p),"Guardar repuesto PM");

  if(domain==="stock"){
    if(op==="clear"||op==="delete")return deltaClearStockFromOutbox_();
    if(op==="replace"||op==="upsert")return deltaReplaceStockFromOutbox_(p);
    throw new Error("Operación Stock de outbox no implementada: "+op);
  }

  if(domain==="articulos_desgaste"){
    if(op==="replace"||op==="upsert")return deltaAssertOutboxOk_(handleSaveArticulosDesgaste_(p.rows||[]),"Guardar artículos de desgaste");
    throw new Error("Operación Artículos desgaste no implementada: "+op);
  }

  if(domain==="movimientos_taller"){
    if(op==="delete"||op==="cancel")return deltaAssertOutboxOk_(handleDeleteTallerMovement_(event.record_key||p.id,p.usuario||"APP"),"Eliminar movimiento Taller");
    return deltaUpsertTallerFromOutbox_(event,p);
  }

  if(domain==="movimientos_equipos"){
    if(op==="cancel"||op==="delete")return deltaAssertOutboxOk_(handleCancelEquipmentMovement_(event.record_key||p.id,p.usuario||"APP"),"Cancelar movimiento");
    return deltaAssertOutboxOk_(handleSaveEquipmentMovement_(p),"Guardar movimiento");
  }

  if(domain==="remitos_cargados"||domain==="abastecimiento_remitos"){
    if(op==="delete")return deltaAssertOutboxOk_(handleDeleteRemitoCargado_(event.record_key||p.id||p.idRemito),"Eliminar remito");
    return deltaAssertOutboxOk_(handleSaveRemitoCargado_(p),"Guardar remito");
  }

  if(domain==="estados_solicitudes"||domain==="abastecimiento_estados"){
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
    SpreadsheetApp.flush();return{ok:true};
  }

  throw new Error("Dominio de outbox no implementado: "+domain+" / "+op);
}

/* Override: registra errores en Supabase, deja el evento pendiente para retry y
   sólo ACKea eventos realmente aplicados al Sheet. */
function syncSupabaseOutboxToSheets(){
  var events=deltaSupabaseRpc_("app_sync_outbox_pull",{p_limit:100})||[],acked=[],errors=[];
  (events||[]).forEach(function(event){
    try{
      deltaApplyOutboxEvent_(event);
      acked.push(Number(event.id));
    }catch(err){
      var message=String(err&&err.message||err||"Error de sincronización");
      errors.push({id:event.id,domain:event.domain,operation:event.operation,error:message});
      try{deltaSupabaseRpc_("app_sync_outbox_fail",{p_id:Number(event.id),p_error:message});}catch(_failErr){}
    }
  });
  if(acked.length)deltaSupabaseRpc_("app_sync_outbox_ack",{p_ids:acked});
  SpreadsheetApp.flush();
  return{ok:errors.length===0,processed:events.length,acked:acked.length,failed:errors.length,errors:errors};
}
