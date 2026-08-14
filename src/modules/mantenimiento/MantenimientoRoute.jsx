import React from "react";
import {PageLoadingMotoniveladora} from "../../components/ui/index.jsx";
import {createHistoricalPagedController,fetchAllDatasetPages} from "../../data/historicalDataService.js";
import {normalizeRMA15} from "../../shared/domain/index.jsx";

const LazyMantenimientoModule=React.lazy(()=>import("./MantenimientoModule.jsx"));

export default function MantenimientoRoute(props){
  const controllerRef=React.useRef(null);
  if(!controllerRef.current)controllerRef.current=createHistoricalPagedController();
  const params=React.useMemo(()=>({sortBy:"fecha",sortDirection:"desc",limit:"all"}),[]);
  const [remote,setRemote]=React.useState({rows:[],total:0,hasMore:false,loading:true});
  const normalize=React.useCallback(rows=>(rows||[]).map(row=>normalizeRMA15({...row,_proyectoForzado:row.Proyecto||row.proyecto||"S/D"},props.insumos||{})),[props.insumos]);
  React.useEffect(()=>{let alive=true;controllerRef.current.loadFirst("rma15",params).then(result=>{if(alive)setRemote({rows:normalize(result.rows),total:result.total,hasMore:result.hasMore,loading:false});}).catch(()=>{if(alive)setRemote(value=>({...value,loading:false}));});return()=>{alive=false;};},[params,normalize]);
  const loadMore=React.useCallback(async()=>{const result=await controllerRef.current.loadMore("rma15",params);if(!result.stale)setRemote({rows:normalize(result.rows),total:result.total,hasMore:result.hasMore,loading:false});},[params,normalize]);
  const exportAll=React.useCallback(async()=>{const rows=[];await fetchAllDatasetPages("rma15",params,page=>{rows.push(...page);});return normalize(rows);},[params,normalize]);
  return <React.Suspense fallback={<PageLoadingMotoniveladora label="Cargando Mantenimiento..."/>}><LazyMantenimientoModule {...props} rma15={remote.rows.length?remote.rows:props.rma15||[]} remoteTotal={remote.total} remoteHasMore={remote.hasMore} onRemoteMore={loadMore} onRemoteExport={exportAll}/></React.Suspense>;
}
