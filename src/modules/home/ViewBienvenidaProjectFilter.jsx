import React from "react";
import { createPortal } from "react-dom";
import ViewBienvenida from "./ViewBienvenida.jsx";
import { collectProjects, projectFromRow, projectLabel } from "../../shared/projects.js";
import { getHomeRop02AvailableDays, getHomeRop02DayRows } from "../../data/homeRop02Data.js";

const STORAGE_KEY="dm_home_summary_project_v3";
const LEGACY_PROJECTS=new Set(["JOSE MARIA","FILO DEL SOL","FILO SUR","EL ZORRO"]);
const EMPTY_RMA_SENTINEL={__dmHomeEmptyProject:true};
const HOME_DAYS_REFRESH_MS=5*60*1000;
const normalizeDateKey=value=>{
  if(value instanceof Date&&!Number.isNaN(value.getTime()))return `${value.getFullYear()}-${String(value.getMonth()+1).padStart(2,"0")}-${String(value.getDate()).padStart(2,"0")}`;
  const raw=String(value??"").trim();
  if(!raw)return "";
  let match=raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if(match)return `${match[1]}-${String(match[2]).padStart(2,"0")}-${String(match[3]).padStart(2,"0")}`;
  match=raw.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2}|\d{4})/);
  if(match){let year=Number(match[3]);if(year<100)year+=2000;return `${year}-${String(match[2]).padStart(2,"0")}-${String(match[1]).padStart(2,"0")}`;}
  const parsed=new Date(raw);
  return Number.isNaN(parsed.getTime())?"":`${parsed.getFullYear()}-${String(parsed.getMonth()+1).padStart(2,"0")}-${String(parsed.getDate()).padStart(2,"0")}`;
};
const dateFromRop02Row=row=>{
  if(!row||typeof row!=="object")return "";
  const direct=row.fecha??row.Fecha??row.FECHA??row.ultimaFecha??row.ULTIMA_FECHA;
  if(direct)return normalizeDateKey(direct);
  const key=Object.keys(row).find(k=>String(k).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").includes("fecha"));
  return key?normalizeDateKey(row[key]):"";
};
const formatDayLabel=iso=>/^\d{4}-\d{2}-\d{2}$/.test(String(iso||""))?`${iso.slice(8,10)}/${iso.slice(5,7)}/${iso.slice(0,4)}`:"Sin fecha";

function readInitialSelection(){
  try{
    const saved=window.localStorage.getItem(STORAGE_KEY);
    if(saved){
      const parsed=JSON.parse(saved);
      if(parsed==="TODOS"||parsed?.all===true)return null;
      if(Array.isArray(parsed))return parsed.map(v=>String(v||"").trim().toUpperCase()).filter(Boolean);
    }
    const old=window.localStorage.getItem("dm_home_summary_project_v2");
    if(old){
      const parsed=JSON.parse(old);
      if(Array.isArray(parsed)){
        const clean=[...new Set(parsed.map(v=>String(v||"").trim().toUpperCase()).filter(Boolean))];
        if(clean.length===LEGACY_PROJECTS.size&&clean.every(v=>LEGACY_PROJECTS.has(v)))return null;
        return clean;
      }
    }
  }catch(_){}
  return null;
}

export default function ViewBienvenidaProjectFilter(props){
  const [selection,setSelection]=React.useState(readInitialSelection);
  const [selectedDay,setSelectedDay]=React.useState("");
  const [remoteDays,setRemoteDays]=React.useState(null);
  const [remoteSummary,setRemoteSummary]=React.useState(null);
  const [daysRevision,setDaysRevision]=React.useState(0);
  const [portalHost,setPortalHost]=React.useState(null);
  const [open,setOpen]=React.useState(false);
  const controlRef=React.useRef(null);

  const projectValues=React.useMemo(()=>collectProjects(props.rop02All,props.rop05,props.rma15),[props.rop02All,props.rop05,props.rma15]);
  const projectItems=React.useMemo(()=>[{value:"TODOS",label:"Todos"},...projectValues.map(value=>({value,label:projectLabel(value)}))],[projectValues]);
  const selectedValues=React.useMemo(()=>{
    if(selection===null)return projectValues;
    const available=new Set(projectValues);
    const valid=selection.filter(v=>available.has(v));
    return valid.length?valid:projectValues;
  },[selection,projectValues]);
  const allSelected=selection===null||selectedValues.length===projectValues.length;
  const selectedSet=React.useMemo(()=>new Set(selectedValues),[selectedValues]);
  const queryProjects=React.useMemo(()=>allSelected?null:[...selectedValues].sort(),[allSelected,selectedValues]);
  const projectScopeKey=allSelected?"*":queryProjects.join("|");
  const projectFilteredRop02=React.useMemo(()=>{
    const source=Array.isArray(props.rop02All)?props.rop02All:[];
    return allSelected?source:source.filter(row=>selectedSet.has(projectFromRow(row)));
  },[props.rop02All,allSelected,selectedSet]);
  const localAvailableDays=React.useMemo(()=>[...new Set(projectFilteredRop02.map(dateFromRop02Row).filter(Boolean))].sort((a,b)=>b.localeCompare(a)),[projectFilteredRop02]);
  const availableDays=Array.isArray(remoteDays)?remoteDays:localAvailableDays;
  const effectiveDay=selectedDay&&availableDays.includes(selectedDay)?selectedDay:(availableDays[0]||"");
  const dayScopeKey=`${projectScopeKey}|${effectiveDay}`;

  React.useEffect(()=>{try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify(selection===null?"TODOS":selection));}catch(_){}},[selection]);
  React.useEffect(()=>{
    const refresh=()=>setDaysRevision(value=>value+1);
    const id=window.setInterval(refresh,HOME_DAYS_REFRESH_MS);
    const onVisible=()=>{if(!document.hidden)refresh();};
    const onOnline=()=>refresh();
    document.addEventListener("visibilitychange",onVisible);
    window.addEventListener("online",onOnline);
    return()=>{
      window.clearInterval(id);
      document.removeEventListener("visibilitychange",onVisible);
      window.removeEventListener("online",onOnline);
    };
  },[]);
  React.useEffect(()=>{
    let alive=true;
    setRemoteDays(null);
    getHomeRop02AvailableDays(queryProjects,90).then(rows=>{
      if(!alive)return;
      setRemoteDays(rows.map(row=>row.fecha));
    }).catch(()=>{
      if(alive)setRemoteDays(localAvailableDays);
    });
    return()=>{alive=false;};
  },[projectScopeKey,queryProjects,daysRevision,localAvailableDays]);
  React.useEffect(()=>{
    let alive=true;
    if(!effectiveDay){setRemoteSummary(null);return()=>{alive=false;};}
    setRemoteSummary(previous=>previous?.key===dayScopeKey?previous:null);
    getHomeRop02DayRows(effectiveDay,queryProjects).then(rows=>{
      if(alive)setRemoteSummary({key:dayScopeKey,rows});
    }).catch(()=>{
      if(alive)setRemoteSummary({key:dayScopeKey,rows:null,error:true});
    });
    return()=>{alive=false;};
  },[dayScopeKey,effectiveDay,queryProjects]);
  React.useEffect(()=>{
    let frame=0;
    const findHost=()=>{
      const host=document.querySelector(".dm-home-summary > div:first-child");
      if(host){setPortalHost(host);return;}
      frame=window.requestAnimationFrame(findHost);
    };
    findHost();
    return()=>window.cancelAnimationFrame(frame);
  },[]);
  React.useEffect(()=>{
    if(!open)return;
    const close=event=>{if(controlRef.current&&!controlRef.current.contains(event.target))setOpen(false);};
    const onKey=event=>{if(event.key==="Escape")setOpen(false);};
    document.addEventListener("mousedown",close);document.addEventListener("keydown",onKey);
    return()=>{document.removeEventListener("mousedown",close);document.removeEventListener("keydown",onKey);};
  },[open]);

  const filteredProps=React.useMemo(()=>{
    const filterRows=rows=>Array.isArray(rows)?(allSelected?rows:rows.filter(row=>selectedSet.has(projectFromRow(row)))):rows;
    const filteredRma=filterRows(props.rma15);
    const localSummaryRop02=effectiveDay?projectFilteredRop02.filter(row=>dateFromRop02Row(row)===effectiveDay):projectFilteredRop02;
    const liveSummaryRop02=remoteSummary?.key===dayScopeKey&&Array.isArray(remoteSummary.rows)?remoteSummary.rows:null;
    const summaryRop02=liveSummaryRop02??localSummaryRop02;
    const hasDayData=Boolean(effectiveDay)&&(Array.isArray(liveSummaryRop02)||localSummaryRop02.length>0);
    return {
      ...props,
      // El Dashboard embebido necesita el histórico completo del alcance de
      // proyectos seleccionado. El día elegido pertenece sólo al resumen de Inicio.
      rop02All:projectFilteredRop02,
      summaryRop02,
      rop05:filterRows(props.rop05),
      rma15:Array.isArray(filteredRma)&&filteredRma.length?filteredRma:[EMPTY_RMA_SENTINEL],
      summaryDayFiltered:hasDayData,
    };
  },[props,allSelected,selectedSet,projectFilteredRop02,effectiveDay,remoteSummary,dayScopeKey]);

  const toggleProject=value=>{
    setSelectedDay("");
    if(value==="TODOS"){setSelection(null);return;}
    setSelection(current=>{
      const base=current===null?[...projectValues]:[...current];
      if(base.includes(value)){const next=base.filter(item=>item!==value);return next.length?next:base;}
      const next=[...base,value];return next.length>=projectValues.length?null:next;
    });
  };
  const summaryLabel=allSelected?"Todos":projectItems.filter(item=>item.value!=="TODOS"&&selectedSet.has(item.value)).map(item=>item.label).join(" + ");

  const control=portalHost?createPortal(
    <div ref={controlRef} style={{position:"relative",marginLeft:"auto",width:124,maxWidth:"42%",minWidth:0,display:"flex",flexDirection:"column",gap:5,alignItems:"stretch",boxSizing:"border-box"}} onClick={event=>event.stopPropagation()}>
      <button type="button" aria-label="Filtrar resumen general por proyecto" aria-expanded={open} title="Filtrar resumen general por proyecto" onClick={()=>setOpen(value=>!value)} style={{width:"100%",minWidth:0,height:28,padding:"0 8px",boxSizing:"border-box",borderRadius:7,border:"1px solid rgba(255,255,255,.16)",background:"rgba(10,24,36,.92)",color:"#fff",fontSize:10,fontWeight:800,outline:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between",gap:6}}>
        <span style={{overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{summaryLabel||"Todos"}</span><span style={{fontSize:9,opacity:.8,flex:"0 0 auto"}}>▾</span>
      </button>
      <select aria-label="Filtrar resumen general por día" title="Día ROP02 del resumen" value={effectiveDay} onChange={event=>setSelectedDay(event.target.value)} disabled={!availableDays.length} style={{width:"100%",minWidth:0,height:26,padding:"0 7px",boxSizing:"border-box",borderRadius:7,border:"1px solid rgba(255,255,255,.16)",background:"rgba(10,24,36,.92)",color:"#fff",fontSize:9,fontWeight:800,outline:"none",cursor:availableDays.length?"pointer":"default"}}>
        {!availableDays.length&&<option value="">Sin registros</option>}
        {availableDays.map(day=><option key={day} value={day}>{formatDayLabel(day)}</option>)}
      </select>
      {open&&<div style={{position:"absolute",right:0,top:34,zIndex:80,width:178,maxWidth:"min(178px, 80vw)",maxHeight:300,overflowY:"auto",padding:6,boxSizing:"border-box",borderRadius:9,border:"1px solid rgba(255,255,255,.14)",background:"rgba(5,18,29,.98)",boxShadow:"0 16px 36px rgba(0,0,0,.38)",backdropFilter:"blur(14px)",WebkitBackdropFilter:"blur(14px)"}}>
        {projectItems.map(item=>{const checked=item.value==="TODOS"?allSelected:selectedSet.has(item.value);return <label key={item.value} style={{display:"flex",alignItems:"center",gap:8,padding:"7px 8px",borderRadius:6,cursor:"pointer",fontSize:10,fontWeight:800,color:"#e8edf1",background:checked?"rgba(255,255,255,.06)":"transparent"}}><input type="checkbox" checked={checked} onChange={()=>toggleProject(item.value)} style={{margin:0,accentColor:"#ef233c",cursor:"pointer"}}/><span>{item.label}</span></label>;})}
      </div>}
    </div>,portalHost):null;

  return <><ViewBienvenida {...filteredProps}/>{control}</>;
}
