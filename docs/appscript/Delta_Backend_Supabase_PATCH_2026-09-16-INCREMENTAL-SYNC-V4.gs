/* =========================================================
   DELTA MINING OPS — PATCH INCREMENTAL 2026-09-16 V4

   Objetivos:
   - NO resincronizar todos los Sheets cada 5 minutos.
   - onEdit/onChange sólo marca los datasets realmente afectados.
   - Cada 5 min: Outbox -> Sheets + dirty Sheets -> Supabase.
   - Cada 1 h: reconciliación autoritativa completa de seguridad.
   ========================================================= */

DELTA_BACKEND_VERSION_ = "2026-09-16-INCREMENTAL-OUTBOX-V4";

var DELTA_DIRTY_DATASETS_PROPERTY_ = "DELTA_SUPABASE_DIRTY_DATASETS_V4";
var DELTA_INCREMENTAL_HANDLER_ = "sincronizarDeltaCambiosPendientes_";
var DELTA_RECONCILE_HANDLER_ = "reconciliarDeltaConSupabase_";
var DELTA_LEGACY_TIMER_HANDLER_ = "sincronizarDeltaConSupabaseCada5Min";

function deltaUniqueStrings_(values){
  var seen={},out=[];
  (values||[]).forEach(function(value){
    var key=String(value||"").trim();
    if(key&&!seen[key]){seen[key]=true;out.push(key);}
  });
  return out;
}

function deltaReadDirtyDatasets_(){
  try{
    var raw=PropertiesService.getScriptProperties().getProperty(DELTA_DIRTY_DATASETS_PROPERTY_)||"[]";
    var parsed=JSON.parse(raw);
    return deltaUniqueStrings_(Array.isArray(parsed)?parsed:[]);
  }catch(_err){return[];}
}

function deltaWriteDirtyDatasets_(datasets){
  PropertiesService.getScriptProperties().setProperty(
    DELTA_DIRTY_DATASETS_PROPERTY_,
    JSON.stringify(deltaUniqueStrings_(datasets))
  );
}

function deltaMarkDatasetsDirty_(datasets){
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(5000))return;
  try{
    deltaWriteDirtyDatasets_(deltaReadDirtyDatasets_().concat(datasets||[]));
  }finally{try{lock.releaseLock();}catch(_releaseErr){}}
}

function deltaDatasetKeysForSheetEvent_(e){
  var spreadsheetId=e&&e.source?String(e.source.getId()):"";
  if(!spreadsheetId)return[];
  var sheetName="";
  try{if(e&&e.range&&e.range.getSheet)sheetName=String(e.range.getSheet().getName()||"");}catch(_rangeErr){}
  var normalized=sheetName.trim().toUpperCase();
  var keys=[];

  // Datasets declarados directamente en SHEETS_CONFIG.
  Object.keys(SHEETS_CONFIG).forEach(function(key){
    var cfg=SHEETS_CONFIG[key];
    if(String(cfg.id)!==spreadsheetId)return;
    if(!sheetName || String(cfg.sheet||"").trim().toUpperCase()===normalized)keys.push(key);
  });

  // Hojas auxiliares que comparten spreadsheet pero no tienen entrada propia.
  if(String(SHEETS_CONFIG.raba03&&SHEETS_CONFIG.raba03.id||"")===spreadsheetId){
    if(!sheetName||normalized==="ESTADOS SOLICITUDES")keys.push("estados_solicitudes");
    if(!sheetName||normalized===String(STOCK_MAIN_SHEET_||"").toUpperCase()||normalized.indexOf("STOCK_")===0||normalized.indexOf("STOCK ")===0)keys.push("stock");
  }

  if(typeof PM_DB_ID_!=="undefined"&&String(PM_DB_ID_)===spreadsheetId){
    if(!sheetName||normalized==="PM_CONFIG")keys.push("pm_config");
    if(!sheetName||normalized==="PM_REGISTROS")keys.push("pm_registros");
    if(!sheetName||normalized==="PM_PROGRAMACION")keys.push("pm_programaciones");
    if(!sheetName||normalized==="PM_REPUESTOS")keys.push("pm_repuestos");
  }

  if(typeof LICITACIONES_DB_ID_!=="undefined"&&String(LICITACIONES_DB_ID_)===spreadsheetId){
    if(!sheetName||["LICITACIONES","HITOS","EQUIPOS"].indexOf(normalized)>=0)keys.push("licitaciones");
  }

  if(typeof MOVIMIENTOS_EQUIPOS_DB_ID_!=="undefined"&&String(MOVIMIENTOS_EQUIPOS_DB_ID_)===spreadsheetId){
    if(!sheetName||normalized===String(MOVIMIENTOS_EQUIPOS_SHEET_||"MOVIMIENTOS_EQUIPOS").toUpperCase())keys.push("movimientos_equipos");
    var tallerNames=[];
    try{tallerNames=Object.keys(TALLER_MOV_SHEETS_||{}).map(function(type){return String(TALLER_MOV_SHEETS_[type]||"").toUpperCase();});}catch(_tallerErr){}
    if(!sheetName||tallerNames.indexOf(normalized)>=0)keys.push("movimientos_taller");
  }

  return deltaUniqueStrings_(keys);
}

/* Override: el trigger ya no hace lecturas masivas ni RPC pesadas.
   Sólo invalida caché/versiones y encola los datasets afectados. */
function onDatasetSheetChange_(e){
  try{
    var keys=deltaDatasetKeysForSheetEvent_(e);
    keys.forEach(function(key){
      // Los datasets virtuales no necesariamente tienen SHEETS_CONFIG, pero
      // bumpDatasetVersion_ admite claves libres.
      try{bumpDatasetVersion_(key);}catch(_bumpErr){}
    });
    deltaMarkDatasetsDirty_(keys);
    clearAllCache_();
  }catch(err){
    console.error("Error marcando datasets modificados:",err);
  }
}

function deltaSyncOneDirtyDataset_(key){
  if(DELTA_SUPABASE_ROP02_DATASETS_.indexOf(key)>=0)return deltaSyncRop02_(key);
  if(DELTA_SUPABASE_TYPED_DATASETS_.indexOf(key)>=0)return deltaSyncTyped_(key);
  if(key==="raba03")return deltaSyncRaba03_();
  if(key==="remitos_cargados")return deltaSyncRemitos_();
  if(key==="usuarios")return deltaSyncUsuarios_();
  if(key==="articulos_desgaste")return deltaSyncWearArticles_();
  if(key==="estados_solicitudes")return deltaSyncEstadosSolicitudes_();
  if(key==="stock")return deltaSyncStock_();
  if(key==="movimientos_equipos")return deltaSyncEquipmentMovements_();
  if(key==="movimientos_taller")return deltaSyncTallerMovements_();

  if(key==="licitaciones"){
    var lic=handleGetLicitacionesCompartidas_();
    return deltaSupabaseRpc_("sync_authoritative_app_dataset",{
      p_dataset:"licitaciones",p_rows:(lic&&lic.data)||[],p_meta:{source:"Sheets",authoritative:true}
    });
  }

  if(key==="pm_config"||key==="pm_registros"||key==="pm_programaciones"||key==="pm_repuestos"){
    var pm=handleGetMantenimientoProgramado_()||{};
    var mapping={
      pm_config:pm.config||[],
      pm_registros:pm.registros||[],
      pm_programaciones:pm.programaciones||[],
      pm_repuestos:pm.repuestos||[]
    };
    return deltaSupabaseRpc_("sync_authoritative_app_dataset",{
      p_dataset:key,p_rows:mapping[key]||[],p_meta:{source:"Sheets",authoritative:true}
    });
  }

  if(SHEETS_CONFIG[key])return deltaSyncGeneric_(key);
  throw new Error("Dataset dirty no soportado: "+key);
}

function sincronizarDeltaCambiosPendientes_(){
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))return{ok:true,skipped:true,reason:"sync_en_curso"};
  try{
    var pull=deltaSafeRun_(syncSupabaseOutboxToSheets);
    var dirty=deltaReadDirtyDatasets_(),results={},failed=[];

    dirty.forEach(function(key){
      var result=deltaSafeRun_(function(){return deltaSyncOneDirtyDataset_(key);});
      results[key]=result;
      if(result&&result.ok===false)failed.push(key);
    });

    // Sólo quedan pendientes los que fallaron. Nuevos eventos que lleguen durante
    // la ejecución no se pierden: el lock serializa la escritura de la propiedad.
    deltaWriteDirtyDatasets_(failed);

    var at=new Date().toISOString();
    if(dirty.length)deltaStoreSyncAudit_(results,at);
    PropertiesService.getScriptProperties().setProperty("DELTA_SUPABASE_LAST_INCREMENTAL_SYNC",at);

    return{
      ok:pull.ok!==false&&failed.length===0,
      pull:pull,
      dirty:dirty,
      processed:dirty.length,
      failed:failed,
      results:results,
      at:at
    };
  }finally{try{lock.releaseLock();}catch(_releaseErr){}}
}

function reconciliarDeltaConSupabase_(){
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(1000))return{ok:true,skipped:true,reason:"sync_en_curso"};
  try{
    var pull=deltaSafeRun_(syncSupabaseOutboxToSheets);
    var push=syncAllConfiguredDatasetsToSupabase();
    var at=new Date().toISOString();
    var datasets=deltaStoreSyncAudit_(push.results||{},at);
    PropertiesService.getScriptProperties().setProperty("DELTA_SUPABASE_LAST_SYNC",at);
    return{ok:pull.ok!==false&&push.ok!==false,pull:pull,push:push,datasets:datasets,at:at};
  }finally{try{lock.releaseLock();}catch(_releaseErr){}}
}

/* Compatibilidad manual: si alguien ejecuta el nombre anterior desde el editor,
   no vuelve a disparar el full-sync de cinco minutos. */
function sincronizarDeltaConSupabaseCada5Min(){
  return sincronizarDeltaCambiosPendientes_();
}

/* Override del instalador:
   - borra timers legacy o duplicados
   - instala incremental cada 5 min
   - instala reconciliación completa cada 1 h
   - instala onEdit + onChange para todos los spreadsheets configurados */
function INSTALAR_DELTA_SUPABASE(){
  var handlers={};
  handlers[DELTA_LEGACY_TIMER_HANDLER_]=true;
  handlers[DELTA_INCREMENTAL_HANDLER_]=true;
  handlers[DELTA_RECONCILE_HANDLER_]=true;

  ScriptApp.getProjectTriggers().forEach(function(trigger){
    if(handlers[trigger.getHandlerFunction()])ScriptApp.deleteTrigger(trigger);
  });

  ScriptApp.newTrigger(DELTA_INCREMENTAL_HANDLER_).timeBased().everyMinutes(5).create();
  ScriptApp.newTrigger(DELTA_RECONCILE_HANDLER_).timeBased().everyHours(1).create();

  var triggerResult=setupSyncTriggers_();
  deltaMarkDatasetsDirty_(Object.keys(SHEETS_CONFIG).concat([
    "estados_solicitudes","stock","movimientos_equipos","movimientos_taller",
    "licitaciones","pm_config","pm_registros","pm_programaciones","pm_repuestos"
  ]));

  return{
    ok:triggerResult.ok!==false,
    version:DELTA_BACKEND_VERSION_,
    incrementalEveryMinutes:5,
    reconciliationEveryHours:1,
    sheetTriggers:triggerResult,
    state:estadoSincronizacionSupabase()
  };
}

function estadoSincronizacionSupabase(){
  var p=PropertiesService.getScriptProperties(),datasets={};
  try{datasets=JSON.parse(p.getProperty(DELTA_SUPABASE_AUDIT_PROPERTY_)||"{}");}catch(_err){datasets={};}
  var triggers=ScriptApp.getProjectTriggers().map(function(t){return{handler:t.getHandlerFunction(),event:String(t.getEventType())};});
  return{
    ok:true,
    version:DELTA_BACKEND_VERSION_,
    configured:{url:!!p.getProperty("DELTA_SUPABASE_URL"),serviceRoleKey:!!p.getProperty("DELTA_SUPABASE_SERVICE_ROLE_KEY")},
    triggers:triggers,
    dirtyDatasets:deltaReadDirtyDatasets_(),
    lastIncrementalSync:p.getProperty("DELTA_SUPABASE_LAST_INCREMENTAL_SYNC")||null,
    lastFullReconciliation:p.getProperty("DELTA_SUPABASE_LAST_SYNC")||null,
    datasets:datasets
  };
}
