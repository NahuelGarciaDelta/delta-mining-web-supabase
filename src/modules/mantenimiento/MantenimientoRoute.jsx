import React from "react";
import {PageLoadingMotoniveladora} from "../../components/ui/index.jsx";
import {createHistoricalPagedController,fetchAllDatasetPages} from "../../data/historicalDataService.js";
import {normalizeRMA15} from "../../shared/domain/index.jsx";

const LazyMantenimientoModule=React.lazy(()=>import("./MantenimientoModule.jsx"));

const pmNorm=v=>String(v??"").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Z0-9]+/g,"").trim();
const pmText=v=>String(v??"").trim();

function buildPmEquipmentUniverse(listaEquipos=[],rop02All=[]){
  const rows=[...(listaEquipos||[])];
  const seen=new Set();
  const readCode=row=>pmText(row?.["Codigo nuevo"]||row?.["Código nuevo"]||row?.["Código de Drusila"]||row?.["Codigo de Drusila"]||row?.Interno||row?.["Código interno"]||row?.["Codigo interno"]);
  rows.forEach(row=>{const key=pmNorm(readCode(row));if(key)seen.add(key);});

  // ROP02 es la fuente operativa real del universo de PM. Todo interno que tenga
  // actividad en ROP02 debe poder verse y registrar PM aunque no exista en Lista Maestra.
  (rop02All||[]).forEach(row=>{
    const interno=pmText(row?.maquina||row?._internoRaw||row?.interno||row?.Interno);
    const key=pmNorm(interno);
    if(!key||seen.has(key))return;
    seen.add(key);
    const proyecto=pmText(row?.proyecto||row?.Proyecto||row?.lugar||row?.Lugar);
    const familia=pmText(row?.familia||row?.Familia||row?.tipoEquipo||row?.["Tipo equipo"]||row?.tipo||row?.Tipo||"Vehículo / Equipo");
    rows.push({
      "Codigo nuevo":interno,
      "Código nuevo":interno,
      "Interno":interno,
      "Familia":familia,
      "Tipo equipo":familia,
      "Proyecto":proyecto,
      "Lugar":proyecto,
      "Propiedad":pmText(row?.propiedad||row?.Propiedad),
      "Marca":pmText(row?.marca||row?.Marca),
      "Modelo":pmText(row?.modelo||row?.Modelo),
      _pmSource:"ROP02"
    });
  });
  return rows;
}

export default function MantenimientoRoute(props){
  const controllerRef=React.useRef(null);
  if(!controllerRef.current)controllerRef.current=createHistoricalPagedController();
  const params=React.useMemo(()=>({sortBy:"fecha",sortDirection:"desc",limit:"all"}),[]);
  const [remote,setRemote]=React.useState({rows:[],total:0,hasMore:false,loading:true});
  const normalize=React.useCallback(rows=>(rows||[]).map(row=>normalizeRMA15({...row,_proyectoForzado:row.Proyecto||row.proyecto||"S/D"},props.insumos||{})),[props.insumos]);
  React.useEffect(()=>{let alive=true;controllerRef.current.loadFirst("rma15",params).then(result=>{if(alive)setRemote({rows:normalize(result.rows),total:result.total,hasMore:result.hasMore,loading:false});}).catch(()=>{if(alive)setRemote(value=>({...value,loading:false}));});return()=>{alive=false;};},[params,normalize]);
  const loadMore=React.useCallback(async()=>{const result=await controllerRef.current.loadMore("rma15",params);if(!result.stale)setRemote({rows:normalize(result.rows),total:result.total,hasMore:result.hasMore,loading:false});},[params,normalize]);
  const exportAll=React.useCallback(async()=>{const rows=[];await fetchAllDatasetPages("rma15",params,page=>{rows.push(...page);});return normalize(rows);},[params,normalize]);
  const pmListaEquipos=React.useMemo(()=>buildPmEquipmentUniverse(props.listaEquipos||[],props.rop02All||[]),[props.listaEquipos,props.rop02All]);
  return <React.Suspense fallback={<PageLoadingMotoniveladora label="Cargando Mantenimiento..."/>}><LazyMantenimientoModule {...props} listaEquipos={pmListaEquipos} rma15={remote.rows.length?remote.rows:props.rma15||[]} remoteTotal={remote.total} remoteHasMore={remote.hasMore} onRemoteMore={loadMore} onRemoteExport={exportAll}/></React.Suspense>;
}
