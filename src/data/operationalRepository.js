import {requireSupabase} from "../services/supabaseClient.js";

const PAGE_SIZE=250;
const array=value=>Array.isArray(value)?value.map(String).filter(Boolean):(value?[String(value)]:[]);
const exact=(query,column,value)=>{const values=array(value);return values.length?query.in(column,values):query};

function applyCommon(query,p,dateColumn){
  if(p.desde)query=query.gte(dateColumn,p.desde);
  if(p.hasta)query=query.lte(dateColumn,p.hasta);
  query=exact(query,"proyecto",p.proyecto);
  query=exact(query,"interno",p.equipo);
  return query;
}

function rop05Legacy(row={}){
  return {...(row.raw_data||{}),
    "Fecha del Parte Diario":row.fecha,Fecha:row.fecha,Supervisor:row.supervisor,Proyecto:row.proyecto,
    "Codigo Int":row.interno,"Código Interno del Equipo":row.interno,Interno:row.interno,
    "N° de Parte":row.numero_parte,"Tipo Equipo":row.tipo_equipo,Tarea:row.tarea,
    "CANTIDAD DE HS PRODUCTIVAS EFECTIVAS (SOLO CANTIDAD)":row.horas_productivas,
    LARGO:row.largo,ANCHO:row.ancho,PROFUNDIDAD:row.profundidad,
    "CANTIDAD DE PRODUCCIÓN DE LA TAREA REALIZADA (SIN UNIDADES DE MEDIDA)":row.cantidad_produccion,
    "UNIDAD DE PRODUCTIVIDAD":row.unidad,Observaciones:row.observaciones,Mes:row.mes,
  };
}

function rma15Legacy(row={}){
  const legacy={...(row.raw_data||{}),"Fecha de OT":row.fecha_ot,Proyecto:row.proyecto,EQUIPO:row.equipo,
    "CODIGO N° INTERNO":row.interno,"Km / hs":row.km_hs,"TIPO DE MANTENIMIENTO":row.tipo_mantenimiento,
    "¿EQUIPO QUEDO OPERATIVO?":row.equipo_operativo===true?"SI":row.equipo_operativo===false?"NO":"",
    "TURNO EN QUE SE HIZO LA OT":row.turno,"TURNO EN EL QUE SE REALIZO LA INTERVENCION":row.turno,
    "INTERVENCIÓN O REPARACIÓN REALIZADA (Si es PM, especificar cual) LOS SOPLETEOS DE FILTROS VAN EN ESTA SECCION O CUALQUIER SERVICIO QUE SE REALICE)":row.intervencion,
    OBSERVACIONES:row.observaciones,"MAIL AVISADO":row.mail_avisado,_proyectoForzado:row.proyecto};
  for(const item of row.insumos||[]){legacy[`codigo ${item.posicion}`]=item.codigo||"";legacy[`nombre ${item.posicion}`]=item.nombre||"";legacy[`cantidad ${item.posicion}`]=item.cantidad??"";}
  return legacy;
}

const rawLegacy=row=>({...row.raw_data,_sourceDataset:row.source_dataset,_sourceRow:row.source_row});

async function page(table,params,configure,adapt){
  const limit=params.limit==="all"?2000:Math.min(Math.max(Number(params.limit)||PAGE_SIZE,1),2000),offset=Math.max(Number(params.offset)||0,0);
  let query=requireSupabase().from(table).select("*",{count:"exact"});
  query=configure(query,params).range(offset,offset+limit-1);
  const {data,error,count}=await query;if(error)throw new Error(`Supabase ${table}: ${error.message}`);
  const rows=(data||[]).map(adapt),total=Number(count||0),next=offset+rows.length;
  return{ok:true,data:rows,rows:rows.length,total,hasMore:next<total,nextOffset:next<total?next:null,source:"supabase"};
}

const getRop05Chunk=(params={})=>page("rop05",params,(q,p)=>{
  q=applyCommon(q,p,"fecha");q=exact(q,"supervisor",p.supervisor);q=exact(q,"unidad",p.unidad);q=exact(q,"tarea",p.tarea);q=exact(q,"tipo_equipo",p.tipo);
  return q.order(p.sortBy==="maquina"?"interno":"fecha",{ascending:String(p.sortDirection||"desc").toLowerCase()==="asc"}).order("source_row");
},rop05Legacy);

const getRma15Chunk=(params={})=>page("rma15_frontend",params,(q,p)=>{
  q=applyCommon(q,p,"fecha_ot");q=exact(q,"tipo_mantenimiento",p.tipo);return q.order("fecha_ot",{ascending:String(p.sortDirection||"desc").toLowerCase()==="asc"}).order("source_row");
},rma15Legacy);

async function allOrPage(getter,params){
  if(params.limit!=="all")return getter(params);
  const data=[];let offset=0,total=0;
  do{const result=await getter({...params,limit:2000,offset});data.push(...result.data);total=result.total;if(!result.hasMore||!result.data.length)break;offset=result.nextOffset;}while(offset<total);
  return{ok:true,data,rows:data.length,total,hasMore:false,nextOffset:null,source:"supabase"};
}
export const getRop05Page=(params={})=>allOrPage(getRop05Chunk,params);
export const getRma15Page=(params={})=>allOrPage(getRma15Chunk,params);

export const getOperationalSource=async key=>{
  const config={rop05:["rop05",rop05Legacy],rma15_fs:["rma15_frontend",rma15Legacy],rma15_jm:["rma15_frontend",rma15Legacy],lista_equipos:["lista_equipos",rawLegacy],insumos:["insumos",rawLegacy]}[key];
  if(!config)throw new Error(`Fuente tipada no soportada: ${key}`);
  const [tableName,adapt]=config,all=[];
  for(let offset=0;;offset+=1000){let query=requireSupabase().from(tableName).select("*");
    if(key==="rma15_fs")query=query.eq("source_dataset","rma15_fs");
    if(key==="rma15_jm")query=query.eq("source_dataset","rma15_jm");
    query=query.order("source_row").range(offset,offset+999);const {data,error}=await query;if(error)throw new Error(`Supabase ${tableName}: ${error.message}`);
    all.push(...(data||[]));if((data||[]).length<1000)break;
  }
  const latestSync=all.reduce((max,row)=>{const value=new Date(row?.synced_at||0).getTime();return Number.isFinite(value)?Math.max(max,value):max;},0);
  const rows=all.map(adapt);return{ok:true,data:rows,meta:{source:key,rows:rows.length,returnedRows:rows.length,hasMore:false,serverVersion:latestSync||Date.now(),serverTime:new Date(latestSync||Date.now()).toISOString()},source:"supabase"};
};

export async function fetchAllOperationalPages(dataset,params={},onPage=()=>{}){
  const getter=dataset==="rop05"?getRop05Page:getRma15Page;let offset=0,total=0;
  do{const result=await getter({...params,limit:2000,offset});total=result.total;await onPage(result.data,{offset,total,hasMore:result.hasMore});if(!result.hasMore||!result.data.length)break;offset=result.nextOffset;}while(offset<total);
  return{total};
}

export async function getOperationalFacets(dataset,params={}){
  const rpc=dataset==="rop05"?"rop05_facets":"rma15_facets";
  const args=dataset==="rop05"?{p_desde:params.desde||null,p_hasta:params.hasta||null,p_proyectos:array(params.proyecto)||null,p_internos:array(params.equipo)||null,p_supervisores:array(params.supervisor)||null,p_unidades:array(params.unidad)||null,p_tareas:array(params.tarea)||null,p_tipos_equipo:array(params.tipo)||null}:{p_desde:params.desde||null,p_hasta:params.hasta||null,p_proyectos:array(params.proyecto)||null,p_internos:array(params.equipo)||null,p_tipos:array(params.tipo)||null,p_operativos:Array.isArray(params.operativo)?params.operativo:null};
  for(const key of Object.keys(args))if(Array.isArray(args[key])&&!args[key].length)args[key]=null;
  const {data,error}=await requireSupabase().rpc(rpc,args);if(error)throw new Error(`Supabase ${rpc}: ${error.message}`);return data||{};
}

export async function getRma15EquipmentUniverseSupabase(params={}){
  const {data,error}=await requireSupabase().rpc("rma15_equipment_universe",{p_year:Number(params.year)||2026});
  if(error)throw new Error(`Supabase rma15_equipment_universe: ${error.message}`);
  const values=(data||[]).map(row=>row.interno).filter(Boolean);
  return{ok:true,data:values,total:values.length,source:"supabase"};
}

export async function getRma15OpenOtSummarySupabase(){
  const {data,error}=await requireSupabase().rpc("rma15_open_ot_summary",{});
  if(error)throw new Error(`Supabase rma15_open_ot_summary: ${error.message}`);
  return{ok:true,data:data||[],total:(data||[]).length,source:"supabase"};
}
