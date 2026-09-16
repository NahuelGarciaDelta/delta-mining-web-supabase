/* DELTA MINING OPS — V4B
   Corrige carrera entre onEdit/onChange y el procesamiento incremental.
   Se toma el snapshot de dirty bajo lock, se libera el lock durante el trabajo
   pesado y los fallidos se reencolan sin pisar cambios nuevos. */

function deltaTakeDirtySnapshot_(){
  var lock=LockService.getScriptLock();
  if(!lock.tryLock(5000))return null;
  try{
    var dirty=deltaReadDirtyDatasets_();
    deltaWriteDirtyDatasets_([]);
    return dirty;
  }finally{try{lock.releaseLock();}catch(_releaseErr){}}
}

function sincronizarDeltaCambiosPendientes_(){
  var dirty=deltaTakeDirtySnapshot_();
  if(dirty===null)return{ok:true,skipped:true,reason:"dirty_lock_ocupado"};

  var pull=deltaSafeRun_(syncSupabaseOutboxToSheets);
  var results={},failed=[];

  dirty.forEach(function(key){
    var result=deltaSafeRun_(function(){return deltaSyncOneDirtyDataset_(key);});
    results[key]=result;
    if(result&&result.ok===false)failed.push(key);
  });

  if(failed.length)deltaMarkDatasetsDirty_(failed);

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
}
