const normalizeId=id=>String(id||"").replace(/\\/g,"/").split("?")[0];

const OLD='const results=await Promise.allSettled(toCheck.map(key=>fetchOneSource(key,{force,serverVersions,cacheRecords})));';
const NEW=`const results=[];
      // Las vistas pueden necesitar varias fuentes grandes (ROP02/RMA15/lista).
      // Ejecutarlas todas a la vez satura PostgREST/Postgres y dispara
      // "canceling statement due to statement timeout" incluso para tablas chicas.
      // Se serializan las revalidaciones: la UI ya está hidratada desde IndexedDB,
      // por lo que esto ocurre en background sin bloquear al usuario.
      for(const key of toCheck){
        try{
          const value=await fetchOneSource(key,{force,serverVersions,cacheRecords});
          results.push({status:'fulfilled',value});
        }catch(reason){
          results.push({status:'rejected',reason});
        }
      }`;

export function supabaseSourceThrottleVitePlugin(){
  return{
    name:'delta-supabase-source-throttle',
    enforce:'pre',
    transform(code,id){
      const file=normalizeId(id);
      if(!file.endsWith('/src/App.jsx'))return null;
      if(code.includes(NEW))return null;
      if(!code.includes(OLD))throw new Error('[supabase-source-throttle] No se encontró la carga paralela esperada');
      return{code:code.replace(OLD,NEW),map:null};
    }
  };
}
