const pendingRequests=new Map();
const debugEvents=[];
const counters={"cache-hit":0,"cache-miss":0,"request-started":0,"request-deduplicated":0,"request-finished":0,"request-failed":0,"request-aborted":0};

const debugEnabled=()=>{
  try{
    if(typeof localStorage!=="undefined"&&localStorage.getItem("dm_data_load_debug")==="1")return true;
  }catch(_){/* noop */}
  try{return String(import.meta?.env?.VITE_DATA_LOAD_DEBUG||"")==="1";}catch(_){return false;}
};

function stableValue(value){
  if(Array.isArray(value))return value.map(stableValue);
  if(value&&typeof value==="object")return Object.fromEntries(Object.keys(value).sort().map(key=>[key,stableValue(value[key])]));
  return value;
}

export function stableRequestParams(params={}){return JSON.stringify(stableValue(params||{}));}
export function buildRequestKey(dataset,params={}){return `${String(dataset||"unknown")}:${stableRequestParams(params)}`;}

function emit(type,detail={}){
  counters[type]=(counters[type]||0)+1;
  const entry={type,at:Date.now(),...detail};
  debugEvents.push(entry);
  if(debugEvents.length>250)debugEvents.shift();
  if(debugEnabled()&&typeof console!=="undefined")console.debug("[data-load]",entry);
  return entry;
}

export function markCacheHit(key,detail={}){emit("cache-hit",{key,...detail});}
export function markCacheMiss(key,detail={}){emit("cache-miss",{key,...detail});}

export function runDedupedRequest(key,factory,meta={}){
  const requestKey=String(key||"");
  const current=pendingRequests.get(requestKey);
  if(current){emit("request-deduplicated",{key:requestKey,...meta});return current.promise;}
  const controller=typeof AbortController!=="undefined"?new AbortController():null;
  const started=Date.now();
  emit("request-started",{key:requestKey,...meta});
  let produced;
  try{
    produced=factory({signal:controller?.signal||null,key:requestKey});
  }catch(error){
    produced=Promise.reject(error);
  }
  let promise;
  promise=Promise.resolve(produced)
    .then(value=>{
      const rows=Array.isArray(value)?value.length:Array.isArray(value?.data)?value.data.length:undefined;
      emit("request-finished",{key:requestKey,durationMs:Date.now()-started,rows,...meta});
      return value;
    })
    .catch(error=>{
      const aborted=error?.name==="AbortError"||controller?.signal?.aborted;
      emit(aborted?"request-aborted":"request-failed",{key:requestKey,durationMs:Date.now()-started,error:String(error?.message||error),...meta});
      throw error;
    })
    .finally(()=>{if(pendingRequests.get(requestKey)?.promise===promise)pendingRequests.delete(requestKey);});
  pendingRequests.set(requestKey,{promise,controller,started,meta});
  return promise;
}

export function cancelRequest(key){
  const item=pendingRequests.get(String(key||""));
  if(!item)return false;
  item.controller?.abort();
  return true;
}

export function cancelRequestsByPrefix(prefix){
  let count=0;
  const value=String(prefix||"");
  for(const [key,item] of pendingRequests){if(key.startsWith(value)){item.controller?.abort();count+=1;}}
  return count;
}

export function getRequestDebugSnapshot(){return{pending:[...pendingRequests.keys()],counters:{...counters},events:[...debugEvents]};}
export function resetRequestCoordinatorForTests(){pendingRequests.clear();debugEvents.length=0;for(const key of Object.keys(counters))counters[key]=0;}
