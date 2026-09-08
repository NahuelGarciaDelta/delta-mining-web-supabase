Warning: truncated output (original token count: 98554)
Total output lines: 6019

import React, { useState, useCallback, useMemo, useEffect, useRef, startTransition } from "react";
import ReactDOM from "react-dom";
import * as XLSX from "xlsx";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid, Legend, ReferenceLine } from "recharts";
import ComparisonStrip from "../../components/ComparisonStrip.jsx";
import {WeatherSummary} from "../weather/WeatherModule.jsx";
import { previousComparablePeriod } from "../../shared/periodCompare.js";
import { calculateAtrasoRop02, equipmentProjectKey, normalizeRop02Project } from "../home/homeAvailability.js";
import {cancelEquipmentMovement,saveEquipmentMovement,useEquipmentMovements} from "../../services/equipmentMovements.js";
import {createHistoricalPagedController,fetchAllDatasetPages,getRop02,getRop02Facets,getRop02LatestByEquipmentProject,getRop02OperationalSnapshot,getRop02Stats} from "../../data/historicalDataService.js";
import {calcControl,normalizeROP02,normalizeROP05} from "../../shared/domain/index.jsx";

// Dependencias compartidas inyectadas desde App mientras se completa la modularización.
const DEFAULT_COLORS={
  green:"#10b981", blue:"#3b82f6", teal:"#14b8a6", purple:"#8b5cf6",
  red:"#ef4444", yellow:"#f59e0b", text:"#f8fafc", textSub:"#cbd5e1",
  textMuted:"#94a3b8", card:"#111827", surface:"#0f172a", border:"#334155",
  redDim:"rgba(239,68,68,.12)", greenDim:"rgba(16,185,129,.12)",
  blueDim:"rgba(59,130,246,.12)", tealDim:"rgba(20,184,166,.12)",
  yellowDim:"rgba(245,158,11,.12)"
};
let AlertBanner, Badge, BtnExcel, C=DEFAULT_COLORS, Card, ChartTip, DateIn, HealthDashboard, IMG_CARGADORA_FRONTAL, IMG_EXCAVADORA, IMG_MINICARGADORA, IMG_MOTONIVELADORA, IMG_RETROPALA, IMG_RODILLO_COMPACTADOR, IMG_TOPADORA, Icon, LISTA_COLUMNS, ListaEquipoFieldInput, MultiSel, PeriodMonthYear, Sel, Spinner, StatCard, SubTab, TabBtn, Table, VEH_CAMIONETA, VEH_COMBUSTIBLE, VEH_REGADOR, VEH_TRACTOR, VEH_VOLCADOR, appAlert, appConfirm, buildHorometroMapForLista, buildListaEquipoInfoIndex, buildVehicleListaIndex, byDateFilter, canonicalEquivalentMachineCode, cleanKey, cleanMachine, dmDisplayTarea, dmMatchTipoMaquinaSeleccion, dmNormalizeUnidad, dmTipoMaquinaOptions, excelFromCols, findColumnKey, fmtFecha, fmtNum, fmtPct, generarExcelICHC, generarExcelListaMaestra, generarReporteControl, getListaEquipoInfoMatch, getListaVehicleMatch, getPropiedadVehiculoFromListaRow, getValue, isRop02ControlMachineExcluded, isValidEquipoCodigoParaCorrelacion, isYearOnlyListaField, machineCodeOutsideParentheses, machineLookupVariants, mainMachineCode, matchMulti, multiIsAll, normDate, normProject, normalizeMachineCode, normalizeVehicleFamily, normalizeYearValue, postAddListaEquipo, postBulkUpdateListaEquipos, postUpdateListaEquipo, postUpdateROP02Row, proyColor, semaforo, uniq, validPropiedadValue, BlockingDataLoader;
let anioAcumulado, anioAcumuladoOpts, periodoAcumulado, rangoAcumulado, setAnioAcumulado, setPeriodoAcumulado;

function applyDeps(deps={}){
  const previousC=C;
  ({AlertBanner, Badge, BtnExcel, C, Card, ChartTip, DateIn, HealthDashboard, IMG_CARGADORA_FRONTAL, IMG_EXCAVADORA, IMG_MINICARGADORA, IMG_MOTONIVELADORA, IMG_RETROPALA, IMG_RODILLO_COMPACTADOR, IMG_TOPADORA, Icon, LISTA_COLUMNS, ListaEquipoFieldInput, MultiSel, PeriodMonthYear, Sel, Spinner, StatCard, SubTab, TabBtn, Table, VEH_CAMIONETA, VEH_COMBUSTIBLE, VEH_REGADOR, VEH_TRACTOR, VEH_VOLCADOR, appAlert, appConfirm, buildHorometroMapForLista, buildListaEquipoInfoIndex, buildVehicleListaIndex, byDateFilter, canonicalEquivalentMachineCode, cleanKey, cleanMachine, dmDisplayTarea, dmMatchTipoMaquinaSeleccion, dmNormalizeUnidad, dmTipoMaquinaOptions, excelFromCols, findColumnKey, fmtFecha, fmtNum, fmtPct, generarExcelICHC, generarExcelListaMaestra, generarReporteControl, getListaEquipoInfoMatch, getListaVehicleMatch, getPropiedadVehiculoFromListaRow, getValue, isRop02ControlMachineExcluded, isValidEquipoCodigoParaCorrelacion, isYearOnlyListaField, machineCodeOutsideParentheses, machineLookupVariants, mainMachineCode, matchMulti, multiIsAll, normDate, normProject, normalizeMachineCode, normalizeVehicleFamily, normalizeYearValue, postAddListaEquipo, postBulkUpdateListaEquipos, postUpdateListaEquipo, postUpdateROP02Row, proyColor, semaforo, uniq, validPropiedadValue, BlockingDataLoader}=deps);
  C={...DEFAULT_COLORS,...(previousC||{}),...(deps.C||{})};
}

function ViewListaMaestraEquipos({rows,rop02All,rop05=[],rma15=[],onReloadLista}){
  const LISTA_MAESTRA_STORAGE_KEY="delta_lista_maestra_equipos_filters_v1";
  const readListaMaestraSaved=(key,def="")=>{
    try{return localStorage.getItem(`${LISTA_MAESTRA_STORAGE_KEY}_${key}`)??def;}
    catch(_){return def;}
  };
  const[search,setSearch]=useState(()=>readListaMaestraSaved("search",""));
  const[fechaHorometro,setFechaHorometro]=useState(()=>readListaMaestraSaved("fechaHorometro",""));
  const[soloActivos,setSoloActivos]=useState(()=>readListaMaestraSaved("soloActivos","false")==="true");
  const[filtersOpen,setFiltersOpen]=useState(false);
  const[addOpen,setAddOpen]=useState(false);
  const[newEquipo,setNewEquipo]=useState({});
  const[savingEquipo,setSavingEquipo]=useState(false);
  const[addMsg,setAddMsg]=useState(null);
  const[editOpen,setEditOpen]=useState(false);
  const[editEquipo,setEditEquipo]=useState({});
  const[editSelected,setEditSelected]=useState("");
  const[savingEdit,setSavingEdit]=useState(false);
  const[editMsg,setEditMsg]=useState(null);
  const[syncingListaExcel,setSyncingListaExcel]=useState(false);
  const[syncMsg,setSyncMsg]=useState(null);
  const[listaTab,setListaTab]=useState("maestra");

  useEffect(()=>{
    try{localStorage.setItem(`${LISTA_MAESTRA_STORAGE_KEY}_search`,search||"");}
    catch(_){}
  },[search]);

  useEffect(()=>{
    try{localStorage.setItem(`${LISTA_MAESTRA_STORAGE_KEY}_fechaHorometro`,fechaHorometro||"");}
    catch(_){}
  },[fechaHorometro]);

  useEffect(()=>{
    try{localStorage.setItem(`${LISTA_MAESTRA_STORAGE_KEY}_soloActivos`,String(soloActivos));}
    catch(_){}
  },[soloActivos]);

  const data=useMemo(()=>rows||[],[rows]);
  const allKeys=useMemo(()=>{
    const set=new Set();
    data.slice(0,200).forEach(r=>Object.keys(r||{}).forEach(k=>{if(k&&String(k).trim())set.add(k);}));
    return Array.from(set);
  },[data]);

  // Columna "HORAS" de la planilla: valor de respaldo cuando la máquina no
  // tiene registros en ROP02 (no se separa con findColumnKey para que no
  // "robe" el match de otras columnas como "Horas Trab. x Mes").
  const horasKey=useMemo(()=>allKeys.find(k=>cleanKey(k)==="horas"),[allKeys]);
  const searchableKeys=useMemo(()=>allKeys.filter(k=>k!==horasKey),[allKeys,horasKey]);

  // Clave de código usada para cruzar contra ROP02: el código fuera de
  // paréntesis en ROP02 (ej. "MOT-0024" en "MOT-0024 (MOT-0047)") corresponde
  // al "Código Drusila" de la lista maestra.
  const drusilaKey=useMemo(()=>findColumnKey(searchableKeys,"Codigo Drusila",["Codigo de Drusila","Cod Drusila"]),[searchableKeys]);
  const codigoNuevoKey=useMemo(()=>findColumnKey(searchableKeys,"Codigo Nuevo",["Codigo Interno","CODIGO N° INTERNO","Interno"]),[searchableKeys]);
  const descripcionEquipoKey=useMemo(()=>findColumnKey(searchableKeys,"Descripcion",["Descripción","Equipo","Tipo de Equipo","Tipo Equipo","Marca / Modelo","Modelo"]),[searchableKeys]);
  const horometroMap=useMemo(()=>buildHorometroMapForLista(rop02All,fechaHorometro),[rop02All,fechaHorometro]);

  const dataWithKey=useMemo(()=>data.map(r=>{
    const maquinaKeys=machineLookupVariants(
      drusilaKey?r[drusilaKey]:"",
      codigoNuevoKey?r[codigoNuevoKey]:""
    );
    const maquinaKey=maquinaKeys[0]||cleanMachine(r[drusilaKey]||r[codigoNuevoKey]||"");
    const ropInfo=maquinaKeys.map(k=>horometroMap[k]).find(Boolean)||null;
    const fallbackRaw=horasKey?String(r[horasKey]||"").trim():"";
    const fallbackNum=fallbackRaw?parseFloat(fallbackRaw.replace(/[^0-9.-]/g,"")):NaN;
    // Prioridad del horómetro:
    // 1) ROP02 del día filtrado, si existe.
    // 2) Si ese día no existe, último horómetro final ROP02 de la máquina.
    // 3) Si la máquina no tiene ninguna carga ROP02 histórica, columna HORAS de la Lista Maestra.
    const horometroValue=ropInfo?ropInfo.horometroFinal:(Number.isFinite(fallbackNum)?fallbackNum:null);
    return{
      ...r,
      _maquinaKey:maquinaKey,
      _ropInfo:ropInfo,
      _horometroValue:horometroValue,
      _horometroDisplay:horometroValue!=null?fmtNum(horometroValue):"",
    };
  }),[data,drusilaKey,codigoNuevoKey,horometroMap,horasKey,fechaHorometro]);

  // Equipos activos: tuvieron al menos 1 registro en ROP02 en los últimos 7 días
  // (contados hacia atrás desde hoy, inclusive).
  const activeMachinesSet=useMemo(()=>{
    const hoy=new Date();
    hoy.setHours(0,0,0,0);
    const hace7=new Date(hoy);
    hace7.setDate(hace7.getDate()-7);
    const set=new Set();
    (rop02All||[]).forEach(r=>{
      if(!r.fecha)return;
      const d=new Date(r.fecha);
      d.setHours(0,0,0,0);
      if(d>=hace7&&d<=hoy){
        const keys=machineLookupVariants(r.maquina,"");
        keys.forEach(k=>set.add(k));
        set.add(cleanMachine(r.maquina));
      }
    });
    return set;
  },[rop02All]);

  const q=cleanKey(search);
  const searched=useMemo(()=>{
    let base=dataWithKey;
    if(soloActivos)base=base.filter(r=>activeMachinesSet.has(r._maquinaKey));
    if(!q)return base;
    return base.filter(r=>searchableKeys.some(k=>cleanKey(r[k]).includes(q)));
  },[dataWithKey,searchableKeys,q,soloActivos,activeMachinesSet]);

  const cols=useMemo(()=>LISTA_COLUMNS.map((col,idx)=>{
    if(col.special==="horometro"){
      return{
        key:"_horometroDisplay",label:col.label,filterKey:"_horometroDisplay",
        render:(_v,row)=>{
          if(row._horometroValue==null)return<span style={{color:C.textMuted}}>—</span>;
          if(row._ropInfo){
            const isFallback=row._ropInfo.modo==="fallback_ultimo"||row._ropInfo.modo==="fallback_historico";
            const tip=`${isFallback?"Sin registro el día elegido. Último horómetro final ROP02 disponible":"Registro ROP02"}: ${fmtFecha(row._ropInfo.fecha)}${row._ropInfo.turno?` (${row._ropInfo.turno})`:""}`;
            return<span style={{display:"inline-block",padding:"2px 7px",borderRadius:5,background:(isFallback?C.yellow:C.green)+"33",border:`1px solid ${(isFallback?C.yellow:C.green)}55`,color:"#fff",fontWeight:700}} title={tip}>{fmtNum(row._horometroValue)}</span>;
          }
          return<span style={{display:"inline-block",padding:"2px 7px",borderRadius:5,background:C.red+"33",border:`1px solid ${C.red}55`,color:"#fff",fontWeight:700}} title="Sin registros en ROP02 — valor fijo de la planilla (columna HORAS), no se actualiza">{fmtNum(row._horometroValue)}</span>;
        }
      };
    }
    const realKey=findColumnKey(searchableKeys,col.label,col.aliases);
    const isCodigo=idx===0; // Código Drusila → badge, igual al estilo de la columna MÁQUINA en ROP02
    return{
      key:realKey||`_missing_${idx}`,label:col.label,wrap:col.label.length>=17,
      width:col.width, minWidth:col.minWidth, maxWidth:col.maxWidth,
      align:col.align, compact:col.compact, color:col.color,
      filterKey:realKey||null,
      render:!realKey?()=><span style={{color:C.textMuted}}>—</span>:
        isCodigo?(v)=>v?<Badge color={C.purple}>{v}</Badge>:<span style={{color:C.textMuted}}>—</span>:
        undefined,
    };
  }),[searchableKeys,fechaHorometro]);

  // ── Filtros desplegables facetados, uno por columna ──
  const filterFields=useMemo(()=>{
    const seen=new Set();
    return cols.filter(c=>c.filterKey&&!seen.has(c.filterKey)&&(seen.add(c.filterKey),true))
      .map(c=>({key:c.filterKey,label:c.label,color:c.color}));
  },[cols]);
  const filterKeysOnly=useMemo(()=>filterFields.map(f=>f.key),[filterFields]);
  const{vals:fVals,set:fSet,opts:fOpts,filtered,reset:fReset,hayFiltros}=useSimpleFacetedFilters(searched,filterKeysOnly,`${LISTA_MAESTRA_STORAGE_KEY}_columnFilters`);

  const propiedadKey=useMemo(()=>findColumnKey(searchableKeys,"Propiedad",["PROPIEDAD","Propiedad Equipo","Propiedad del equipo","Propiedad de equipo"]),[searchableKeys]);
  const costoLocalKey=useMemo(()=>findColumnKey(searchableKeys,"Costo Local USD (s/IVA)",["Costo Local en Dolares sin IVA","Costo Local USD sin IVA","Costo Local Dolares","Costo Local USD","Costo Local"]),[searchableKeys]);
  const tarifaAlquilerKey=useMemo(()=>findColumnKey(searchableKeys,"Tarifa Mensual Alquiler",["Tarifa Mensual de Alquiler","Tarifa de Alquiler Mensual","Tarifa Alquiler","Alquiler Mensual"]),[searchableKeys]);

  const equiposSinInfo=useMemo(()=>{
    const listaIndex=buildListaEquipoInfoIndex(data);
    // Solo se controlan equipos con registros desde mayo de 2026 en adelante.
    // Esto evita que equipos históricos anteriores a mayo entren en la correlación
    // Código Drusila / Código Nuevo y ensucien la ventana de pendientes.
    const FECHA_CORTE_EQUIPOS_SIN_INFO="2026-05-01";
    const fechaComparable=(v)=>{
      if(!v)return"";
      const s=String(v).trim();
      if(!s)return"";
      const iso=s.match(/^(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
      if(iso)return`${iso[1]}-${String(iso[2]).padStart(2,"0")}-${String(iso[3]).padStart(2,"0")}`;
      const dmy=s.match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
      if(dmy)return`${dmy[3]}-${String(dmy[2]).padStart(2,"0")}-${String(dmy[1]).padStart(2,"0")}`;
      const d=new Date(s);
      if(!Number.isNaN(d.getTime()))return d.toISOString().slice(0,10);
      return"";
    };
    const esRegistroDesdeMayo=(fecha)=>{
      const f=fechaComparable(fecha);
      return !!f&&f>=FECHA_CORTE_EQUIPOS_SIN_INFO;
    };
    const toNumInfo=(v)=>{
      if(v===null||v===undefined||v==="")return 0;
      const s=String(v).trim();
      if(!s||s==="-"||s==="—")return 0;
      let clean=s.replace(/[^0-9,.-]/g,"");
      const lastComma=clean.lastIndexOf(",");
      const lastDot=clean.lastIndexOf(".");
      if(lastComma>-1&&lastDot>-1){
        clean=lastComma>lastDot?clean.replace(/\./g,"").replace(",","."):clean.replace(/,/g,"");
      }else if(lastComma>-1){
        clean=clean.replace(/\./g,"").replace(",",".");
      }
      const n=Number(clean);
      return Number.isFinite(n)?n:0;
    };
    const esPropDelta=(v)=>{
      const k=cleanKey(v);
      return k.includes("delta")||k.includes("propia")||k.includes("propio");
    };
    const pending=new Map();
    const registroProyectoLugar=(r)=>{
      const v=getValue(r||{},[
        "proyecto","Proyecto","PROYECTO",
        "lugar","Lugar","LUGAR",
        "proyectoLugar","Proyecto/Lugar","PROYECTO/LUGAR",
        "ubicacion","Ubicación","UBICACION",
        "sector","Sector","SECTOR"
      ]);
      const t=String(v||"").trim();
      return t&&t!=="-"&&t!=="—"?t:"—";
    };
    const add=(rawCode,fuente,fecha,tipo,proyectoLugar)=>{
      if(!esRegistroDesdeMayo(fecha))return;
      if(!isValidEquipoCodigoParaCorrelacion(rawCode))return;
      const code=cleanMachine(mainMachineCode(rawCode)||rawCode);
      if(!code)return;
      const fechaISO=fechaComparable(fecha);
      const match=getListaEquipoInfoMatch(listaIndex,rawCode);
      const key=match?`LM_${match._idx}`:`SIN_${machineLookupVariants(rawCode)[0]||code}`;
      const prev=pending.get(key)||{
        codigoDrusila:match?.codigoDrusila||"",
        codigoNuevo:match?.codigoNuevo||"",
        codigoRegistro:code,
        tipoEquipo:tipo||match?.familia||"",
        propiedad:match?(String((propiedadKey?match[propiedadKey]:match.propiedad)||match.propiedad||"").trim()):"",
        fuenteSet:new Set(),
        proyectoSet:new Set(),
        registros:0,
        ultimaFecha:"",
        motivos:[],
        _match:match,
      };
      prev.fuenteSet.add(fuente);
      if(proyectoLugar&&proyectoLugar!=="—")prev.proyectoSet.add(proyectoLugar);
      prev.registros+=1;
      if(fechaISO&&(!prev.ultimaFecha||fechaISO>prev.ultimaFecha))prev.ultimaFecha=fechaISO;
      if(!prev.tipoEquipo&&tipo)prev.tipoEquipo=tipo;
      pending.set(key,prev);
    };
    (rop02All||[]).forEach(r=>add(r.maquina,"ROP02",r.fecha,r.equipo||r._tipo,registroProyectoLugar(r)));
    (rop05||[]).forEach(r=>add(r.maquina,"ROP05",r.fecha,r.tipo_maquina||r._tipo,registroProyectoLugar(r)));
    (rma15||[]).forEach(r=>add(r.maquina,"RMA15",r.fecha,r.tipoEquipo,registroProyectoLugar(r)));

    const out=[];
    pending.forEach(item=>{
      const motivos=[];
      const match=item._match;
      if(!match){
        motivos.push("No está en Lista Maestra");
      }else{
        const propRaw=String((propiedadKey?match[propiedadKey]:match.propiedad)||match.propiedad||"").trim();
        const propValid=validPropiedadValue(propRaw);
        if(!propValid)motivos.push("Sin propiedad");
        else if(esPropDelta(propRaw)){
          const costo=toNumInfo(costoLocalKey?match[costoLocalKey]:"");
          if(!(costo>0))motivos.push("Sin costo local USD");
        }else{
          const tarifa=toNumInfo(tarifaAlquilerKey?match[tarifaAlquilerKey]:"");
          if(!(tarifa>0))motivos.push("Sin tarifa mensual de alquiler");
        }
      }
      if(!motivos.length)return;
      out.push({
        codigoRegistro:item.codigoRegistro,
        codigoDrusila:item.codigoDrusila||"—",
        codigoNuevo:item.codigoNuevo||"—",
        tipoEquipo:item.tipoEquipo||"—",
        propiedad:item.propiedad||"—",
        fuentes:Array.from(item.fuenteSet).sort().join(" / "),
        proyectoLugar:Array.from(item.proyectoSet||[]).sort().join(" / ")||"—",
        registros:item.registros,
        ultimaFecha:item.ultimaFecha,
        motivo:motivos.join(" + "),
      });
    });
    return out.sort((a,b)=>String(a.motivo).localeCompare(String(b.motivo))||String(a.codigoRegistro).localeCompare(String(b.codigoRegistro)));
  },[data,rop02All,rop05,rma15,propiedadKey,costoLocalKey,tarifaAlquilerKey]);

  const equiposSinInfoCols=useMemo(()=>[
    {key:"codigoRegistro",label:"Código en planillas",render:v=><Badge color={C.purple}>{v}</Badge>},
    {key:"codigoDrusila",label:"Código Drusila"},
    {key:"codigoNuevo",label:"Código Nuevo"},
    {key:"tipoEquipo",label:"Tipo / equipo"},
    {key:"propiedad",label:"Propiedad"},
    {key:"fuentes",label:"Planillas"},
    {key:"proyectoLugar",label:"Proyecto / lugar",wrap:true},
    {key:"registros",label:"Registros",align:"right",render:v=><b>{fmtNum(v)}</b>},
    {key:"ultimaFecha",label:"Última fecha",render:v=>v?fmtFecha(v):"—"},
    {key:"motivo",label:"Información faltante",wrap:true,render:v=><span style={{color:C.red,fontWeight:800}}>{v}</span>},
  ],[]);

  const descargarEquiposSinInfo=useCallback(()=>{
    const wb=XLSX.utils.book_new();
    const headers=["Código en planillas","Código Drusila","Código Nuevo","Tipo / equipo","Propiedad","Planillas","Proyecto / lugar","Registros","Última fecha","Información faltante"];
    const body=equiposSinInfo.map(r=>[r.codigoRegistro,r.codigoDrusila,r.codigoNuevo,r.tipoEquipo,r.propiedad,r.fuentes,r.proyectoLugar,r.registros,r.ultimaFecha?fmtFecha(r.ultimaFecha):"",r.motivo]);
    const ws=XLSX.utils.aoa_to_sheet([headers,...body]);
    ws["!cols"]=[{wch:18},{wch:18},{wch:18},{wch:24},{wch:18},{wch:18},{wch:22},{wch:10},{wch:14},{wch:34}];
    XLSX.utils.book_append_sheet(wb,ws,"Equipos sin info");
    XLSX.writeFile(wb,`Equipos_sin_informacion_${new Date().toISOString().slice(0,10).replace(/-/g,"")}.xlsx`);
  },[equiposSinInfo]);

  const formFields=useMemo(()=>LISTA_COLUMNS.map(col=>{
    const realKey=col.special==="horometro"
      ? (horasKey||"HORAS")
      : (findColumnKey(searchableKeys,col.label,col.aliases)||col.label);
    return{...col,key:realKey,inputType:isYearOnlyListaField(col.label)?"year":"text"};
  }),[searchableKeys,horasKey]);

  const equipoEditOptions=useMemo(()=>dataWithKey.map((r,idx)=>{
    const codDrusila=drusilaKey?String(r[drusilaKey]||"").trim():"";
    const codNuevo=codigoNuevoKey?String(r[codigoNuevoKey]||"").trim():"";
    const desc=descripcionEquipoKey?String(r[descripcionEquipoKey]||"").trim():"";
    const title=[codDrusila,codNuevo].filter(Boolean).join(" / ") || `Fila ${idx+1}`;
    return{value:String(idx),label:desc?`${title} — ${desc}`:title};
  }),[dataWithKey,drusilaKey,codigoNuevoKey,descripcionEquipoKey]);

  const setNewEquipoValue=useCallback((key,value)=>{
    setNewEquipo(prev=>({...prev,[key]:value}));
  },[]);

  const setEditEquipoValue=useCallback((key,value)=>{
    setEditEquipo(prev=>({...prev,[key]:value}));
  },[]);

  const seleccionarEquipoEditar=useCallback((value)=>{
    setEditSelected(value);
    setEditMsg(null);
    const row=dataWithKey[Number(value)];
    if(!row){setEditEquipo({});return;}
    const next={};
    formFields.forEach(f=>{
      const raw=row[f.key]===undefined||row[f.key]===null?"":String(row[f.key]);
      next[f.key]=f.inputType==="year"?normalizeYearValue(raw):raw;
    });
    setEditEquipo(next);
  },[dataWithKey,formFields]);

  const limpiarNuevoEquipo=useCallback(()=>{
    setNewEquipo({});
    setAddMsg(null);
  },[]);

  const limpiarEdicionEquipo=useCallback(()=>{
    setEditSelected("");
    setEditEquipo({});
    setEditMsg(null);
  },[]);

  const guardarEdicionEquipo=useCallback(async()=>{
    const originalRow=dataWithKey[Number(editSelected)];
    if(!originalRow){
      setEditMsg({type:"error",text:"Seleccioná primero un equipo para modificar."});
      return;
    }
    const codigoDrusila=drusilaKey?String(originalRow[drusilaKey]||"").trim():"";
    const codigoNuevo=codigoNuevoKey?String(originalRow[codigoNuevoKey]||"").trim():"";
    // La edición se identifica SIEMPRE por Código Drusila/Código Nuevo, no por índice visual.
    // El índice cambia si la tabla se filtra/ordena y puede pisar otra fila.
    if(!codigoDrusila&&!codigoNuevo){
      setEditMsg({type:"error",text:"El equipo no tiene Código Drusila ni Código Nuevo. No se puede guardar."});
      return;
    }
    setSavingEdit(true);
    setEditMsg({type:"info",text:"Actualizando equipo en Google Sheets..."});
    try{
      const cleanRow={};
      formFields.forEach(f=>{
        const v=editEquipo[f.key];
        cleanRow[f.key]=v===undefined||v===null?"":String(v).trim();
      });
      const originalLookupKeys=machineLookupVariants(codigoDrusila,codigoNuevo);
      const res=await postUpdateListaEquipo({
        codigoDrusila,
        codigoNuevo,
        codigoPrincipal:mainMachineCode(codigoDrusila||codigoNuevo),
        codigoDrusilaNorm:normalizeMachineCode(codigoDrusila),
        codigoNuevoNorm:normalizeMachineCode(codigoNuevo),
        lookupKeys:originalLookupKeys,
        codigoDrusilaHeader:drusilaKey||"",
        codigoNuevoHeader:codigoNuevoKey||"",
        // No se envía rowNumber: el Apps Script debe buscar la fila por Código Drusila.
        useRowNumber:false,
      },cleanRow);
      setEditMsg({type:"success",text:`Equipo actualizado en la fila ${res.rowNumber||"encontrada por Código Drusila"}.`});
      if(onReloadLista)await onReloadLista();
    }catch(err){
      setEditMsg({type:"error",text:err.message});
    }finally{
      setSavingEdit(false);
    }
  },[dataWithKey,editSelected,drusilaKey,codigoNuevoKey,formFields,editEquipo,onReloadLista]);

  const guardarNuevoEquipo=useCallback(async()=>{
    const codigoDrusilaField=formFields.find(f=>cleanKey(f.label).includes("codigo drusila"));
    const codigoNuevoField=formFields.find(f=>cleanKey(f.label).includes("codigo nuevo"));
    const codigoDrusila=String(newEquipo[codigoDrusilaField?.key]||"").trim();
    const codigoNuevo=String(newEquipo[codigoNuevoField?.key]||"").trim();
    if(!codigoDrusila&&!codigoNuevo){
      setAddMsg({type:"error",text:"Completá al menos Código Drusila o Código Nuevo."});
      return;
    }
    setSavingEquipo(true);
    setAddMsg({type:"info",text:"Guardando equipo en Google Sheets..."});
    try{
      const cleanRow={};
      formFields.forEach(f=>{
        const v=newEquipo[f.key];
        if(v!==undefined&&String(v).trim()!=="")cleanRow[f.key]=String(v).trim();
      });
      const res=await postAddListaEquipo(cleanRow);
      setAddMsg({type:"success",text:`Equipo guardado en la fila ${res.rowNumber||"nueva"}.`});
      setNewEquipo({});
      if(onReloadLista)await onReloadLista();
    }catch(err){
      setAddMsg({type:"error",text:err.message});
    }finally{
      setSavingEquipo(false);
    }
  },[formFields,newEquipo,onReloadLista]);

  const buildListaExcelUpdates=useCallback(()=>{
    const updates=[];
    const horasField=horasKey||formFields.find(f=>f.special==="horometro")?.key||"HORAS";
    const toNum=(v)=>{
      if(v===null||v===undefined||v==="")return NaN;
      const n=Number(String(v).replace(/\./g,"").replace(",",".").replace(/[^0-9.\-]/g,""));
      return Number.isFinite(n)?n:NaN;
    };
    dataWithKey.forEach(row=>{
      if(!row||!row._ropInfo||row._horometroValue==null)return;
      const codigoDrusila=drusilaKey?String(row[drusilaKey]||"").trim():"";
      const codigoNuevo=codigoNuevoKey?String(row[codigoNuevoKey]||"").trim():"";
      if(!codigoDrusila&&!codigoNuevo)return;
      const appNum=toNum(row._horometroValue);
      const excelNum=toNum(row[horasField]);
      if(!Number.isFinite(appNum))return;
      if(Number.isFinite(excelNum)&&Math.abs(appNum-excelNum)<0.0001)return;
      updates.push({
        originalKeys:{
          codigoDrusila,
          codigoNuevo,
          codigoPrincipal:mainMachineCode(codigoDrusila||codigoNuevo),
          codigoDrusilaNorm:normalizeMachineCode(codigoDrusila),
          codigoNuevoNorm:normalizeMachineCode(codigoNuevo),
          lookupKeys:machineLookupVariants(codigoDrusila,codigoNuevo),
          codigoDrusilaHeader:drusilaKey||"",
          codigoNuevoHeader:codigoNuevoKey||"",
          useRowNumber:false,
        },
        row:{[horasField]:String(Math.round(appNum*100)/100)}
      });
    });
    return updates;
  },[dataWithKey,drusilaKey,codigoNuevoKey,horasKey,formFields]);

  const actualizarListaEnExcel=useCallback(async()=>{
    const updates=buildListaExcelUpdates();
    if(!updates.length){
      setSyncMsg({type:"success",text:"No hay diferencias para actualizar. Los horómetros ya coinciden con la app."});
      return;
    }
    const ok=await appConfirm(`Se actualizarán ${updates.length} horómetros en la planilla base Lista Maestra de Equipos. ¿Continuar?`);
    if(!ok)return;
    setSyncingListaExcel(true);
    setSyncMsg({type:"info",text:`Actualizando ${updates.length} equipos en Google Sheets...`});
    try{
      const res=await postBulkUpdateListaEquipos(updates);
      const updated=res.updatedRows??res.updated??updates.length;
      const skipped=res.skippedRows??0;
      const failed=res.failedRows??0;
      setSyncMsg({type:failed?"error":"success",text:failed?`Se actualizaron ${updated}, fallaron ${failed} y se omitieron ${skipped}. Revisá permisos o códigos no encontrados.`:`${updated} equipos actualizados en Excel${skipped?` (${skipped} omitidos)`:""}.`});
      if(onReloadLista)await onReloadLista();
    }catch(err){
      setSyncMsg({type:"error",text:err.message||"No se pudo actualizar la Lista Maestra."});
    }finally{
      setSyncingListaExcel(false);
    }
  },[buildListaExcelUpdates,onReloadLista]);

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
        <StatCard icon="equip" label="Equipos en lista" value={fmtNum(data.length)} sub="Registros cargados desde Google Sheets" color={C.teal} small/>
        <StatCard icon="filter" label="Resultado filtrado" value={fmtNum(filtered.length)} sub={search||hayFiltros||soloActivos?"Según búsqueda / filtros":"Sin filtros aplicados"} color={C.blue} small/>
        <StatCard icon="check" label="Activos (últimos 7 días)" value={fmtNum(dataWithKey.filter(r=>activeMachinesSet.has(r._maquinaKey)).length)} sub="Con registro en ROP02 últimos 7 días" color={C.green} small/>
        <StatCard icon="hours" label="Con horómetro ROP02" value={fmtNum(filtered.filter(r=>r._ropInfo).length)} sub={fechaHorometro?`Del día o último disponible`:"Último disponible"} color={C.accent} small/>
        <StatCard icon="warn" label={fechaHorometro?"Usan último ROP02":"Valor fijo (HORAS)"} value={fmtNum(fechaHorometro?filtered.filter(r=>r._ropInfo?.modo==="fallback_ultimo"||r._ropInfo?.modo==="fallback_historico").length:filtered.filter(r=>!r._ropInfo&&r._horometroValue!=null).length)} sub={fechaHorometro?"No tenían ROP02 ese día":"Sin registros en ROP02"} color={C.red} small/>
      </div>
      <div style={{display:"flex",gap:14,flexWrap:"wrap",fontSize:11,color:C.textSub,background:C.card,border:`1px solid ${C.border}`,borderRadius:8,padding:"8px 14px",alignItems:"center"}}>
        <span><Badge color={C.green}>●</Badge> {fechaHorometro?`Horómetro ROP02 del ${fmtFecha(fechaHorometro)}`:"Último horómetro ROP02"}</span>
        {fechaHorometro&&<span><Badge color={C.yellow}>●</Badge> Sin registro ese día: muestra el último horómetro final disponible</span>}
        <span><Badge color={C.red}>●</Badge> Sin ROP02 histórico: horómetro fijo de planilla</span>
        {soloActivos&&<span style={{color:C.green,fontWeight:700}}><Badge color={C.green}>✔</Badge> Filtro activo: mostrando solo equipos con registro ROP02 en los últimos 7 días</span>}
      </div>
      <Card title="Lista Maestra de Equipos" action={
        <div style={{display:"flex",flexDirection:"column",gap:8,alignItems:"stretch",width:"min(100%,1380px)",maxWidth:"100%"}}>
          <div style={{display:"flex",gap:8,alignItems:"center",justifyContent:"flex-end",flexWrap:"wrap",maxWidth:"100%"}}>
            <button onClick={()=>setListaTab("maestra")} style={{background:listaTab==="maestra"?C.accentDim:C.surface,border:`1px solid ${listaTab==="maestra"?C.accent+"55":C.border}`,borderRadius:7,color:listaTab==="maestra"?C.accent:C.textSub,padding:"7px 11px",fontSize:12,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
              Lista maestra
            </button>
            <button onClick={()=>setListaTab("sinInfo")} style={{background:listaTab==="sinInfo"?C.redDim:C.surface,border:`1px solid ${listaTab==="sinInfo"?C.red+"55":C.border}`,borderRadius:7,color:listaTab==="sinInfo"?C.red:C.textSub,padding:"7px 11px",fontSize:12,fontWeight:800,cursor:"pointer",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
              Equipos sin información {equiposSinInfo.length?`(${equiposSinInfo.length})`:""}
            </button>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar equipo, tipo, marca, proyecto..." style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,color:C.text,padding:"8px 10px",fontSize:12,minWidth:230,width:320,outline:"none",flex:"1 1 260px",maxWidth:420}}/>
            <button onClick={()=>setFiltersOpen(o=>!o)} style={{background:filtersOpen?C.accentDim:C.surface,border:`1px solid ${filtersOpen?C.accent+"55":C.border}`,borderRadius:7,color:filtersOpen?C.accent:C.textSub,padding:"7px 11px",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
              <Icon name="filter" size={13} color={filtersOpen?C.accent:C.textSub}/>Filtros{hayFiltros?` (${filterKeysOnly.filter(k=>!multiIsAll(fVals[k])).length})`:""}
            </button>
            {hayFiltros&&<button onClick={fReset} style={{background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:7,color:C.red,padding:"7px 11px",fontSize:12,fontWeight:600,cursor:"pointer",flexShrink:0}}>Limpiar filtros</button>}
          </div>
          <div style={{display:"flex",gap:8,alignItems:"center",justifyContent:"flex-end",flexWrap:"wrap",maxWidth:"100%"}}>
            <div style={{display:"flex",alignItems:"center",gap:6,background:C.surface,border:`1px solid ${fechaHorometro?C.accent+"55":C.border}`,borderRadius:8,padding:"5px 8px",flexShrink:0}}> 
              <span style={{fontSize:10,color:C.textMuted,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>Horómetro día</span>
              <input type="date" value={fechaHorometro} onChange={e=>setFechaHorometro(e.target.value)} style={{background:"transparent",border:"none",color:C.text,fontSize:12,outline:"none",fontFamily:"Inter"}}/>
              {fechaHorometro&&<button onClick={()=>setFechaHorometro("")} title="Sin día: mostrar último horómetro" style={{background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:6,color:C.red,padding:"3px 7px",fontSize:11,fontWeight:700,cursor:"pointer"}}>×</button>}
            </div>
            <button onClick={()=>setSoloActivos(v=>!v)} title="Equipos con al menos 1 registro en ROP02 en los últimos 7 días" style={{background:soloActivos?C.greenDim:C.surface,border:`1px solid ${soloActivos?C.green+"66":C.border}`,borderRadius:7,color:soloActivos?C.green:C.textSub,padding:"7px 11px",fontSize:12,fontWeight:soloActivos?800:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6,transition:"all .15s",flexShrink:0}}>
              <span style={{fontSize:13}}>{soloActivos?"✔":"○"}</span> Activos (7 días)
            </button>
            <button onClick={()=>{setAddOpen(o=>!o);setAddMsg(null);if(editOpen)setEditOpen(false);}} style={{background:addOpen?C.accentDim:C.tealDim,border:`1px solid ${addOpen?C.accent+"55":C.teal+"44"}`,borderRadius:7,color:addOpen?C.accent:C.teal,padding:"7px 11px",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
              + Cargar nuevo equipo
            </button>
            <button onClick={()=>{setEditOpen(o=>!o);setEditMsg(null);if(addOpen)setAddOpen(false);}} style={{background:editOpen?C.accentDim:C.yellowDim,border:`1px solid ${editOpen?C.accent+"55":C.yellow+"44"}`,borderRadius:7,color:editOpen?C.accent:C.yellow,padding:"7px 11px",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
              ✎ Modificar equipos
            </button>
            <button onClick={actualizarListaEnExcel} disabled={syncingListaExcel} title="Actualiza en Excel los horómetros que la app toma desde ROP02 y que estén distintos a la Lista Maestra" style={{background:C.blueDim,border:`1px solid ${C.blue}55`,borderRadius:7,color:C.blue,padding:"7px 11px",fontSize:12,fontWeight:800,cursor:syncingListaExcel?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:6,flexShrink:0,opacity:syncingListaExcel?0.65:1}}>
              {syncingListaExcel?<Spinner size={13}/>:<Icon name="refresh" size={13} color={C.blue}/>} Actualizar en Excel
            </button>
            <button onClick={()=>generarExcelListaMaestra(filtered,cols,new Date().toISOString().slice(0,10).replace(/-/g,""))} style={{background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:7,color:C.green,padding:"7px 11px",fontSize:12,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
              ⬇ Generar reporte
            </button>
          </div>
        </div>
      }>
        {syncMsg&&(
          <div style={{margin:"0 0 14px",padding:"10px 13px",borderRadius:8,fontSize:12,fontWeight:600,
            color:syncMsg.type==="error"?C.red:syncMsg.type==="success"?C.green:C.blue,
            background:syncMsg.type==="error"?C.redDim:syncMsg.type==="success"?C.greenDim:C.blueDim,
            border:`1px solid ${syncMsg.type==="error"?C.red:syncMsg.type==="success"?C.green:C.blue}55`}}>
            {syncMsg.text}
          </div>
        )}
        {editOpen&&(
          <div style={{margin:"0 0 14px",padding:"18px 18px 14px",background:C.surface,border:`1px solid ${C.yellow}44`,borderRadius:10,boxShadow:"0 2px 12px rgba(0,0,0,.2)"}}>
            {/* ── Header ── */}
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,marginBottom:14}}>
              <div>
                <div style={{fontSize:14,fontWeight:800,color:C.text,letterSpacing:".01em"}}>Modificar equipos</div>
                <div style={{fontSize:11,color:C.textMuted,marginTop:3,lineHeight:1.5}}>Seleccioná un equipo, editá cualquier celda y guardá. La modificación se actualiza en la planilla base Lista Maestra de Equipos.</div>
              </div>
              <button onClick={()=>{setEditOpen(false);limpiarEdicionEquipo();}} disabled={savingEdit}
                style={{background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:7,color:C.red,padding:"6px 13px",fontSize:12,fontWeight:700,cursor:savingEdit?"not-allowed":"pointer",whiteSpace:"nowrap",flexShrink:0}}>
                Cerrar
              </button>
            </div>
            {/* ── Mensaje de estado ── */}
            {editMsg&&(
              <div style={{marginBottom:13,padding:"10px 13px",borderRadius:8,fontSize:12,fontWeight:500,
                color:editMsg.type==="error"?C.red:editMsg.type==="success"?C.green:C.blue,
                background:editMsg.type==="error"?C.redDim:editMsg.type==="success"?C.greenDim:C.blueDim,
                border:`1px solid ${editMsg.type==="error"?C.red:editMsg.type==="success"?C.green:C.blue}55`}}>
                {editMsg.text}
              </div>
            )}
            {/* ── Selector de equipo ── */}
            <div style={{display:"grid",gridTemplateColumns:"minmax(240px,400px) 1fr",gap:12,alignItems:"end",marginBottom:14}}>
              <div style={{display:"flex",flexDirection:"column",gap:4}}>
                <label style={{fontSize:10,color:C.textMuted,fontWeight:700,textTransform:"uppercase",letterSpacing:".07em"}}>Equipo a modificar</label>
                <select value={editSelected} onChange={e=>seleccionarEquipoEditar(e.target.value)}
                  style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:7,color:C.text,padding:"8px 10px",fontSize:12,outline:"none",cursor:"pointer"}}>
                  <option value="">Seleccionar equipo...</option>
                  {equipoEditOptions.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div style={{fontSize:11,color:C.textMuted,lineHeight:1.5}}>
                Identificación usada para guardar: <b style={{color:C.text}}>Código Drusila</b> principal y variantes normalizadas. Podés modificar el resto de las columnas y también esos códigos, siempre que no queden duplicados.
              </div>
            </div>
            {/* ── Campos ── */}
            {editSelected!==""&&(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",gap:10,marginBottom:2}}>
                {formFields.map(f=>(
                  <div key={"edit_"+f.key+f.label} style={{display:"flex",flexDirection:"column",gap:4}}>
                    <label style={{fontSize:10,color:C.textMuted,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>
                      {f.label}{f.special==="horometro"&&<span style={{color:C.yellow,fontWeight:800}}> → HORAS</span>}
                    </label>
                    <ListaEquipoFieldInput field={f} value={editEquipo[f.key]||""} onChange={v=>setEditEquipoValue(f.key,v)}/>
                  </div>
                ))}
              </div>
            )}
            {/* ── Acciones ── */}
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:16,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
              <button onClick={limpiarEdicionEquipo} disabled={savingEdit}
                style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,color:C.textSub,padding:"8px 14px",fontSize:12,fontWeight:700,cursor:savingEdit?"not-allowed":"pointer"}}>
                Limpiar
              </button>
              <button onClick={guardarEdicionEquipo} disabled={savingEdit||editSelected===""}
                style={{background:C.yellowDim,border:`1px solid ${C.yellow}66`,borderRadius:7,color:C.yellow,padding:"8px 16px",fontSize:12,fontWeight:800,
                  cursor:(savingEdit||editSelected==="")?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:7,
                  opacity:(savingEdit||editSelected==="")?0.55:1,transition:"opacity .15s"}}>
                {savingEdit?<Spinner size={13}/>:<Icon name="check" size={13} color={C.yellow}/>}
                {savingEdit?"Guardando...":"Guardar cambios"}
              </button>
            </div>
          </div>
        )}
        {addOpen&&(
          <div style={{margin:"0 0 14px",padding:14,background:C.surface,border:`1px solid ${C.teal}33`,borderRadius:10}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginBottom:12}}>
              <div>
                <div style={{fontSize:13,fontWeight:800,color:C.text}}>Nuevo equipo</div>
                <div style={{fontSize:11,color:C.textMuted,marginTop:2}}>Completá las celdas y guardá. El registro se agrega en la planilla base Lista Maestra de Equipos.</div>
              </div>
              <button onClick={()=>{setAddOpen(false);limpiarNuevoEquipo();}} disabled={savingEquipo} style={{background:C.redDim,border:`1px solid ${C.red}44`,borderRadius:7,color:C.red,padding:"6px 10px",fontSize:12,fontWeight:700,cursor:savingEquipo?"not-allowed":"pointer"}}>Cerrar</button>
            </div>
            {addMsg&&<div style={{marginBottom:12,padding:"9px 11px",borderRadius:8,fontSize:12,color:addMsg.type==="error"?C.red:addMsg.type==="success"?C.green:C.blue,background:(addMsg.type==="error"?C.redDim:addMsg.type==="success"?C.greenDim:C.blueDim),border:`1px solid ${(addMsg.type==="error"?C.red:addMsg.type==="success"?C.green:C.blue)}44`}}>{addMsg.text}</div>}
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10}}>
              {formFields.map(f=>(
                <div key={f.key+f.label} style={{display:"flex",flexDirection:"column",gap:4}}>
                  <label style={{fontSize:10,color:C.textMuted,fontWeight:700,textTransform:"uppercase",letterSpacing:".06em"}}>{f.label}{f.special==="horometro"&&<span style={{color:C.yellow}}> → HORAS</span>}</label>
                  <ListaEquipoFieldInput field={f} value={newEquipo[f.key]||""} onChange={v=>setNewEquipoValue(f.key,v)} placeholder={f.special==="horometro"?"Valor inicial si no hay ROP02":""}/>
                </div>
              ))}
            </div>
            <div style={{display:"flex",justifyContent:"flex-end",gap:8,marginTop:14}}>
              <button onClick={limpiarNuevoEquipo} disabled={savingEquipo} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,color:C.textSub,padding:"8px 12px",fontSize:12,fontWeight:700,cursor:savingEquipo?"not-allowed":"pointer"}}>Limpiar</button>
              <button onClick={guardarNuevoEquipo} disabled={savingEquipo} style={{background:C.tealDim,border:`1px solid ${C.teal}55`,borderRadius:7,color:C.teal,padding:"8px 12px",fontSize:12,fontWeight:800,cursor:savingEquipo?"not-allowed":"pointer",display:"flex",alignItems:"center",gap:7}}>
                {savingEquipo?<Spinner size={13}/>:<Icon name="check" size={13} color={C.teal}/>}
                {savingEquipo?"Guardando...":"Guardar en planilla"}
              </button>
            </div>
          </div>
        )}
        {listaTab==="sinInfo"?(
          <div style={{display:"flex",flexDirection:"column",gap:12}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,background:C.surface,border:`1px solid ${C.red}33`,borderRadius:10,padding:"12px 14px"}}>
              <div>
                <div style={{fontSize:13,fontWeight:900,color:C.text}}>Equipos sin información</div>
                <div style={{fontSize:11,color:C.textMuted,marginTop:3,lineHeight:1.5}}>
                  Se cruzan solamente códigos de equipos que aparecen desde mayo de 2026 en adelante en ROP02, ROP05 y RMA15 contra <b>Código Drusila</b> y <b>Código Nuevo</b> de la Lista Maestra. Se excluyen textos operativos como PREDIO-DELTA, REORGANIZACION, REPARACION, MANTENIMIENTO, BANDEJA-MARTILLO, TALLER y códigos numéricos sueltos. También se muestran equipos que existen en la lista pero tienen datos incompletos.
                </div>
              </div>
              <button onClick={descargarEquiposSinInfo} disabled={!equiposSinInfo.length} style={{background:C.greenDim,border:`1px solid ${C.green}44`,borderRadius:7,color:C.green,padding:"8px 12px",fontSize:12,fontWeight:800,cursor:equiposSinInfo.length?"pointer":"not-allowed",opacity:equiposSinInfo.length?1:.55,flexShrink:0}}>
                ⬇ Descargar Excel
              </button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:10}}>
              <StatCard icon="warn" label="Pendientes" value={fmtNum(equiposSinInfo.length)} sub="Sin lista o datos incompletos" color={C.red} small/>
              <StatCard icon="equip" label="No están en lista" value={fmtNum(equiposSinInfo.filter(r=>String(r.motivo).includes("No está")).length)} sub="Aparecen en planillas" color={C.yellow} small/>
              <StatCard icon="filter" label="Con datos incompletos" value={fmtNum(equiposSinInfo.filter(r=>!String(r.motivo).includes("No está")).length)} sub="Propiedad / costo / tarifa" color={C.blue} small/>
            </div>
            <Table cols={equiposSinInfoCols} rows={equiposSinInfo} maxH={620} emptyMsg="No hay equipos sin información" stickyFirst disableTooltip/>
          </div>
        ):(
          <>
            {filtersOpen&&(
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:10,padding:"4px 0 14px"}}>
                {filterFields.map(f=>(
                  <MultiSel key={f.key} label={f.label} value={fVals[f.key]} onChange={v=>fSet(f.key,v)}
                    options={[{value:"todos",label:"Todos"},...(fOpts[f.key]||[]).map(v=>({value:v,label:v}))]}/>
                ))}
              </div>
            )}
            <Table cols={cols} rows={filtered} maxH={620} emptyMsg="Sin equipos para mostrar" stickyFirst disableTooltip/>
          </>
        )}
      </Card>
    </div>
  );
}

// ─── ViewDashboard ────────────────────────────────────────────────────────────
// ─── Dashboard ROP05 ──────────────────────────────────────────────────────────
function DashboardROP05({rop05,dashSt,setDashSt}){
  const modeD=dashSt?.modeD05??"todo";
  const fechaD=dashSt?.fechaD05??"";
  const fechaDD=dashSt?.fechaDD05??"";
  const fechaDH=dashSt?.fechaDH05??"";
  const proyecto=dashSt?.proyecto05??"todos";
  const setModeD=v=>setDashSt(s=>({...s,modeD05:v}));
  const setFechaD=v=>setDashSt(s=>({...s,fechaD05:v}));
  const setFechaDD=v=>setDashSt(s=>({...s,fechaDD05:v}));
  const setFechaDH=v=>setDashSt(s=>({...s,fechaDH05:v}));
  const setProyecto=v=>setDashSt(s=>({...s,proyecto05:v}));

  const proyectos=useMemo(()=>uniq(rop05.map(r=>r.proyecto).filter(Boolean)),[rop05]);

  const filtered=useMemo(()=>rop05.filter(r=>{
    if(!matchMulti(r.proyecto,proyecto,"todos"))return false;
    if(modeD==="dia"&&fechaD&&r.fecha!==fechaD)return false;
    if(modeD==="periodo"){if(fechaDD&&r.fecha<fechaDD)return false;if(fechaDH&&r.fecha>fechaDH)return false;}
    return true;
  }),[rop05,proyecto,modeD,fechaD,fechaDD,fechaDH]);

  const totalHoras=useMemo(()=>filtered.reduce((s,r)=>s+r.horas,0),[filtered]);
  const totalEquipos=useMemo(()=>uniq(filtered.map(r=>r.maquina)).length,[filtered]);
  const diasOp=useMemo(()=>uniq(filtered.map(r=>r.fecha)).length,[filtered]);

  const topTareas=useMemo(()=>{
    const m={};
    filtered.filter(r=>r.tarea).forEach(r=>{m[r.tarea]=(m[r.tarea]||0)+1;});
    const total=Object.values(m).reduce((s,v)=>s+v,0);
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).slice(0,10)
      .map(([name,count])=>({name:name.length>36?name.slice(0,34)+"…":name,count,pct:total>0?Math.round(count/total*100):0}));
  },[filtered]);

  const topEquipos=useMemo(()=>{
    const m={};
    filtered.forEach(r=>{if(!m[r.maquina])m[r.maquina]={horas:0,tipo:r._tipo};m[r.maquina].horas+=r.horas;});
    return Object.entries(m).sort((a,b)=>b[1].horas-a[1].horas).slice(0,10).map(([name,d])=>({name,horas:Math.round(d.horas*10)/10,tipo:d.tipo}));
  },[filtered]);

  const totalTareas=useMemo(()=>{const m={};filtered.forEach(r=>{if(r.tarea)m[r.tarea]=1;});return Object.keys(m).length;},[filtered]);

  const prodPorUnidad=useMemo(()=>{
    const m={};
    filtered.forEach(r=>{if(r.unidad){m[r.unidad]=(m[r.unidad]||0)+r.cantidad;}});
    return Object.entries(m).sort((a,b)=>b[1]-a[1]).map(([name,value])=>({name,value:Math.round(value)}));
  },[filtered]);

  const prodPorProy=useMemo(()=>{
    const m={};
    filtered.forEach(r=>{const p=r.proyecto||"S/D";m[p]=(m[p]||0)+r.horas;});
    return Object.entries(m).map(([name,value])=>({name,value}));
  },[filtered]);

  const hayFiltros=modeD!=="todo"||!multiIsAll(proyecto,"todos");
  const reset=()=>{setModeD("todo");setFechaD("");setFechaDD("");setFechaDH("");setProyecto("todos");};

  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <Card>
        <div style={{padding:"10px 14px",display:"flex",alignItems:"center",gap:14,flexWrap:"wrap"}}>
          <Icon name="filter" size={14} color={C.textSub}/>
          <div style={{display:"flex",gap:7}}>
            <TabBtn active={modeD==="todo"} onClick={()=>setModeD("todo")}>Todo</TabBtn>
            <TabBtn active={modeD==="dia"} onClick={()=>setModeD("dia")}>Por día</TabBtn>
            <TabBtn active={modeD==="periodo"} onClick={()=>setModeD("periodo")}>Por período</TabBtn>
          </div>
          {modeD==="dia"&&<DateIn label="Fecha" value={fechaD} onChange={setFechaD}/>}
          {modeD==="periodo"&&<><PeriodMonthYear fechaD={fechaDD} fechaH={fechaDH} setFechaD={setFechaDD} setFechaH={setFechaDH}/><DateIn label="Desde" value={fechaDD} onChange={setFechaDD} max={fechaDH||undefined}/><DateIn label="Hasta" value={fechaDH} onChange={setFechaDH} min={fechaDD||undefined} warn={fechaDH&&fechaDD&&fechaDH<fechaDD?"≥ Desde":null}/></>}
          <MultiSel label="Proyecto" value={proyecto} onChange={setProyecto} options={[{value:"todos",label:"Todos"},...proyectos.map(p=>({value:p,label:p}))]}/>
          <button onClick={reset} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.red}44`,background:C.redDim,color:C.red,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"Inter",opacity:hayFiltros?1:0.3,pointerEvents:hayFiltros?"auto":"none"}}><Icon name="close" size={11} color={C.red}/>Limpiar</button>
        </div>
      </Card>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(145px,1fr))",gap:12}}>
        <StatCard icon="prod" label="Registros" value={filtered.length} color={C.teal}/>
        <StatCard icon="hours" label="Horas Productivas" value={fmtNum(totalHoras)} color={C.yellow}/>
        <StatCard icon="equip" label="Equipos" value={totalEquipos} color={C.purple}/>
        <StatCard icon="consist" label="Días con Registro" value={diasOp} color={C.blue}/>
        <StatCard icon="prod" label="Tareas distintas" value={totalTareas} color={C.green}/>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
        <Card title="Top 10 Equipos — Horas productivas">
          <div style={{padding:"12px 6px"}}>
            <ResponsiveContainer width="100%" height={Math.max(200,topEquipos.length*34+40)}>
              <BarChart data={topEquipos} layout="vertical" margin={{left:8,right:16}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
                <XAxis type="number" tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="name" tick={{fill:C.textSub,fontSize:10}} width={84} axisLine={false} tickLine={false}/>
                <Tooltip content={<ChartTip/>}/>
                <Bar dataKey="horas" fill={C.teal} radius={[0,4,4,0]} barSize={20}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <div style={{display:"flex",flexDirection:"column",gap:14}}>
          <Card title="Top 10 Tareas más realizadas">
            <div style={{padding:"8px 12px 12px",display:"flex",flexDirection:"column",gap:7}}>
              {topTareas.map((t,i)=>(
                <div key={i} style={{display:"flex",flexDirection:"column",gap:3}}>
                  <div style={{display:"flex",alignItems:"center",gap:7}}>
                    <span style={{fontSize:11,fontWeight:800,color:C.teal,width:16,textAlign:"right",flexShrink:0,fontFamily:"Inter"}}>{i+1}</span>
                    <span style={{fontSize:11,color:C.text,flex:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.name}</span>
                    <span style={{fontSize:11,fontWeight:700,color:C.teal,flexShrink:0,minWidth:36,textAlign:"right"}}>{t.pct}%</span>
                  </div>
                  <div style={{marginLeft:23,background:C.border,borderRadius:3,height:4,overflow:"hidden"}}>
                    <div style={{width:`${t.pct}%`,height:"100%",background:C.teal,borderRadius:3,transition:"width .4s ease"}}/>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card title="Producción por unidad">
            <div style={{padding:"10px 14px 12px",display:"flex",flexDirection:"column",gap:8}}>
              {prodPorUnidad.slice(0,5).map((u,i)=>{
                const max=prodPorUnidad[0]?.value||1;
                return(
                  <div key={i} style={{display:"flex",alignItems:"center",gap:8}}>
                    <span style={{fontSize:10,fontWeight:600,color:C.textSub,width:80,flexShrink:0}}>{u.name}</span>
                    <div style={{flex:1,background:C.border,borderRadius:3,height:6,overflow:"hidden"}}>
                      <div style={{width:`${(u.value/max)*100}%`,height:"100%",background:C.teal,borderRadius:3}}/>
                    </div>
                    <span style={{fontSize:11,fontWeight:700,color:C.teal,flexShrink:0,minWidth:60,textAlign:"right"}}>{fmtNum(u.value)}</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>

      <Card title="Producción por proyecto">
        <div style={{padding:"10px 14px 12px",display:"flex",alignItems:"center",gap:16}}>
          <ResponsiveContainer width={120} height={120}>
            <PieChart>
              <Pie data={prodPorProy} cx="50%" cy="50%" outerRadius={52} innerRadius={30} dataKey="value" labelLine={false} label={false}>
                {prodPorProy.map((entry,i)=><Cell key={i} fill={entry.name==="FILO DEL SOL"?"#e8001d":entry.name==="JOSE MARIA"?"#f0f0f0":"#ffaa00"}/>)}
              </Pie>
              <Tooltip content={<ChartTip/>}/>
            </PieChart>
          </ResponsiveContainer>
          <div style={{flex:1,display:"flex",flexDirection:"column",gap:8}}>
            {(()=>{const total=prodPorProy.reduce((s,r)=>s+r.value,0);return prodPorProy.map((entry,i)=>{const col=entry.name==="FILO DEL SOL"?"#e8001d":entry.name==="JOSE MARIA"?"#f0f0f0":"#ffaa00";const pct=total>0?Math.round(entry.value/total*100):0;return(<div key={i} style={{display:"flex",flexDirection:"column",gap:3}}><div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:11,fontWeight:600,color:col}}>{entry.name}</span><span style={{fontSize:14,fontWeight:800,color:col,fontFamily:"Inter"}}>{pct}%</span></div><div style={{background:C.border,borderRadius:3,height:5,overflow:"hidden"}}><div style={{width:pct+"%",height:"100%",background:col,borderRadius:3}}/></div><span style={{fontSize:10,color:C.textMuted}}>{fmtNum(entry.value)} hs</span></div>);})})()}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Dashboard RMA15 ──────────────────────────────────────────────────────────
function DashboardRMA15({rma15,dashSt,setDashSt}){
  const modeD=dashSt?.modeD15??"todo";
  const fechaD=dashSt?.fechaD15??"";
  const fechaDD=dashSt?.fechaDD15??"";
  const fechaDH=dashSt?.fechaDH15??"";
  const proyecto=dashSt?.proyecto15??"todos";
  const setModeD=v=>setDashSt(s=>({...s,modeD15:v}));
  const setFechaD=v=>setDashSt(s=>({...s,fechaD15:v}));
  const setFechaDD=v=>setDashSt(s=>({...s,fechaDD15:v}));
  const setFechaDH=v=>setDashSt(s=>({...s,fechaDH15:v}));
  const setProyecto=v=>setDashSt(s=>({...s,proyecto15:v}));

  const proyectos=useMemo(()=>uniq((rma15||[]).map(r=>r.proyecto).filter(Boolean)),[rma15]);

  const filtered=useMemo(()=>(rma15||[]).filter(r=>{
    if(!matchMulti(r.proyecto,proyecto,"todos"))return false;
    if(modeD==="dia"&&fechaD&&r.fecha!==fechaD)return false;
    if(modeD==="periodo"){if(fechaDD&&r.fecha<fechaDD)return false;if(fechaDH&&r.fecha>fechaDH)return false;}
    return true;
  }),[rma15,proyecto,modeD,fechaD,fechaDD,fechaDH]);

  const totalOTs=filtered.length;
  const preventivos=filtered.filter(r=>r.tipoMant?.toUpperCase().includes("PREV")).length;
  const correctivos=filtered.filter(r=>r.tipoMant?.toUpperCase().includes("CORR")).length;
  const noOperativos=filtered.filter(r=>!r.operativo).length;
  const costoTotal=filtered.reduce((s,r)=>s+r.costoTotal,0);
  const equiposAfect=useMemo(()=>uniq(filtered.map(r=>r.maquina)).length,[filtered]);

  const otsPorTipo=useMemo(()=>[
    {name:"Preventivo",value:preventivos,fill:C.green},
    {name:"Correctivo",value:correctivos,fill:C.red},
  ].filter(x=>x.value>0),[preventivos,correctivos]);

  const topEquipos=useMemo(()=>{
    const m={};
    filtered.forEach(r=>{if(!m[r.maquina])m[r.maquina]={ots:0,costo:0};m[r.maquina].ots++;m[r.maquina].costo+=r.costoTotal;});
    return Object.entries(m).sort((a,b)=>b[1].costo-a[1].costo).slice(0,10).map(([name,d])=>({name,ots:d.ots,costo:Math.round(d.costo)}));
  },[filtered]);

  const topInsumos=useMemo(()=>{
    const m={};
    filtered.forEach(r=>(r.insumos||[]).forEach(ins=>{if(!ins.codigo)return;const k=ins.codigo+" — "+(ins.nombre||"");if(!m[k])m[k]={qty:0,costo:0};m[k].qty+=ins.cantidad;m[k].costo+=ins.costoTotal||0;}));
    return Object.entries(m).sort((a,b…68554 tokens truncated…CAT"], matchTipo:(c,f)=>String(f||"").includes("TRACTOR")||String(c||"").startsWith("CAT")},
          ].map(tipo=>(
            <EquipoCard key={tipo.nombre} {...tipo} rop02Prod={filtered} equiposExtra={vehiculosListaFiltrados} listaInfoIndex={listaInfoIndex}/>
          ))}
        </div>
      </Card>
    </div>
  );
}


// ─── ViewCombustible ──────────────────────────────────────────────────────────
function ViewCombustible({rop02All,extState,setExtState}){
  // Solo máquinas/equipos (excluye camiones y camionetas)
  const rop02Prod=useMemo(()=>rop02All.filter(r=>!r._excluded),[rop02All]);

  const fk=useMemo(()=>[
    {key:"proyecto",defaultVal:"todos"},
    {key:"maquina",defaultVal:"todas"},
    {key:"supervisor",defaultVal:"todos"},
    {key:"operario",defaultVal:"todos"},
  ],[]);
  const{mode,setMode,fecha,setFecha,fechaD,setFechaD,fechaH,setFechaH,filtered:filteredBase,opts,vals,set,reset:resetBase,hayFiltros}=useFacetedFilters(rop02Prod,fk,extState,setExtState);
  const tipoMaquina=extState?.tipoMaquina||"todas";
  const setTipoMaquina=v=>setExtState(st=>({...st,tipoMaquina:v}));
  const filtered=useMemo(()=>multiIsAll(tipoMaquina,"todas")?filteredBase:filteredBase.filter(r=>tipoMatchMachineROP05(tipoMaquina,r.maquina)),[filteredBase,tipoMaquina]);
  const reset=()=>{resetBase();setTipoMaquina("todas");};
  const hayFiltrosComb=hayFiltros||!multiIsAll(tipoMaquina,"todas");

  // Solo registros con consumo de combustible cargado
  const conCombustible=useMemo(()=>filtered.filter(r=>Number(r.combustible)>0),[filtered]);

  const stats=useMemo(()=>{
    const total=filtered.reduce((s,r)=>s+(Number(r.combustible)||0),0);
    const horas=filtered.reduce((s,r)=>s+(Number(r.horas)||0),0);
    const registrosConCarga=conCombustible.length;
    const equiposConCarga=uniq(conCombustible.map(r=>r.maquina)).length;
    const promedioPorCarga=registrosConCarga>0?total/registrosConCarga:0;
    const ratio=horas>0?total/horas:0; // litros por hora trabajada
    return{total,horas,registrosConCarga,equiposConCarga,promedioPorCarga,ratio};
  },[filtered,conCombustible]);

  // Evolución por fecha (modo período)
  const combFecha=useMemo(()=>{
    if(mode!=="periodo")return[];
    const m={};
    filtered.forEach(r=>{m[r.fecha]=(m[r.fecha]||0)+(Number(r.combustible)||0);});
    return Object.entries(m).sort().map(([fecha,combustible])=>({fecha,combustible:Math.round(combustible*10)/10}));
  },[filtered,mode]);

  // Ranking por equipo
  const rankingEquipos=useMemo(()=>{
    const m={};
    conCombustible.forEach(r=>{
      if(!m[r.maquina])m[r.maquina]={maquina:r.maquina,total:0,horas:0,cargas:0,tipo:r._tipo};
      m[r.maquina].total+=Number(r.combustible)||0;
      m[r.maquina].horas+=Number(r.horas)||0;
      m[r.maquina].cargas+=1;
    });
    return Object.values(m)
      .map(d=>({...d,total:Math.round(d.total*10)/10,ratio:d.horas>0?Math.round((d.total/d.horas)*100)/100:0}))
      .sort((a,b)=>b.total-a.total);
  },[conCombustible]);

  // Distribución por proyecto
  const porProyecto=useMemo(()=>{
    const m={};
    conCombustible.forEach(r=>{
      const p=r.proyecto||"Sin proyecto";
      m[p]=(m[p]||0)+(Number(r.combustible)||0);
    });
    return Object.entries(m).map(([proyecto,total],i)=>({proyecto,total:Math.round(total*10)/10,color:[C.accent,C.teal,C.purple,C.yellow,C.blue][i%5]}));
  },[conCombustible]);

  const cols=useMemo(()=>[
    {key:"fecha",label:"Fecha",render:v=>fmtFecha(v)},
    {key:"maquina",label:"Equipo",render:v=><Badge color={C.purple}>{v}</Badge>},
    {key:"turno",label:"Turno",render:v=><Badge color={(v||"").toUpperCase().includes("NOCHE")?C.purple:C.blue}>{(v||"").toUpperCase().includes("NOCHE")?"TN":"TD"}</Badge>},
    {key:"operario",label:"Operario"},
    {key:"supervisor",label:"Supervisor"},
    {key:"horas",label:"Horas",render:v=><span style={{color:C.accent,fontWeight:600}}>{fmtNum(v)}</span>},
    {key:"combustible",label:"Combustible",render:v=><span style={{color:C.teal,fontWeight:700}}>{fmtNum(v)} L</span>},
    {key:"proyecto",label:"Proyecto",render:v=><Badge color={proyColor(v)}>{v||"—"}</Badge>},
  ],[]);

  const filteredSorted=useMemo(()=>[...conCombustible].sort((a,b)=>b.fecha.localeCompare(a.fecha)),[conCombustible]);

  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Filtros */}
      <Card>
        <div style={{padding:"12px 14px",display:"flex",flexDirection:"column",gap:10}}>
          <div style={{display:"flex",gap:7}}>
            <TabBtn active={mode==="dia"} onClick={()=>setMode("dia")}>Por día</TabBtn>
            <TabBtn active={mode==="periodo"} onClick={()=>setMode("periodo")}>Por período</TabBtn>
          </div>
          <div style={{display:"flex",flexWrap:"wrap",gap:10,alignItems:"flex-end"}}>
            {mode==="dia"?<DateIn label="Fecha" value={fecha} onChange={setFecha}/>:<><PeriodMonthYear fechaD={fechaD} fechaH={fechaH} setFechaD={setFechaD} setFechaH={setFechaH}/><DateIn label="Desde" value={fechaD} onChange={setFechaD} max={fechaH||undefined}/><DateIn label="Hasta" value={fechaH} onChange={setFechaH} min={fechaD||undefined} warn={fechaH&&fechaD&&fechaH<fechaD?"≥ Desde":null}/></>}
            <MultiSel label="Tipo de Máquina" value={tipoMaquina} onChange={v=>{setTipoMaquina(v);set("maquina","todas");}} options={ROP05_TIPOS_MAQUINA.map(t=>({value:t.value,label:t.label}))}/>
            <MultiSel label="Proyecto" value={vals.proyecto} onChange={v=>set("proyecto",v)} options={[{value:"todos",label:"Todos"},...opts.proyecto.map(p=>({value:p,label:p}))]}/>
            <MultiSel label="Equipo" value={vals.maquina} onChange={v=>set("maquina",v)} options={[{value:"todas",label:"Todos"},...opts.maquina.filter(m=>multiIsAll(tipoMaquina,"todas")||tipoMatchMachineROP05(tipoMaquina,m)).map(m=>({value:m,label:m}))]}/>
            <MultiSel label="Supervisor" value={vals.supervisor} onChange={v=>set("supervisor",v)} options={[{value:"todos",label:"Todos"},...opts.supervisor.map(s=>({value:s,label:s}))]}/>
            <MultiSel label="Operario" value={vals.operario} onChange={v=>set("operario",v)} options={[{value:"todos",label:"Todos"},...opts.operario.map(o=>({value:o,label:o}))]}/>
            <button onClick={reset} style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:5,padding:"6px 12px",borderRadius:7,border:`1px solid ${C.red}44`,background:C.redDim,color:C.red,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"Inter",opacity:hayFiltros?1:0.3,pointerEvents:hayFiltros?"auto":"none"}}>
              <Icon name="close" size={11} color={C.red}/>Limpiar filtros
            </button>
          </div>
        </div>
      </Card>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))",gap:10}}>
        <StatCard icon="fuel" label="Combustible Total" value={fmtNum(stats.total)} sub="litros" color={C.teal} small/>
        <StatCard icon="hours" label="Horas Trabajadas" value={fmtNum(stats.horas)} color={C.yellow} small/>
        <StatCard icon="parts" label="Cargas Registradas" value={stats.registrosConCarga} color={C.blue} small/>
        <StatCard icon="equip" label="Equipos con Carga" value={stats.equiposConCarga} color={C.purple} small/>
        <StatCard icon="fuel" label="Litros / Carga" value={fmtNum(stats.promedioPorCarga)} color={C.teal} small/>
        <StatCard icon="fuel" label="Litros / Hora" value={fmtNum(stats.ratio)} color={C.accent} small/>
      </div>

      {/* Evolución temporal */}
      {mode==="periodo"&&combFecha.length>0&&(
        <Card title="Combustible por Fecha">
          <div style={{padding:"10px 6px"}}>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={combFecha} margin={{left:0,right:10}}>
                <defs><linearGradient id="gc" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={C.teal} stopOpacity={.35}/><stop offset="95%" stopColor={C.teal} stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false}/>
                <XAxis dataKey="fecha" tick={{fill:C.textMuted,fontSize:9}} axisLine={false} tickLine={false}/>
                <YAxis tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
                <Tooltip content={<ChartTip/>}/>
                <Area type="monotone" dataKey="combustible" stroke={C.teal} fill="url(#gc)" name="Combustible (L)" strokeWidth={2}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Ranking + distribución por proyecto */}
      <div style={{display:"grid",gridTemplateColumns:"1.3fr 1fr",gap:12}}>
        <Card title={`Ranking de Consumo por Equipo (${rankingEquipos.length})`}>
          <div style={{padding:"10px 6px"}}>
            <ResponsiveContainer width="100%" height={Math.max(220,rankingEquipos.slice(0,12).length*32)}>
              <BarChart data={rankingEquipos.slice(0,12)} layout="vertical" margin={{left:10,right:20}}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
                <XAxis type="number" tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false}/>
                <YAxis type="category" dataKey="maquina" tick={{fill:C.textSub,fontSize:10}} axisLine={false} tickLine={false} width={80}/>
                <Tooltip content={<ChartTip/>}/>
                <Bar dataKey="total" name="Combustible (L)" fill={C.teal} radius={[0,4,4,0]}/>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card title="Distribución por Proyecto">
          <div style={{padding:"10px 6px"}}>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={porProyecto} dataKey="total" nameKey="proyecto" cx="50%" cy="50%" outerRadius={75} label={({proyecto,total})=>`${proyecto}: ${fmtNum(total)}L`}>
                  {porProyecto.map((p,i)=><Cell key={i} fill={p.color}/>)}
                </Pie>
                <Tooltip content={<ChartTip/>}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Tabla de ranking detallado */}
      <Card title="Detalle por Equipo">
        <div className="dm-table-scroll" style={{overflowX:"auto",overflowY:"auto",maxHeight:520,scrollbarGutter:"stable"}}>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{background:C.surface}}>
                {["Equipo","Tipo","Litros Totales","Horas","Litros/Hora","Cargas"].map(h=>(
                  <th key={h} style={{padding:"8px 14px",fontSize:11,fontWeight:700,color:C.textMuted,textAlign:"left",borderBottom:`1px solid ${C.border}`}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rankingEquipos.map((r,i)=>(
                <tr key={r.maquina} style={{background:i%2===0?"rgba(255,255,255,0.055)":"rgba(255,255,255,0.10)"}}
                  onMouseEnter={ev=>ev.currentTarget.style.background=C.accent+"11"}
                  onMouseLeave={ev=>ev.currentTarget.style.background=i%2===0?"transparent":C.surface+"33"}
                >
                  <td style={{padding:"8px 14px",fontSize:12,fontWeight:600,borderBottom:`1px solid ${C.border}18`}}><Badge color={C.purple}>{r.maquina}</Badge></td>
                  <td style={{padding:"8px 14px",fontSize:11,color:C.textSub,borderBottom:`1px solid ${C.border}18`}}>{r.tipo||"—"}</td>
                  <td style={{padding:"8px 14px",fontSize:12,fontWeight:700,color:C.teal,borderBottom:`1px solid ${C.border}18`}}>{fmtNum(r.total)} L</td>
                  <td style={{padding:"8px 14px",fontSize:12,color:C.accent,borderBottom:`1px solid ${C.border}18`}}>{fmtNum(r.horas)}</td>
                  <td style={{padding:"8px 14px",fontSize:12,color:C.text,borderBottom:`1px solid ${C.border}18`}}>{fmtNum(r.ratio)}</td>
                  <td style={{padding:"8px 14px",fontSize:12,color:C.textSub,borderBottom:`1px solid ${C.border}18`}}>{r.cargas}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rankingEquipos.length===0&&<div style={{padding:20,textAlign:"center",color:C.textMuted,fontSize:12}}>Sin cargas de combustible con los filtros seleccionados</div>}
        </div>
      </Card>

      {/* Tabla de registros */}
      <Card title={`Registros con Combustible (${conCombustible.length})`} action={<BtnExcel onClick={()=>excelFromCols(cols,filteredSorted,"Combustible_ROP02")}/>}>
        <Table cols={cols} rows={filteredSorted} maxH={400} emptyMsg="Sin registros de combustible con los filtros seleccionados"/>
      </Card>
    </div>
  );
}

// ─── ViewCHC — Indicador Control de Horas Contratadas ────────────────────────
function ViewCHC({rop02All,extState,setExtState}){
  const rop02Prod=useMemo(()=>rop02All.filter(r=>!r._excluded),[rop02All]);
  const proyecto=extState?.proyecto??"todos";
  const setProyecto=v=>setExtState(s=>({...s,proyecto:v}));
  const tipoMaquina=extState?.tipoMaquina??"todas";
  const setTipoMaquina=v=>setExtState(s=>({...s,tipoMaquina:v}));
  const HS_MES=180;

  // Meses disponibles: lista fija de nombres
  const MESES=["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  // Años disponibles a partir de los datos
  const años=useMemo(()=>{
    const ys=new Set(["2025","2026","2027","2028"]); // años mínimos garantizados
    rop02All.forEach(r=>{if(r.fecha)ys.add(r.fecha.slice(0,4));});
    return [...ys].sort();
  },[rop02All]);

  const añoSelec=extState?.añoSelec??String(new Date().getFullYear());
  const setAñoSelec=v=>setExtState(s=>({...s,añoSelec:v}));
  const mesIdx=extState?.mesIdx??new Date().getMonth(); // 0=Enero
  const setMesIdx=v=>setExtState(s=>({...s,mesIdx:v}));

  const proyectos=useMemo(()=>uniq(rop02All.filter(r=>!r._excluded&&!(["FILO SUR","EL ZORRO"].includes(r.proyecto))).map(r=>r.proyecto)),[rop02All]);

  // Sub-pestaña: período "26-25" (José María / Filo del Sol) vs período de
  // mes calendario (Filo Sur, donde el mes coincide con el período 1-fin de mes)
  const chcTab=extState?.chcTab??"principal";
  const setChcTab=v=>setExtState(s=>({...s,chcTab:v}));

  // Calcular fechaD y fechaH a partir del mes/año seleccionado
  // - "principal": del 26 del mes anterior al 25 del mes seleccionado
  //   Ej: Mayo = del 26/04 al 25/05
  // - "filosur": mes calendario completo (1 al último día del mes)
  const{fechaD,fechaH,diasPeriodo}=useMemo(()=>{
    const y=parseFloat(añoSelec);
    const m=mesIdx; // 0=Enero
    if(chcTab==="filosur"||chcTab==="zorro"){
      const dD=`${y}-${String(m+1).padStart(2,"0")}-01`;
      const lastDay=new Date(y,m+1,0).getDate();
      const dH=`${y}-${String(m+1).padStart(2,"0")}-${String(lastDay).padStart(2,"0")}`;
      return{fechaD:dD,fechaH:dH,diasPeriodo:lastDay};
    }
    // Inicio: 26 del mes anterior al mes seleccionado
    // Si enero (m=0): inicio = 26/12 del año anterior
    const mesAnteriorNum=m===0?12:m;          // número de mes (1-12) del mes anterior
    const añoInicio=m===0?y-1:y;             // año del inicio
    const dD=`${añoInicio}-${String(mesAnteriorNum).padStart(2,"0")}-26`;
    // Fin: 25 del mes seleccionado en el año seleccionado
    const dH=`${y}-${String(m+1).padStart(2,"0")}-25`;
    const dias=Math.round((new Date(dH)-new Date(dD))/(1000*60*60*24))+1;
    return{fechaD:dD,fechaH:dH,diasPeriodo:dias};
  },[añoSelec,mesIdx,chcTab]);

  // Base: solo equipos productivos filtrados por proyecto y período
  const base=useMemo(()=>rop02All.filter(r=>{
    if(r._excluded)return false;
    if(chcTab==="filosur"){
      if(r.proyecto!=="FILO SUR")return false;
    }else if(chcTab==="zorro"){
      if(r.proyecto!=="EL ZORRO")return false;
    }else{
      if(r.proyecto==="FILO SUR"||r.proyecto==="EL ZORRO")return false;
      if(!matchMulti(r.proyecto,proyecto,"todos"))return false;
    }
    if(!dmMatchTipoMaquinaSeleccion(r.maquina,tipoMaquina))return false;
    if(r.fecha<fechaD||r.fecha>fechaH)return false;
    return true;
  }),[rop02All,proyecto,fechaD,fechaH,chcTab,tipoMaquina]);

  // Agrupar por máquina y calcular métricas
  const rows=useMemo(()=>{
    const m={};
    base.forEach(r=>{
      if(!m[r.maquina])m[r.maquina]={
        maquina:r.maquina,
        proyecto:r.proyecto,
        fechas:[],
        horasTrabajo:0,
        diasFS:0,
        diasOD:0,
        diasFaltaOp:0,
      };
      const eq=m[r.maquina];
      eq.fechas.push(r.fecha);
      if(r.estado==="TRABAJO")eq.horasTrabajo+=r.horas;
      else if(r.estado==="FS")eq.diasFS+=1;
      else if(r.estado==="OD")eq.diasOD+=1;
    });

    return Object.values(m).map(eq=>{
      const fechasOrd=[...new Set(eq.fechas)].sort();
      const primerRegistro=fechasOrd[0]||fechaD;
      const ultimaFecha=fechasOrd[fechasOrd.length-1]||fechaH;
      // Fecha inicio: la más tardía entre el inicio del período y el primer registro del equipo
      const fechaInicio=primerRegistro>fechaD?primerRegistro:fechaD;
      // Fecha fin: la más temprana entre el fin del período y el último registro del equipo
      const fechaFin=ultimaFecha<fechaH?ultimaFecha:fechaH;
      // Días totales del equipo en el período (por diferencia de fechas)
      const diasTotalesEquipo=fechaInicio&&fechaFin?
        Math.round((new Date(fechaFin)-new Date(fechaInicio))/(1000*60*60*24))+1:diasPeriodo;
      // diasEfectivos (trabajo + OD) = días totales - días FS
      // Garantiza que diasEfectivos + diasFS = diasTotalesEquipo
      const diasEfectivos=Math.max(0, diasTotalesEquipo-eq.diasFS);
      // Horas contratadas proporcionales a días trabajados
      // Rodillos compactadores en FILO DEL SOL tienen 100hs, en JOSE MARIA 180hs
      const esRodillo=/^(ROD|RPC|RCP)/.test(eq.maquina);
      const esFilo=eq.proyecto==="FILO DEL SOL";
      const HS_EQUIPO=esRodillo&&esFilo?100:HS_MES;
      // Hs contratadas = (hs_equipo / días_período) × días_totales_equipo (fecha inicio a fecha fin)
      const hsContratadas=diasPeriodo>0?Math.round((HS_EQUIPO/diasPeriodo)*diasTotalesEquipo*10)/10:HS_EQUIPO;
      const diasEfectivosYOD=diasEfectivos;
      // Horas OD = días OD × (180hs / días del período)
      const hsOD=diasPeriodo>0?Math.round((HS_EQUIPO/diasPeriodo)*eq.diasOD*10)/10:0;
      // % CHC = (hs trabajadas + hs OD) / hs contratadas
      const pct=hsContratadas>0?Math.round(((eq.horasTrabajo+hsOD)/hsContratadas)*10000)/100:0;
      return{
        ...eq,
        fechaInicio,
        fechaFin,
        diasEfectivos:diasEfectivosYOD,
        hsOD,
        hsContratadas,
        pct,
      };
    }).sort((a,b)=>a.maquina.localeCompare(b.maquina));
  },[base,fechaD,fechaH,diasPeriodo]);

  // Totales
  const totales=useMemo(()=>{
    const horasTrabajo=rows.reduce((s,r)=>s+r.horasTrabajo,0);
    const hsOD=Math.round(rows.reduce((s,r)=>s+r.hsOD,0)*10)/10;
    const hsContratadas=Math.round(rows.reduce((s,r)=>s+r.hsContratadas,0)*10)/10;
    const pct=hsContratadas>0?Math.round(((horasTrabajo+hsOD)/hsContratadas)*1000)/10:0;
    // Promedio simple de los porcentajes individuales para la fila TOTAL de la tabla.
    const pctPromedio=rows.length>0
      ? Math.round((rows.reduce((s,r)=>s+(Number(r.pct)||0),0)/rows.length)*100)/100
      : 0;
    return{
      horasTrabajo,
      diasFS:rows.reduce((s,r)=>s+r.diasFS,0),
      diasOD:rows.reduce((s,r)=>s+r.diasOD,0),
      hsOD,
      hsContratadas,
      pct,
      pctPromedio,
    };
  },[rows]);

  const semPct=(p)=>{
    if(p>=90)return{color:C.green,bg:C.greenDim};
    if(p>=70)return{color:C.yellow,bg:C.yellowDim};
    return{color:C.red,bg:C.redDim};
  };


  return(
    <div className="fade-in" style={{display:"flex",flexDirection:"column",gap:14}}>
      {/* Sub-pestañas de Calidad: principal 26-25 y proyectos especiales por mes calendario */}
      <div style={{borderBottom:`1px solid ${C.border}`,paddingBottom:2}}>
        <SubTab active={chcTab==="principal"} onClick={()=>setChcTab("principal")}>José María / Filo del Sol</SubTab>
        <SubTab active={chcTab==="filosur"} onClick={()=>setChcTab("filosur")}>Filo Sur</SubTab>
        <SubTab active={chcTab==="zorro"} onClick={()=>setChcTab("zorro")}>El Zorro</SubTab>
      </div>
      {/* Filtros */}
      <Card>
        <div style={{padding:"12px 14px",display:"flex",flexWrap:"wrap",alignItems:"flex-end",gap:12}}>
          <Icon name="filter" size={14} color={C.textSub}/>
          <Sel label="Mes" value={String(mesIdx)} onChange={v=>setMesIdx(Number(v))}
            options={MESES.map((m,i)=>({value:String(i),label:m}))}/>
          <Sel label="Año" value={añoSelec} onChange={setAñoSelec}
            options={años.map(y=>({value:y,label:y}))}/>
          <div style={{display:"flex",flexDirection:"column",gap:3}}>
            <label style={{fontSize:10,color:C.textMuted,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>Período</label>
            <div style={{fontSize:12,color:C.textSub,padding:"7px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:7,whiteSpace:"nowrap"}}>
              {fmtFecha(fechaD)} → {fmtFecha(fechaH)}
            </div>
          </div>
          <MultiSel label="Tipo de Máquina" value={tipoMaquina} onChange={setTipoMaquina} options={dmTipoMaquinaOptions()}/>
          {chcTab==="principal"?(
            <MultiSel label="Proyecto" value={proyecto} onChange={setProyecto}
              options={[{value:"todos",label:"Todos"},...proyectos.map(p=>({value:p,label:p}))]}/>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:3}}>
              <label style={{fontSize:10,color:C.textMuted,fontWeight:600,letterSpacing:".06em",textTransform:"uppercase"}}>Proyecto</label>
              <div style={{fontSize:12,padding:"7px 10px",background:C.surface,border:`1px solid ${C.border}`,borderRadius:7}}>
                <Badge color={proyColor(chcTab==="zorro"?"EL ZORRO":"FILO SUR")}>{chcTab==="zorro"?"EL ZORRO":"FILO SUR"}</Badge>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* KPIs */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(140px,1fr))",gap:10}}>
        <StatCard icon="equip" label="Equipos" value={rows.length} color={C.purple} small/>
        <StatCard icon="hours" label="Hs Trabajadas" value={fmtNum(totales.horasTrabajo)} color={C.accent} small/>
        <StatCard icon="hours" label="Hs Contratadas" value={fmtNum(totales.hsContratadas)} color={C.blue} small/>
        <StatCard icon="warn" label="Días FS Total" value={totales.diasFS} color={C.red} small/>
        <StatCard icon="parts" label="Días OD Total" value={totales.diasOD} color={C.yellow} small/>
        <StatCard icon="prod" label="% Cumplimiento" value={`${totales.pct}%`} sub={totales.pct>=90?"ÓPTIMO":totales.pct>=70?"ATENCIÓN":"CRÍTICO"} color={semPct(totales.pct).color} small/>
      </div>


      {/* Tabla */}
      <Card title={`Control de Horas Contratadas (${rows.length} equipos)`} action={
        <button onClick={()=>{const label=`${MESES[mesIdx]}_${añoSelec}`;generarExcelICHC(rows,totales,label);}} style={{display:"flex",alignItems:"center",gap:5,padding:"5px 12px",borderRadius:7,border:`1px solid ${C.teal}44`,background:C.tealDim,color:C.teal,cursor:"pointer",fontSize:11,fontWeight:600,fontFamily:"Inter"}}>⬇ Excel</button>
      }>
        <div className="dm-table-scroll" style={{overflowX:"auto",overflowY:"auto",maxHeight:520,scrollbarGutter:"stable"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead>
              <tr style={{background:C.surface}}>
                {["Máquina","Proyecto","Hs Efectivas","Fecha Inicio","Fecha Fin","Días Efect.+OD","Días FS","Días OD","Hs Op. a Disposición","Días Sin Operador","Hs Contratadas","% CHC"].map((h,i)=>(
                  <th key={i} style={{padding:"9px 10px",textAlign:i>=2?"center":"left",color:C.textSub,fontWeight:600,fontSize:11,letterSpacing:".04em",textTransform:"uppercase",borderBottom:`1px solid ${C.border}`,whiteSpace:"nowrap",position:"sticky",top:0,background:C.surface}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length===0?(
                <tr><td colSpan={11} style={{padding:28,textAlign:"center",color:C.textMuted}}>Sin datos para el período seleccionado</td></tr>
              ):rows.map((r,i)=>{
                const sem=semPct(r.pct);
                return(
                  <tr key={r.maquina} style={{background:i%2===0?"transparent":C.surface+"66"}}>
                    <td style={{padding:"8px 10px",borderBottom:`1px solid ${C.border}18`}}><Badge color={C.purple}>{r.maquina}</Badge></td>
                    <td style={{padding:"8px 10px",borderBottom:`1px solid ${C.border}18`}}><Badge color={proyColor(r.proyecto)}>{r.proyecto||"—"}</Badge></td>
                    <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:C.accent,fontWeight:700}}>{fmtNum(r.horasTrabajo)}</td>
                    <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:C.textSub}}>{fmtFecha(r.fechaInicio)}</td>
                    <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:C.textSub}}>{fmtFecha(r.fechaFin)}</td>
                    <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:C.text,fontWeight:600}}>{r.diasEfectivos}</td>
                    <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:r.diasFS>0?C.red:C.textMuted,fontWeight:r.diasFS>0?700:400}}>{r.diasFS||"—"}</td>
                    <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:r.diasOD>0?C.yellow:C.textMuted,fontWeight:r.diasOD>0?700:400}}>{r.diasOD||"—"}</td>
                    <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:r.hsOD>0?C.yellow:C.textMuted,fontWeight:r.hsOD>0?700:400}}>{r.hsOD>0?fmtNum(r.hsOD):"—"}</td>
                    <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:r.diasFaltaOp>0?C.purple:C.textMuted}}>{r.diasFaltaOp||"—"}</td>
                    <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`,color:C.blue,fontWeight:600}}>{fmtNum(r.hsContratadas)}</td>
                    <td style={{padding:"8px 10px",textAlign:"center",borderBottom:`1px solid ${C.border}18`}}>
                      <span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:11,fontWeight:700,color:sem.color,background:sem.bg,border:`1px solid ${sem.color}44`}}>{Number(r.pct).toFixed(2)}%</span>
                    </td>
                  </tr>
                );
              })}
              {/* Fila de totales */}
              {rows.length>0&&(
                <tr style={{background:C.surface,borderTop:`2px solid ${C.border}`}}>
                  <td colSpan={2} style={{padding:"10px 10px",fontFamily:"Inter",fontWeight:700,color:C.text}}>TOTAL</td>
                  <td style={{padding:"10px",textAlign:"center",fontFamily:"Inter",fontWeight:800,color:C.accent}}>{fmtNum(totales.horasTrabajo)}</td>
                  <td colSpan={2}/>
                  <td style={{padding:"10px",textAlign:"center",fontFamily:"Inter",fontWeight:700,color:C.text}}/>
                  <td style={{padding:"10px",textAlign:"center",fontFamily:"Inter",fontWeight:700,color:C.red}}>{totales.diasFS||"—"}</td>
                  <td style={{padding:"10px",textAlign:"center",fontFamily:"Inter",fontWeight:700,color:C.yellow}}>{totales.diasOD||"—"}</td>
                  <td style={{padding:"10px",textAlign:"center",fontFamily:"Inter",fontWeight:700,color:C.yellow}}>{totales.hsOD>0?fmtNum(totales.hsOD):"—"}</td>
                  <td/>
                  <td style={{padding:"10px",textAlign:"center",fontFamily:"Inter",fontWeight:800,color:C.blue}}>{fmtNum(totales.hsContratadas)}</td>
                  <td style={{padding:"10px",textAlign:"center"}}>
                    <span style={{display:"inline-block",padding:"3px 10px",borderRadius:20,fontSize:12,fontWeight:800,color:semPct(totales.pctPromedio).color,background:semPct(totales.pctPromedio).bg,border:`1px solid ${semPct(totales.pctPromedio).color}44`}}>{Number(totales.pctPromedio).toFixed(2)}%</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ── Dashboards ICHC ─────────────────────────────────────────────── */}
      {/* 1. Gauge general — ancho completo */}
      <Card title="Cumplimiento General — % CHC">
        <div style={{padding:"20px 16px",display:"flex",alignItems:"center",gap:24,flexWrap:"wrap",justifyContent:"center"}}>
          {(()=>{
            const sem=semPct(totales.pct);
            return(<>
              <div style={{width:130,height:130,borderRadius:"50%",border:`8px solid ${sem.color}`,background:sem.bg,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",boxShadow:`0 0 40px ${sem.color}44`,flexShrink:0}}>
                <span style={{fontFamily:"Inter",fontSize:34,fontWeight:800,color:sem.color,lineHeight:1}}>{totales.pct}%</span>
                <span style={{fontSize:10,color:sem.color,fontWeight:700,letterSpacing:".1em",marginTop:2}}>CHC</span>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8,minWidth:220}}>
                {[{l:"Hs Efectivas",v:fmtNum(totales.horasTrabajo),c:C.accent},{l:"Hs Op. a Disposición",v:fmtNum(totales.hsOD),c:C.yellow},{l:"Hs Contratadas",v:fmtNum(totales.hsContratadas),c:C.blue}].map(({l,v,c})=>(
                  <div key={l} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"6px 12px",background:c+"15",borderRadius:7,border:`1px solid ${c}33`,gap:16}}>
                    <span style={{fontSize:11,color:C.textSub}}>{l}</span>
                    <span style={{fontFamily:"Inter",fontWeight:700,color:c,fontSize:13}}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {[["≥ 90%","Óptimo",C.green],["70% – 89%","Atención",C.yellow],["< 70%","Crítico",C.red]].map(([r,l,c])=>(
                  <div key={l} style={{display:"flex",alignItems:"center",gap:8}}>
                    <div style={{width:10,height:10,borderRadius:"50%",background:c,flexShrink:0}}/>
                    <span style={{fontSize:11,color:C.textSub}}><strong style={{color:c}}>{r}</strong> — {l}</span>
                  </div>
                ))}
              </div>
            </>);
          })()}
        </div>
      </Card>

      {/* 2 y 3 — Side by side con mismo orden de equipos en eje Y */}
      {(()=>{
        const rowsSorted=[...rows].sort((a,b)=>a.maquina.localeCompare(b.maquina));
        const h=Math.max(220,rowsSorted.length*30+50);
        return(
          <div style={{display:"grid",gridTemplateColumns:"2fr 3fr",gap:14}}>
            {/* % CHC por equipo */}
            <Card title="% CHC por Equipo">
              <div style={{padding:"8px 16px 0",display:"flex",gap:16,flexWrap:"wrap"}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:20,borderTop:`2px dashed ${C.green}`}}/>
                  <span style={{fontSize:10,color:C.textSub}}><strong style={{color:C.green}}>90%</strong> Óptimo</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:20,borderTop:`2px dashed ${C.yellow}`}}/>
                  <span style={{fontSize:10,color:C.textSub}}><strong style={{color:C.yellow}}>70%</strong> Atención</span>
                </div>
              </div>
              <div style={{padding:"8px 6px 12px"}}>
                <ResponsiveContainer width="100%" height={h}>
                  <BarChart data={rowsSorted} layout="vertical" margin={{left:8,right:36}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
                    <XAxis type="number" domain={[0,Math.max(150,Math.ceil(Math.max(...rowsSorted.map(r=>r.pct),0)/10)*10)]} tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false} unit="%"/>
                    <YAxis type="category" dataKey="maquina" tick={{fill:C.textSub,fontSize:10}} width={88} axisLine={false} tickLine={false}/>
                    <Tooltip content={({active,payload})=>{
                      if(!active||!payload?.length)return null;
                      const d=payload[0].payload;const sem=semPct(d.pct);
                      return(<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 14px",fontSize:12}}>
                        <div style={{fontFamily:"Inter",fontWeight:700,color:sem.color,marginBottom:4}}>{d.maquina}</div>
                        <div style={{color:C.textSub}}>CHC: <strong style={{color:sem.color}}>{d.pct}%</strong></div>
                        <div style={{color:C.textSub}}>Hs efectivas: <strong style={{color:C.accent}}>{fmtNum(d.horasTrabajo)}</strong></div>
                        <div style={{color:C.textSub}}>Hs contratadas: <strong style={{color:C.blue}}>{fmtNum(d.hsContratadas)}</strong></div>
                      </div>);
                    }}/>
                    <ReferenceLine x={90} stroke={C.green} strokeDasharray="4 4" strokeWidth={1.5}/>
                    <ReferenceLine x={70} stroke={C.yellow} strokeDasharray="4 4" strokeWidth={1.5}/>
                    <Bar dataKey="pct" name="% CHC" radius={[0,4,4,0]} barSize={16}>
                      {rowsSorted.map((r,i)=>{const s=semPct(r.pct);return<Cell key={i} fill={s.color}/>;} )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Composición de días */}
            <Card title="Composición de Días por Equipo">
              <div style={{padding:"8px 16px 0",display:"flex",gap:16,flexWrap:"wrap"}}>
                {[["Días Efectivos+OD",C.green],["Días FS",C.red]].map(([l,c])=>(
                  <div key={l} style={{display:"flex",alignItems:"center",gap:5}}>
                    <div style={{width:10,height:10,borderRadius:2,background:c}}/>
                    <span style={{fontSize:10,color:C.textSub}}>{l}</span>
                  </div>
                ))}
              </div>
              <div style={{padding:"8px 6px 12px"}}>
                <ResponsiveContainer width="100%" height={h}>
                  <BarChart data={rowsSorted} layout="vertical" margin={{left:8,right:16}}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false}/>
                    <XAxis type="number" tick={{fill:C.textMuted,fontSize:10}} axisLine={false} tickLine={false} unit=" días"/>
                    <YAxis type="category" dataKey="maquina" tick={{fill:C.textSub,fontSize:10}} width={88} axisLine={false} tickLine={false}/>
                    <Tooltip content={({active,payload,label})=>{
                      if(!active||!payload?.length)return null;
                      return(<div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:9,padding:"10px 14px",fontSize:12}}>
                        <div style={{fontFamily:"Inter",fontWeight:700,color:C.text,marginBottom:6}}>{label}</div>
                        {payload.map((p,i)=><div key={i} style={{color:p.fill,fontWeight:600}}>{p.name}: {p.value} días</div>)}
                      </div>);
                    }}/>
                    <Bar dataKey="diasEfectivos" name="Días Efectivos+OD" fill={C.green} stackId="a" barSize={16}/>
                    <Bar dataKey="diasFS" name="Días FS" fill={C.red} stackId="a" radius={[0,4,4,0]} barSize={16}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>
        );
      })()}
    </div>
  );
}

function TallerCentralSummary({rows=[]}){
  const [boxTooltip,setBoxTooltip]=useState(null);
  const [boxTooltipPinned,setBoxTooltipPinned]=useState(false);
  const hideTimerRef=useRef(null);

  const getVal=useCallback((row,cands)=>{
    const keys=Object.keys(row||{});
    for(const cand of cands){
      const wanted=String(cand||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
      for(const k of keys){
        const kk=String(k||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g," ").trim();
        if(kk===wanted||kk.includes(wanted)||wanted.includes(kk))return row[k];
      }
    }
    return "";
  },[]);

  const countBy=useCallback((cands)=>{
    const m=new Map();
    rows.forEach(r=>{
      const raw=String(getVal(r,cands)||"Sin dato").trim()||"Sin dato";
      if(!m.has(raw))m.set(raw,[]);
      m.get(raw).push(r);
    });
    return [...m.entries()]
      .map(([name,matchedRows])=>[name,matchedRows.length,matchedRows])
      .sort((a,b)=>b[1]-a[1]||String(a[0]).localeCompare(String(b[0])));
  },[rows,getVal]);

  const tipos=useMemo(()=>countBy(["Familia","Tipo de equipo","Tipo","Equipo"]),[countBy]);
  const propiedades=useMemo(()=>countBy(["Propiedad"]),[countBy]);
  const marcas=useMemo(()=>countBy(["Marca"]),[countBy]);
  const combustibles=useMemo(()=>countBy(["Tipo de Combustible","Tipo Combustible","Combustible"]),[countBy]);
  const modelos=useMemo(()=>countBy(["Modelo","Modelo Equipo","Modelo de Equipo"]),[countBy]);
  const anios=useMemo(()=>rows.map(r=>Number(String(getVal(r,["Año de Fabricacion","Año Fabricacion","Anio Fabricacion","Año Fabricación"])||"").replace(/[^0-9]/g,""))).filter(n=>n>1900&&n<2200),[rows,getVal]);
  const antigProm=anios.length?((new Date().getFullYear()-anios.reduce((a,b)=>a+b,0)/anios.length).toFixed(1)):"—";

  const equipmentLabel=useCallback((r)=>{
    const nuevo=String(getVal(r,["Código Nuevo","Codigo Nuevo","Código nuevo","Codigo nuevo"])||"").trim();
    const drusila=String(getVal(r,["Código Drusila","Codigo Drusila","Código de Drusila","Codigo de Drusila"])||"").trim();
    const familia=String(getVal(r,["Familia","Tipo de equipo","Tipo"])||"").trim();
    const modelo=String(getVal(r,["Modelo","Modelo Equipo","Modelo de Equipo"])||"").trim();
    const codigo=nuevo||drusila||"Sin código";
    const extra=[familia,modelo].filter(Boolean).join(" · ");
    return extra?`${codigo} — ${extra}`:codigo;
  },[getVal]);

  const clearHideTimer=useCallback(()=>{
    if(hideTimerRef.current){clearTimeout(hideTimerRef.current);hideTimerRef.current=null;}
  },[]);

  useEffect(()=>()=>clearHideTimer(),[clearHideTimer]);

  const buildTooltip=useCallback((title,name,matchedRows,e)=>{
    const rect=e.currentTarget.getBoundingClientRect();
    return{
      key:`${title}::${name}`,
      title,
      name,
      equipos:(matchedRows||[]).map(equipmentLabel).sort((a,b)=>a.localeCompare(b)),
      x:rect.right,
      y:rect.top
    };
  },[equipmentLabel]);

  const showRowTooltip=useCallback((title,name,matchedRows,e)=>{
    clearHideTimer();
    const next=buildTooltip(title,name,matchedRows,e);
    setBoxTooltip(prev=>prev?.key===next.key?prev:next);
  },[buildTooltip,clearHideTimer]);

  const scheduleHide=useCallback(()=>{
    clearHideTimer();
    if(boxTooltipPinned)return;
    hideTimerRef.current=setTimeout(()=>setBoxTooltip(null),110);
  },[boxTooltipPinned,clearHideTimer]);

  const togglePinned=useCallback((title,name,matchedRows,e)=>{
    e.preventDefault();
    e.stopPropagation();
    clearHideTimer();
    const next=buildTooltip(title,name,matchedRows,e);
    if(boxTooltipPinned&&boxTooltip?.key===next.key){
      setBoxTooltipPinned(false);
      setBoxTooltip(null);
      return;
    }
    setBoxTooltip(next);
    setBoxTooltipPinned(true);
  },[boxTooltipPinned,boxTooltip,buildTooltip,clearHideTimer]);

  useEffect(()=>{
    if(!boxTooltipPinned)return;
    const close=e=>{
      if(e.target?.closest?.('[data-taller-tooltip="true"], [data-taller-box-row="true"]'))return;
      setBoxTooltipPinned(false);
      setBoxTooltip(null);
    };
    document.addEventListener("pointerdown",close,true);
    return()=>document.removeEventListener("pointerdown",close,true);
  },[boxTooltipPinned]);

  // Se devuelve JSX directamente en vez de crear un componente nuevo en cada hover.
  // Así React conserva el mismo nodo scrolleable y no vuelve arriba al mostrar/ocultar el tooltip.
  const renderBoxList=useCallback((title,items,color)=>(
    <div key={title} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:12,padding:12,minHeight:170,position:"relative"}}>
      <div style={{fontSize:12,fontWeight:900,color,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>{title}</div>
      <div
        data-taller-scroll-list="true"
        style={{display:"flex",flexDirection:"column",gap:3,maxHeight:132,overflowY:"auto",overflowX:"hidden",overscrollBehavior:"contain",paddingRight:4}}
        onWheel={e=>e.stopPropagation()}
      >
        {items.map(([name,count,matchedRows])=>{
          const active=boxTooltip?.key===`${title}::${name}`;
          return(
            <div
              key={name}
              data-taller-box-row="true"
              onMouseEnter={e=>showRowTooltip(title,name,matchedRows,e)}
              onMouseLeave={scheduleHide}
              onClick={e=>togglePinned(title,name,matchedRows,e)}
              style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,fontSize:12,color:C.text,padding:"4px 3px",borderRadius:7,cursor:"pointer",background:active?`${color}18`:"transparent",flex:"0 0 auto"}}
            >
              <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{name}</span>
              <Badge color={color}>{fmtNum(count)}</Badge>
            </div>
          );
        })}
        {!items.length&&<div style={{fontSize:12,color:C.textMuted}}>Sin datos cargados.</div>}
      </div>
    </div>
  ),[boxTooltip?.key,showRowTooltip,scheduleHide,togglePinned]);

  const tooltipNode=boxTooltip&&typeof document!=="undefined"?ReactDOM.createPortal((()=>{
    const width=390;
    const viewportW=window.innerWidth||1200;
    const viewportH=window.innerHeight||800;
    const rightSpace=viewportW-boxTooltip.x;
    const left=rightSpace>=width+24?boxTooltip.x+12:Math.max(10,boxTooltip.x-width-12);
    const estimatedHeight=Math.min(410,96+boxTooltip.equipos.length*25);
    const top=Math.max(10,Math.min(boxTooltip.y,viewportH-estimatedHeight-12));
    return(
      <div
        data-taller-tooltip="true"
        onMouseEnter={clearHideTimer}
        onMouseLeave={scheduleHide}
        onClick={e=>e.stopPropagation()}
        style={{position:"fixed",left,top,width,maxWidth:"calc(100vw - 20px)",zIndex:2147483646,background:"rgba(17,17,17,.98)",border:`1px solid ${boxTooltipPinned?C.blue:C.border}`,borderRadius:11,boxShadow:"0 18px 52px rgba(0,0,0,.82)",overflow:"hidden",pointerEvents:"auto",backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",contain:"layout paint"}}
      >
        <div style={{padding:"10px 12px",borderBottom:`1px solid ${C.border}`,display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:12}}>
          <div>
            <div style={{fontSize:11,fontWeight:900,color:C.textMuted,textTransform:"uppercase",letterSpacing:".06em"}}>{boxTooltip.title}</div>
            <div style={{fontSize:14,fontWeight:900,color:C.text,marginTop:3}}>{boxTooltip.name}</div>
            <div style={{fontSize:11,color:C.textSub,marginTop:2}}>{fmtNum(boxTooltip.equipos.length)} equipos considerados</div>
          </div>
          <div style={{fontSize:10,color:boxTooltipPinned?C.blue:C.textMuted,textAlign:"right",lineHeight:1.35,fontWeight:800}}>
            {boxTooltipPinned?"FIJADO · click en la fila para soltar":"Click en la fila para fijar"}
          </div>
        </div>
        <div style={{maxHeight:300,overflowY:"auto",overscrollBehavior:"contain",padding:"7px 10px"}}>
          {boxTooltip.equipos.map((label,index)=>(
            <div key={`${label}-${index}`} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 3px",borderBottom:index<boxTooltip.equipos.length-1?`1px solid ${C.border}66`:"none",fontSize:12,color:C.text}}>
              <span style={{minWidth:24,color:C.textMuted,fontVariantNumeric:"tabular-nums"}}>{index+1}.</span>
              <span style={{overflowWrap:"anywhere"}}>{label}</span>
            </div>
          ))}
        </div>
      </div>
    );
  })(),document.body):null;

  return(
    <>
      <Card title="Taller Central">
        <div style={{padding:14,display:"flex",flexDirection:"column",gap:14}}>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(180px,1fr))",gap:12}}>
            <StatCard icon="equip" label="Equipos cargados" value={fmtNum(rows.length)} sub="Lista Maestra de Equipos" color={C.teal} small/>
            <StatCard icon="database" label="Tipos de equipo" value={fmtNum(tipos.length)} sub="Familias distintas" color={C.blue} small/>
            <StatCard icon="check" label="Propiedades" value={fmtNum(propiedades.length)} sub="Delta / alquilados / terceros" color={C.green} small/>
            <StatCard icon="parts" label="Marcas" value={fmtNum(marcas.length)} sub="Marcas distintas" color={C.yellow} small/>
            <StatCard icon="truck" label="Modelos" value={fmtNum(modelos.length)} sub="Modelos distintos" color={C.purple} small/>
            <StatCard icon="fuel" label="Combustibles" value={fmtNum(combustibles.length)} sub="Tipos registrados" color={C.red} small/>
            <StatCard icon="hours" label="Antigüedad prom." value={antigProm} sub="Años aproximados" color={C.textSub} small/>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(240px,1fr))",gap:12}}>
            {renderBoxList("Equipos por tipo",tipos,C.blue)}
            {renderBoxList("Equipos por propiedad",propiedades,C.green)}
            {renderBoxList("Equipos por marca",marcas,C.yellow)}
            {renderBoxList("Tipo de combustible",combustibles,C.red)}
          </div>
        </div>
      </Card>
      {tooltipNode}
    </>
  );
}

function ViewTallerCentral({listaEquipos=[],rop02All=[],onReloadLista}){
  const rows=Array.isArray(listaEquipos)?listaEquipos:[];
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <TallerCentralSummary rows={rows}/>
      {rows.length>0
        ? <ViewListaMaestraEquipos rows={rows} rop02All={rop02All||[]} rop05={[]} rma15={[]} onReloadLista={onReloadLista}/>
        : <BlockingDataLoader label="Cargando Lista Maestra de Equipos..." />
      }
    </div>
  );
}


const OFFICE_VIEW_NAMES = new Set([
  "dashboard","listaEquipos","tallerCentral","rop02","horometros","vehiculos","controlROP02",
  "controlErrores","ctrlEquipo","atrasoROP02","combustible","rop05",
  "rop05Discriminacion","rma15CtrlEquipo","chc","control"
]);

function Loader({label}){
  return BlockingDataLoader ? <BlockingDataLoader label={label}/> : null;
}

const remoteFilterValue=(value,empty)=>Array.isArray(value)?value.filter(item=>item&&item!==empty&&item!=="todos"&&item!=="todas"):(value&&value!==empty?value:"");
function remoteTableParams(state={}){
  const vals=state.vals||{},mode=state.mode||"dia";
  return{
    desde:mode==="dia"?(state.fecha||""):(state.fechaD||""),hasta:mode==="dia"?(state.fecha||""):(state.fechaH||""),
    proyecto:remoteFilterValue(vals.proyecto,"todos"),equipo:remoteFilterValue(vals.maquina,"todas"),supervisor:remoteFilterValue(vals.supervisor,"todos"),
    operario:remoteFilterValue(vals.operario,"todos"),estado:remoteFilterValue(state.estado,"todos"),tipo:remoteFilterValue(state.tipoMaquina,"todas"),tarea:remoteFilterValue(state.tarea,"todas"),unidad:remoteFilterValue(vals.unidad,"todas"),
    sortBy:state.sortBy||"fecha",sortDirection:state.sortDirection||"desc",
  };
}

const SECONDARY_ROP02_VIEWS=new Set();
const ymdLocal=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
function secondaryRop02Params(view,state={}){
  if(["listaEquipos","tallerCentral","horometros","vehiculos"].includes(view)&&!state.fecha&&!state.fechaD&&!state.fechaH)return{snapshot:true,days:view==="vehiculos"?45:7};
  if(["controlROP02","controlErrores","ctrlEquipo","chc"].includes(view)){
    const year=Number(state.año||state.añoSelec||new Date().getFullYear()),month=Number(state.mesIdx??new Date().getMonth());
    return{desde:ymdLocal(new Date(year,month-1,26,12)),hasta:ymdLocal(new Date(year,month,25,12))};
  }
  const base=remoteTableParams(state),today=new Date(),from=new Date(today);from.setDate(from.getDate()-(view==="combustible"?90:45));
  return{...base,desde:base.desde||ymdLocal(from),hasta:base.hasta||ymdLocal(today),combustibleOnly:view==="combustible"};
}

export function OficinaTecnicaModule({
  view,
  deps,
  dataHydrated=false,
  rawSources={},
  sourceHasData=()=>false,
  listaEquipos=[],rop02All=[],rop02ControlAll=[],rop05=[],rma15=[],control={},dashSt,setDashSt,
  onReloadLista,
  st02,setSt02,stHorometros,setStHorometros,stVeh,setStVeh,
  stControlROP02,setStControlROP02,stControlErrores,setStControlErrores,
  stCtrlEquipo,setStCtrlEquipo,stComb,setStComb,st05,setSt05,
  stRma15CtrlEquipo,setStRma15CtrlEquipo,stCHC,setStCHC,stCtrl,setStCtrl,
  health,loading,onLoadAll,
}){
  applyDeps(deps);
  // ROP02 / ROP05: carga completa una sola vez por pestaña.
  // Los filtros NO vuelven a consultar Apps Script: se aplican localmente,
  // igual que en Mantenimiento.
  const [remoteTable,setRemoteTable]=useState({
    dataset:"",
    rows:[],
    total:0,
    hasMore:false,
    loading:false,
    loadedOnce:false,
    error:""
  });
  const remoteControllerRef=useRef(null);
  if(!remoteControllerRef.current)remoteControllerRef.current=createHistoricalPagedController();
  const remoteDataset=view==="rop02"?"rop02":view==="rop05"?"rop05":"";
  const remoteParams=useMemo(()=>remoteTableParams(remoteDataset==="rop02"?st02:st05),[remoteDataset,st02,st05]);
  const remoteQueryParams=useMemo(()=>({...remoteParams,operationalOnly:remoteDataset==="rop02",limit:remoteDataset==="rop05"?"all":250}),[remoteDataset,remoteParams]);
  const [remoteStats,setRemoteStats]=useState(null);
  const [remoteFacets,setRemoteFacets]=useState(null);
  useEffect(()=>{if(remoteDataset!=="rop02"){setRemoteStats(null);return;}let alive=true;getRop02Stats(remoteParams).then(value=>{if(alive)setRemoteStats(value);}).catch(()=>{});return()=>{alive=false;};},[remoteDataset,remoteParams]);
  useEffect(()=>{if(remoteDataset!=="rop02"){setRemoteFacets(null);return;}let alive=true;getRop02Facets(remoteParams).then(value=>{if(alive)setRemoteFacets(value);}).catch(error=>{console.error("[ROP02] Supabase facets falló",error);});return()=>{alive=false;};},[remoteDataset,remoteParams]);
  const secondaryState=view==="horometros"?stHorometros:view==="vehiculos"?stVeh:view==="combustible"?stComb:view==="chc"?stCHC:view==="control"?stCtrl:view==="ctrlEquipo"?stCtrlEquipo:stControlErrores;
  const secondaryParams=useMemo(()=>secondaryRop02Params(view,secondaryState),[view,secondaryState]);
  const [secondaryRop02,setSecondaryRop02]=useState(null);
  useEffect(()=>{
    if(!SECONDARY_ROP02_VIEWS.has(view)){setSecondaryRop02(null);return;}
    let alive=true;
    const request=secondaryParams.snapshot?getRop02OperationalSnapshot(secondaryParams):getRop02({...secondaryParams,limit:"all",sortBy:"fecha",sortDirection:"asc"});
    request.then(result=>{if(alive)setSecondaryRop02(normalizeROP02(result.data||[]));}).catch(()=>{});
    return()=>{alive=false;};
  },[view,secondaryParams]);
  const effectiveRop02=SECONDARY_ROP02_VIEWS.has(view)?(secondaryRop02||[]):rop02All;
  const effectiveControlRop02=SECONDARY_ROP02_VIEWS.has(view)?(secondaryRop02||[]):rop02ControlAll;
  const effectiveCrossControl=useMemo(()=>view==="control"?calcControl(effectiveRop02,rop05):control,[view,effectiveRop02,rop05,control]);

  useEffect(()=>{
    if(!remoteDataset)return;
    let alive=true;

    setRemoteTable(previous=>({
      dataset:remoteDataset,
      rows:previous.dataset===remoteDataset?previous.rows:[],
      total:previous.dataset===remoteDataset?previous.total:0,
      hasMore:false,
      loading:true,
      loadedOnce:previous.dataset===remoteDataset&&previous.loadedOnce,
      error:""
    }));

    remoteControllerRef.current.loadFirst(remoteDataset,remoteQueryParams).then(result=>{
      if(!alive)return;
      const rows=remoteDataset==="rop02"?normalizeROP02(result.rows):normalizeROP05(result.rows);
      setRemoteTable({
        dataset:remoteDataset,
        rows,
        total:result.total,
        hasMore:result.hasMore,
        loading:false,
        loadedOnce:true,
        error:""
      });
    }).catch(error=>{
      if(!alive)return;
      setRemoteTable(previous=>({
        ...previous,
        dataset:remoteDataset,
        loading:false,
        error:error?.message||"No se pudieron cargar los datos"
      }));
    });

    return()=>{alive=false;};
  },[remoteDataset,remoteQueryParams]);

  // Ya no hay paginación remota al filtrar. Toda la base está en memoria.
  const loadMoreRemote=useCallback(async()=>{
    const result=await remoteControllerRef.current.loadMore(remoteDataset,remoteQueryParams);
    if(result.stale)return;
    const rows=remoteDataset==="rop02"?normalizeROP02(result.rows):normalizeROP05(result.rows);
    setRemoteTable(previous=>({...previous,rows,total:result.total,hasMore:result.hasMore,loading:false}));
  },[remoteDataset,remoteQueryParams]);
  const exportRemote=useCallback(async()=>{
    if(!remoteDataset)return[];
    const rows=[];
    await fetchAllDatasetPages(remoteDataset,{...remoteParams,operationalOnly:remoteDataset==="rop02"},page=>rows.push(...page));
    return remoteDataset==="rop02"?normalizeROP02(rows):normalizeROP05(rows);
  },[remoteDataset,remoteParams]);

  if(!OFFICE_VIEW_NAMES.has(view))return null;
  if(view==="dashboard"){
    if(Object.keys(rawSources||{}).length===0)return <HealthDashboard health={health} loading={loading} onLoadAll={onLoadAll}/>;
    return <ViewDashboard rop02All={rop02All} rop05={rop05} rma15={rma15} control={control} dashSt={dashSt} setDashSt={setDashSt}/>;
  }
  if(view==="tallerCentral")return dataHydrated&&sourceHasData("lista_equipos")?<ViewTallerCentral listaEquipos={listaEquipos} rop02All={effectiveRop02} onReloadLista={onReloadLista}/>:<Loader label="Cargando Taller Central..."/>;
  if(view==="listaEquipos")return dataHydrated&&sourceHasData("lista_equipos")?<ViewListaMaestraEquipos rows={listaEquipos} rop02All={effectiveRop02} rop05={rop05} rma15={rma15} onReloadLista={onReloadLista}/>:<Loader label="Cargando Lista de Equipos..."/>;
  if(view==="rop02"){
    if(remoteTable.dataset!=="rop02"||!remoteTable.loadedOnce)return <Loader label="Cargando ROP02..."/>;
    return <ViewROP02 rop02All={remoteTable.rows} listaEquipos={listaEquipos} extState={st02} setExtState={setSt02} remoteTotal={remoteTable.total} remoteHasMore={remoteTable.hasMore} onRemoteMore={loadMoreRemote} onRemoteExport={exportRemote} remoteStats={remoteStats} remoteFacets={remoteFacets}/>;
  }
  if(view==="horometros")return effectiveRop02.length>0?<ViewHorometros rop02All={effectiveRop02} extState={stHorometros} setExtState={setStHorometros}/>:<Loader label="Cargando Horómetros..."/>;
  if(view==="vehiculos")return effectiveRop02.length>0?<ViewVehiculos rop02All={effectiveRop02} listaEquipos={listaEquipos} extState={stVeh} setExtState={setStVeh}/>:<Loader label="Cargando Vehículos..."/>;
  if(view==="controlROP02")return effectiveRop02.length>0?<ViewControlROP02 rop02All={effectiveRop02} rop02ControlAll={effectiveControlRop02} tabState={stControlROP02} setTabState={setStControlROP02} stControlErrores={stControlErrores} setStControlErrores={setStControlErrores} stCtrlEquipo={stCtrlEquipo} setStCtrlEquipo={setStCtrlEquipo}/>:<Loader label="Cargando Control de ROP02..."/>;
  if(view==="controlErrores")return effectiveRop02.length>0?<ControlDeErrores rop02All={effectiveRop02} extState={stControlErrores} setExtState={setStControlErrores}/>:<Loader label="Cargando Control de errores..."/>;
  if(view==="ctrlEquipo")return effectiveRop02.length>0?<ControlPorEquipo rop02All={effectiveRop02} extState={stCtrlEquipo} setExtState={setStCtrlEquipo}/>:<Loader label="Cargando Control por Equipo..."/>;
  if(view==="atrasoROP02")return <ViewAtrasoROP02 rop02All={rop02ControlAll} onLegacyFallback={onLoadAll}/>;
  if(view==="combustible")return effectiveRop02.length>0?<ViewCombustible rop02All={effectiveRop02} extState={stComb} setExtState={setStComb}/>:<Loader label="Cargando Combustible..."/>;
  if(view==="rop05"){
    if(remoteTable.dataset!=="rop05"||!remoteTable.loadedOnce)return <Loader label="Cargando Productividad..."/>;
    return <ViewROP05 rop05={remoteTable.rows} extState={st05} setExtState={setSt05} remoteTotal={remoteTable.total} remoteHasMore={remoteTable.hasMore} onRemoteMore={loadMoreRemote} onRemoteExport={exportRemote}/>;
  }
  if(view==="rop05Discriminacion")return dataHydrated&&rop05.length>0?<ViewROP05Discriminacion rop05={rop05} extState={st05} setExtState={setSt05}/>:<Loader label="Cargando Discriminación por tarea..."/>;
  if(view==="rma15CtrlEquipo")return dataHydrated&&rma15.length>0?<ControlRMA15PorEquipo rma15={rma15} extState={stRma15CtrlEquipo} setExtState={setStRma15CtrlEquipo}/>:<Loader label="Cargando Control por Equipo..."/>;
  if(view==="chc")return effectiveRop02.length>0?<ViewCHC rop02All={effectiveRop02} extState={stCHC} setExtState={setStCHC}/>:<Loader label="Cargando ICHC..."/>;
  if(view==="control")return effectiveRop02.length>0&&rop05.length>0?<ViewControl control={effectiveCrossControl} rop02All={effectiveRop02} rop05={rop05} extState={stCtrl} setExtState={setStCtrl}/>:<Loader label="Cargando Control ROP05 vs ROP02..."/>;
  return null;
}

export const OficinaTecnicaView = React.memo(OficinaTecnicaModule);
export { OFFICE_VIEW_NAMES };
