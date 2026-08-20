import React from "react";
import { PageLoadingMotoniveladora } from "../../components/ui/index.jsx";
import {createHistoricalPagedController,fetchAllDatasetPages} from "../../data/historicalDataService.js";
import {normalizeRMA15} from "../../shared/domain/index.jsx";

const LazyMantenimientoModule = React.lazy(() => import("./MantenimientoModule.jsx"));

const pmNorm=v=>String(v??"").toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^A-Z0-9]+/g,"").trim();
const pmText=v=>String(v??"").trim();

function buildPmEquipmentUniverse(listaEquipos=[],rop02All=[]){
  const rows=[...(listaEquipos||[])];
  const seen=new Set();
  const readCode=row=>pmText(row?.["Codigo nuevo"]||row?.["Código nuevo"]||row?.["Código de Drusila"]||row?.["Codigo de Drusila"]||row?.Interno||row?.["Código interno"]||row?.["Codigo interno"]);
  rows.forEach(row=>{const key=pmNorm(readCode(row));if(key)seen.add(key);});
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

function cloneRma15Rows(rows){
  return (Array.isArray(rows)?rows:[]).map(row=>{
    if(!row||typeof row!=="object")return row;
    const copy={...row};
    if(Array.isArray(row.insumos))copy.insumos=row.insumos.map(item=>item&&typeof item==="object"?{...item}:item);
    return copy;
  });
}

function normalizeRemoteRows(rows,insumos){
  return (Array.isArray(rows)?rows:[]).map(row=>normalizeRMA15({
    ...row,
    _proyectoForzado:row.Proyecto||row.proyecto||"S/D"
  },insumos||{}));
}

export default function MantenimientoRoute(props){
  const controllerRef=React.useRef(null);
  const requestRef=React.useRef(0);
  const [remote,setRemote]=React.useState(null);

  if(!controllerRef.current)controllerRef.current=createHistoricalPagedController();

  const baseRma15=React.useMemo(()=>cloneRma15Rows(props.rma15),[props.rma15]);
  const pmListaEquipos=React.useMemo(()=>buildPmEquipmentUniverse(props.listaEquipos||[],props.rop02All||[]),[props.listaEquipos,props.rop02All]);

  const state=props.extState||{};
  const single=value=>Array.isArray(value)?(value.length===1?value[0]:""):value;
  const mainSort=state.rma15Sorts?.ordenesPeriodo;
  const params=React.useMemo(()=>({
    desde:state.modo==="dia"?(state.fechaDia||""):(state.fechaD||""),
    hasta:state.modo==="dia"?(state.fechaDia||""):(state.fechaH||""),
    proyecto:single(state.proyecto)!=="todos"?single(state.proyecto):"",
    equipo:single(state.maquina)!=="todas"?single(state.maquina):"",
    tipo:single(state.tipoMant)!=="todos"?single(state.tipoMant):"",
    sortBy:mainSort?.key||"fecha",
    sortDirection:mainSort?.dir||"desc"
  }),[state.modo,state.fechaDia,state.fechaD,state.fechaH,state.proyecto,state.maquina,state.tipoMant,mainSort?.key,mainSort?.dir]);

  const hasRemoteFilter=React.useMemo(()=>Boolean(
    params.desde||params.hasta||params.proyecto||params.equipo||params.tipo
  ),[params.desde,params.hasta,params.proyecto,params.equipo,params.tipo]);

  React.useEffect(()=>{
    if(props.mode!=="mantenimiento"||!hasRemoteFilter){
      ++requestRef.current;
      setRemote(null);
      return;
    }

    const requestId=++requestRef.current;
    let alive=true;
    setRemote(null);

    controllerRef.current.loadFirst("rma15",params).then(result=>{
      if(!alive||requestId!==requestRef.current||result.stale)return;
      setRemote({
        rows:cloneRma15Rows(normalizeRemoteRows(result.rows,props.insumos)),
        total:result.total,
        hasMore:result.hasMore,
        requestId
      });
    }).catch(()=>{});

    return()=>{alive=false;};
  },[props.mode,hasRemoteFilter,params,props.insumos]);

  const loadMore=React.useCallback(()=>{
    if(!hasRemoteFilter)return Promise.resolve(null);
    const requestId=requestRef.current;
    return controllerRef.current.loadMore("rma15",params).then(result=>{
      if(requestId!==requestRef.current||result.stale)return result;
      setRemote({
        rows:cloneRma15Rows(normalizeRemoteRows(result.rows,props.insumos)),
        total:result.total,
        hasMore:result.hasMore,
        requestId
      });
      return result;
    });
  },[hasRemoteFilter,params,props.insumos]);

  const exportAll=React.useCallback(async()=>{
    if(!hasRemoteFilter)return cloneRma15Rows(baseRma15);
    const rows=[];
    await fetchAllDatasetPages("rma15",params,page=>{rows.push(...page);});
    return cloneRma15Rows(normalizeRemoteRows(rows,props.insumos));
  },[hasRemoteFilter,baseRma15,params,props.insumos]);

  const effective=React.useMemo(()=>{
    const isolatedProps={...props,rma15:baseRma15,listaEquipos:pmListaEquipos};
    if(props.mode!=="mantenimiento"||!hasRemoteFilter||!remote)return isolatedProps;
    return {
      ...isolatedProps,
      rma15:cloneRma15Rows(remote.rows),
      remoteTotal:remote.total,
      remoteHasMore:remote.hasMore,
      onRemoteMore:loadMore,
      onRemoteExport:exportAll
    };
  },[props,baseRma15,pmListaEquipos,hasRemoteFilter,remote,loadMore,exportAll]);

  return (
    <React.Suspense fallback={<PageLoadingMotoniveladora label="Cargando Mantenimiento..."/>}>
      <LazyMantenimientoModule {...effective}/>
    </React.Suspense>
  );
}
