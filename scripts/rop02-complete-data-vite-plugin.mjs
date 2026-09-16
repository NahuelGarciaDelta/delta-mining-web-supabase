export function rop02CompleteDataVitePlugin(){
  return {
    name:'delta-rop02-complete-data',
    enforce:'pre',
    transform(code,id){
      if(!id.endsWith('/src/modules/oficina-tecnica/OficinaTecnicaModule.jsx'))return null;
      let s=code;

      // ROP02 ya se carga completo por VIEW_SOURCES/getOperationalSource. Evitar una
      // segunda consulta paginada de 250 filas que convertía una página parcial en
      // la fuente de verdad de la pantalla y podía ocultar registros recientes.
      s=s.replace(
        'const remoteDataset=view==="rop02"?"rop02":view==="rop05"?"rop05":"";',
        'const remoteDataset=view==="rop05"?"rop05":"";'
      );

      const oldView=`  if(view==="rop02"){
    if(remoteTable.dataset!=="rop02"||!remoteTable.loadedOnce)return <Loader label="Cargando ROP02..."/>;
    return <ViewROP02 rop02All={remoteTable.rows} listaEquipos={listaEquipos} extState={st02} setExtState={setSt02} remoteTotal={remoteTable.total} remoteHasMore={remoteTable.hasMore} onRemoteMore={loadMoreRemote} onRemoteExport={exportRemote} remoteStats={remoteStats} remoteFacets={remoteFacets}/>;
  }`;
      const newView=`  if(view==="rop02"){
    const rop02Ready=sourceHasData("rop02_fs")||sourceHasData("rop02_jm")||sourceHasData("rop02_filosur")||sourceHasData("rop02_zorro");
    if(!rop02Ready)return <Loader label="Cargando ROP02..."/>;
    return <ViewROP02 rop02All={effectiveRop02} listaEquipos={listaEquipos} extState={st02} setExtState={setSt02} remoteTotal={effectiveRop02.length} remoteHasMore={false} onRemoteMore={null} onRemoteExport={async()=>effectiveRop02} remoteStats={null} remoteFacets={null}/>;
  }`;
      s=s.replace(oldView,newView);

      // La fecha automática de ROP02 debe seguir a la última fecha disponible.
      // Se guarda _latestSeen: si el usuario permanece en la última fecha, avanza
      // cuando llegan datos nuevos; si eligió una fecha histórica, se respeta.
      const oldProd='  const rop02Prod=useMemo(()=>rop02All.filter(r=>!r._excluded && normalizeMachineCode(r.maquina)!=="CAA-0002"),[rop02All]);';
      const newProd=`  const rop02Prod=useMemo(()=>rop02All.filter(r=>!r._excluded && normalizeMachineCode(r.maquina)!=="CAA-0002"),[rop02All]);
  const latestRop02Date=useMemo(()=>{
    let latest="";
    for(const row of rop02Prod){const value=normDate(row?.fecha);if(value&&value>latest)latest=value;}
    return latest;
  },[rop02Prod]);
  useEffect(()=>{
    if(!latestRop02Date||!setExtState)return;
    setExtState(current=>{
      const state=current||{};
      const previousLatest=String(state._latestSeen||"");
      const mode=state.mode||"dia";
      const currentDate=String(state.fecha||"");
      if(!previousLatest){
        const nextDate=mode==="dia"?latestRop02Date:state.fecha;
        return {...state,fecha:nextDate,_latestSeen:latestRop02Date};
      }
      const shouldAdvance=mode==="dia"&&currentDate===previousLatest&&latestRop02Date>previousLatest;
      if(previousLatest===latestRop02Date&&!shouldAdvance)return state;
      return {...state,fecha:shouldAdvance?latestRop02Date:state.fecha,_latestSeen:latestRop02Date};
    });
  },[latestRop02Date,setExtState]);`;
      s=s.replace(oldProd,newProd);

      if(s===code)throw new Error('rop02CompleteDataVitePlugin: no se encontraron los contratos esperados de OficinaTecnicaModule.jsx');
      if(s.includes('const remoteDataset=view==="rop02"?"rop02":view==="rop05"?"rop05":"";'))throw new Error('rop02CompleteDataVitePlugin: quedó activa la consulta paginada duplicada de ROP02');
      if(!s.includes('rop02All={effectiveRop02}'))throw new Error('rop02CompleteDataVitePlugin: ROP02 no quedó conectado al dataset completo');
      return {code:s,map:null};
    }
  };
}
