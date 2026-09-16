/* =========================================================
   DELTA MINING OPS — AUTOSYNC SHEETS -> SUPABASE V5

   Un cambio manual en cualquiera de los Google Sheets configurados:
   1) marca únicamente los datasets afectados;
   2) programa una sincronización automática próxima (debounced);
   3) conserva el barrido cada 5 min como red de seguridad;
   4) conserva la reconciliación completa horaria para cambios que no disparan
      onEdit/onChange (por ejemplo ciertos recálculos/importaciones).
   ========================================================= */

DELTA_BACKEND_VERSION_ = "2026-09-16-SHEETS-AUTOSYNC-V5";

var DELTA_FAST_SYNC_HANDLER_ = "sincronizarDeltaCambiosPronto_";
var DELTA_FAST_SYNC_DELAY_MS_ = 30000;

function deltaDeleteFastSyncTriggers_(){
  ScriptApp.getProjectTriggers().forEach(function(trigger){
    if(trigger.getHandlerFunction()===DELTA_FAST_SYNC_HANDLER_)ScriptApp.deleteTrigger(trigger);
  });
}

function deltaEnsureFastSync_(){
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(5000))return false;
  try{
    var exists=ScriptApp.getProjectTriggers().some(function(trigger){
      return trigger.getHandlerFunction()===DELTA_FAST_SYNC_HANDLER_;
    });
    if(exists)return true;
    ScriptApp.newTrigger(DELTA_FAST_SYNC_HANDLER_)
      .timeBased()
      .after(DELTA_FAST_SYNC_DELAY_MS_)
      .create();
    return true;
  }catch(err){
    console.error("No se pudo programar sincronización rápida:",err);
    return false;
  }finally{try{lock.releaseLock();}catch(_releaseErr){}}
}

function sincronizarDeltaCambiosPronto_(){
  // Un trigger one-shot ya ejecutado no debe quedar duplicado junto al siguiente.
  try{deltaDeleteFastSyncTriggers_();}catch(_cleanupErr){}
  return sincronizarDeltaCambiosPendientes_();
}

/* Override V5: un edit/change ya no depende de que el usuario abra la app ni de
   que ejecute una sincronización manual. El evento queda dirty y se agenda solo. */
function onDatasetSheetChange_(e){
  try{
    var keys=deltaDatasetKeysForSheetEvent_(e);
    keys.forEach(function(key){
      try{bumpDatasetVersion_(key);}catch(_bumpErr){}
    });
    deltaMarkDatasetsDirty_(keys);
    clearAllCache_();
    if(keys.length)deltaEnsureFastSync_();
  }catch(err){
    console.error("Error marcando/programando datasets modificados:",err);
  }
}

/* Override V5 del instalador: instalación única. Después de esto, los cambios
   en Sheets se propagan solos. */
function INSTALAR_DELTA_SUPABASE(){
  var handlers={};
  handlers[DELTA_LEGACY_TIMER_HANDLER_]=true;
  handlers[DELTA_INCREMENTAL_HANDLER_]=true;
  handlers[DELTA_RECONCILE_HANDLER_]=true;
  handlers[DELTA_FAST_SYNC_HANDLER_]=true;

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
  deltaEnsureFastSync_();

  return{
    ok:triggerResult.ok!==false,
    version:DELTA_BACKEND_VERSION_,
    fastSyncDelaySeconds:Math.round(DELTA_FAST_SYNC_DELAY_MS_/1000),
    incrementalEveryMinutes:5,
    reconciliationEveryHours:1,
    sheetTriggers:triggerResult,
    state:estadoSincronizacionSupabase()
  };
}
