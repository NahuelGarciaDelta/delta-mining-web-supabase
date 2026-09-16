export function operationalFreshnessVitePlugin(){
  return {
    name:'delta-operational-freshness',
    enforce:'pre',
    transform(code,id){
      if(!id.endsWith('/src/App.jsx'))return null;
      let s=code;

      const importMarker='import { getOperationalSource } from "./data/operationalRepository.js";';
      if(!s.includes(importMarker))throw new Error('operationalFreshnessVitePlugin: falta import getOperationalSource');
      s=s.replace(importMarker,`${importMarker}\nimport { getOperationalSourceVersions } from "./data/operationalSourceVersions.js";`);

      const timeoutMarker='  const SYNC_FRESH_MS=5*60*1000;';
      if(!s.includes(timeoutMarker))throw new Error('operationalFreshnessVitePlugin: falta SYNC_FRESH_MS');
      s=s.replace(timeoutMarker,`${timeoutMarker}\n  const OPERATIONAL_SOURCE_TIMEOUT_MS=30000;\n  const withOperationalSourceTimeout=useCallback((promise,key)=>new Promise((resolve,reject)=>{\n    const id=window.setTimeout(()=>reject(new Error(\`Tiempo agotado cargando \${key} desde Supabase\`)),OPERATIONAL_SOURCE_TIMEOUT_MS);\n    Promise.resolve(promise).then(\n      value=>{window.clearTimeout(id);resolve(value);},\n      error=>{window.clearTimeout(id);reject(error);}\n    );\n  }),[]);`);

      const fetchMarker=`      const fetched=SUPABASE_OPERATIONAL_KEYS.has(key)\n        ?await getOperationalSource(key)\n        :await fetchSource(APPS_SCRIPT_URL,key,{force,since:force?'':getCachedSourceTimestamp(cacheRecord)});`;
      const fetchReplacement=`      const fetched=SUPABASE_OPERATIONAL_KEYS.has(key)\n        ?await withOperationalSourceTimeout(getOperationalSource(key),key)\n        :await fetchSource(APPS_SCRIPT_URL,key,{force,since:force?'':getCachedSourceTimestamp(cacheRecord)});`;
      if(!s.includes(fetchMarker))throw new Error('operationalFreshnessVitePlugin: falta fetch operativo');
      s=s.replace(fetchMarker,fetchReplacement);

      const mergeMarker='      const value=mergeIncrementalSource(previous,fetched);';
      const mergeReplacement='      const fetchedWithVersion=serverVersion>0?{...fetched,meta:{...(fetched.meta||{}),serverVersion}}:fetched;\n      const value=mergeIncrementalSource(previous,fetchedWithVersion);';
      if(!s.includes(mergeMarker))throw new Error('operationalFreshnessVitePlugin: falta mergeIncrementalSource');
      s=s.replace(mergeMarker,mergeReplacement);

      const checkMarker=`    const now=Date.now();\n    const toCheck=force?requested:requested.filter(key=>{\n      const hasData=rawSourcesRef.current?.[key]?.ok&&Array.isArray(rawSourcesRef.current[key].data);\n      const fresh=now-Number(lastCheckedBySourceRef.current[key]||0)<SYNC_FRESH_MS;\n      return !hasData||!fresh;\n    });\n    if(!toCheck.length)return;`;
      const checkReplacement=`    const now=Date.now();\n    let serverVersions={};\n    try{\n      const versionKeys=requested.filter(key=>SUPABASE_OPERATIONAL_KEYS.has(key));\n      if(versionKeys.length){\n        const info=await getOperationalSourceVersions(versionKeys);\n        serverVersions=Object.fromEntries(Object.entries(info).map(([key,value])=>[key,Number(value?.serverVersion||0)]));\n      }\n    }catch(error){\n      console.warn("No se pudieron consultar versiones operativas; se aplica la política temporal de cache.",error);\n    }\n    const toCheck=force?requested:requested.filter(key=>{\n      const local=rawSourcesRef.current?.[key];\n      const hasData=local?.ok&&Array.isArray(local.data);\n      const fresh=now-Number(lastCheckedBySourceRef.current[key]||0)<SYNC_FRESH_MS;\n      const serverVersion=Number(serverVersions[key]||0);\n      const localVersion=Number(local?.meta?.serverVersion||cacheRecords[key]?.value?.meta?.serverVersion||0);\n      const changed=serverVersion>0&&serverVersion!==localVersion;\n      return !hasData||changed||!fresh;\n    });\n    if(!toCheck.length)return;`;
      if(!s.includes(checkMarker))throw new Error('operationalFreshnessVitePlugin: falta bloque toCheck');
      s=s.replace(checkMarker,checkReplacement);

      const start='      const serverVersions={};\n      const results=await Promise.allSettled(toCheck.map(key=>fetchOneSource(key,{force,serverVersions,cacheRecords})));';
      const end='        setLastUpdate(new Date());\n      }';
      const startIndex=s.indexOf(start);
      if(startIndex<0)throw new Error('operationalFreshnessVitePlugin: falta Promise.allSettled');
      const endIndex=s.indexOf(end,startIndex);
      if(endIndex<0)throw new Error('operationalFreshnessVitePlugin: no se pudo delimitar commit final');
      const progressive=`      const entries=[];\n      const softErrors=[];\n      const commitSource=(key,value)=>{\n        entries.push([key,value]);\n        startTransition(()=>{\n          setRawSources(prev=>{\n            if(prev[key]===value)return prev;\n            const next={...prev,[key]:value};\n            rawSourcesRef.current=next;\n            return next;\n          });\n          setLoadedSources(prev=>{\n            if(prev[key])return prev;\n            const next={...prev,[key]:true};\n            loadedSourcesRef.current=next;\n            return next;\n          });\n        });\n        setLastUpdate(new Date());\n      };\n\n      // Se mantiene una sola consulta pesada por vez para no saturar PostgREST,\n      // pero cada fuente se publica apenas termina: una fuente lenta ya no bloquea\n      // a las que ya respondieron ni deja ROP02 en un loader infinito.\n      for(const key of toCheck){\n        try{\n          const result=await fetchOneSource(key,{force,serverVersions,cacheRecords});\n          if(!result.skipped)commitSource(key,result.value);\n        }catch(error){\n          const previous=rawSourcesRef.current?.[key];\n          softErrors.push({source:key.toUpperCase(),message:previous?.ok&&Array.isArray(previous.data)\n            ?\`No se pudo actualizar (\${error?.message||'error desconocido'}). Se conservan los datos guardados.\`\n            :(error?.message||'No se pudo cargar la fuente.')});\n        }\n      }`;
      s=s.slice(0,startIndex)+progressive+s.slice(endIndex+end.length);

      if(s.includes('const results=await Promise.allSettled(toCheck.map'))throw new Error('operationalFreshnessVitePlugin: quedó el bloqueo allSettled anterior');
      if(!s.includes('getOperationalSourceVersions(versionKeys)'))throw new Error('operationalFreshnessVitePlugin: no quedó versionado Supabase');
      if(!s.includes('commitSource(key,result.value)'))throw new Error('operationalFreshnessVitePlugin: no quedó commit progresivo');
      return {code:s,map:null};
    }
  };
}
