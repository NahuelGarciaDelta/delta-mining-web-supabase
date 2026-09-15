const normalizeId=id=>String(id||"").replace(/\\/g,"/").split("?")[0];

const DELETE_OLD=`  const deleteRemito=async(id)=>{
    if(!(await appConfirm("¿Eliminar este remito cargado?")))return;
    setRemitos(prev=>prev.filter(r=>r.id!==id));
    try{
      await deleteAbastecimientoRemito(id);
      await loadRemitosCompartidos({silent:false});
    }catch(err){
      console.warn("No se pudo eliminar el remito en la hoja compartida:",err);
    }
  };`;

const DELETE_NEW=`  const deleteRemito=async(id)=>{
    if(!(await appConfirm("¿Eliminar este remito cargado?")))return;
    setActionLoading("Eliminando remito...");
    setError(null);
    try{
      const result=await deleteAbastecimientoRemito(id);
      if(!result?.ok)throw new Error("Supabase no confirmó la eliminación del remito.");
      await loadRemitosCompartidos({silent:false});
      setSuccessAlert({message:"Remito eliminado. La baja quedó registrada para sincronizar con la planilla compartida."});
    }catch(err){
      const msg=err?.message||String(err);
      setError(msg);
      await loadRemitosCompartidos({silent:true}).catch(()=>{});
      await appAlert("No se pudo eliminar el remito. No se ocultó localmente: "+msg);
    }finally{
      setActionLoading("");
    }
  };`;

const NORMALIZE_OLD=`      cantidadSolicitada:solicitada,
      cantidadEnviada:enviada,
      cantidadRestante:restante
    };`;

const NORMALIZE_NEW=`      cantidadSolicitada:solicitada,
      cantidadEnviada:enviada,
      cantidadRestante:restante,
      cantidadEnviadaFuente:toNumber(pick(r,["Cant. Enviada","Cantidad enviada","Cant Enviada"])),
      numeroRemitoFuente:String(pick(r,["Nº Remito","N° Remito","Numero Remito","Número Remito"])||"").trim(),
      fechaSalidaFuente:formatDateLocal(pick(r,["Fecha de salida","Fecha salida"])),
      cantidadRemitoFuente:toNumber(pick(r,["Cantidad"]))
    };`;

const SAVE_RE=/  const guardarDatosRABA03=useCallback\(async\(\)=>\{[\s\S]*?\n  \},\[abastecimientoAllocation\.rows,toNumber,loadRaba03\]\);/;

const SAVE_NEW=`  const guardarDatosRABA03=useCallback(async()=>{
    const sameText=(a,b)=>String(a||"").trim()===String(b||"").trim();
    const payloadRows=(abastecimientoAllocation.rows||[])
      .filter(r=>String(r.nSolicitud||"").trim())
      .map(r=>{
        const unique=Array.isArray(r._matchedRemitos)?r._matchedRemitos:[];
        const numeros=[...new Set(unique.map(m=>String(m.numero||"").trim()).filter(Boolean))];
        const fechas=[...new Set(unique.map(m=>String(m.fecha||"").trim()).filter(Boolean))];
        const cantidadRemito=unique.reduce((acc,m)=>acc+toNumber(m.cantidad),0);
        return {
          nSolicitud:r.nSolicitud,
          cantidadEnviada:toNumber(r.cantidadEnviada),
          numeroRemito:numeros.join(" / "),
          fechaSalida:fechas.join(" / "),
          cantidad:cantidadRemito,
          _changed:toNumber(r.cantidadEnviada)!==toNumber(r.cantidadEnviadaFuente)||
            !sameText(numeros.join(" / "),r.numeroRemitoFuente)||
            !sameText(fechas.join(" / "),r.fechaSalidaFuente)||
            toNumber(cantidadRemito)!==toNumber(r.cantidadRemitoFuente)
        };
      })
      .filter(r=>r._changed)
      .map(({_changed,...r})=>r);
    if(!payloadRows.length){
      setSuccessAlert({message:"RABA03 ya está actualizado. No hay cambios para guardar."});
      return;
    }
    try{
      setActionLoading("Guardando "+payloadRows.length+" cambio"+(payloadRows.length===1?"":"s")+" en RABA03...");
      setError(null);
      const json=await updateAbastecimientoRaba03("cant_enviada",payloadRows);
      if(!json?.ok)throw new Error("No se pudieron guardar los datos en RABA03 de Supabase.");
      setSuccessAlert({message:String(Number(json.updatedRows||0))+" filas actualizadas en RABA03"});
      await loadRaba03();
    }catch(err){
      const msg=err?.message||String(err);
      setError(msg);
      await appAlert("Error guardando datos: "+msg);
    }finally{
      setActionLoading("");
    }
  },[abastecimientoAllocation.rows,toNumber,loadRaba03]);`;

const DELETE_SOLICITUD_HANDLER=`  const deleteSolicitudRABA03=useCallback(async(row)=>{
    const numero=String(row?.numeroSolicitud||"").trim();
    if(!numero){
      await appAlert("La solicitud no tiene N° de solicitud y no puede eliminarse de forma segura.");
      return;
    }
    if(!(await appConfirm("¿Eliminar completamente la solicitud "+numero+"? Esta acción eliminará todas sus filas de RABA03 y se replicará a la planilla compartida.")))return;
    setActionLoading("Eliminando solicitud "+numero+"...");
    setError(null);
    try{
      const result=await deleteAbastecimientoRaba03Solicitud(numero);
      if(!result?.ok)throw new Error("Supabase no confirmó la eliminación de la solicitud.");
      await loadRaba03();
      setSuccessAlert({message:"Solicitud "+numero+" eliminada. La baja quedó en cola para replicarse a Seguimiento Compra."});
    }catch(err){
      const msg=err?.message||String(err);
      setError(msg);
      await loadRaba03().catch(()=>{});
      await appAlert("No se pudo eliminar la solicitud: "+msg);
    }finally{
      setActionLoading("");
    }
  },[appAlert,appConfirm,loadRaba03]);

`;

const DELETE_BUTTON='<button onClick={()=>deleteSolicitudRABA03(r)} style={{border:"1px solid rgba(220,38,38,.6)",background:"transparent",color:C.red,borderRadius:7,padding:"5px 9px",fontSize:10,fontWeight:900,cursor:"pointer",fontFamily:"Inter"}}>Eliminar</button>';

export function abastecimientoWriteReliabilityVitePlugin(){
  return{
    name:"delta-abastecimiento-write-reliability",
    enforce:"pre",
    transform(code,id){
      const file=normalizeId(id);
      if(!file.endsWith("/src/modules/abastecimiento/AbastecimientoModule.jsx"))return null;
      let next=String(code).replace(/\r\n/g,"\n");

      const importOld='import { getAbastecimientoSnapshot, saveAbastecimientoRemito, deleteAbastecimientoRemito, setAbastecimientoEstado, appendAbastecimientoRaba03, updateAbastecimientoRaba03 } from "../../services/abastecimientoSupabase.js";';
      const importNew='import { getAbastecimientoSnapshot, saveAbastecimientoRemito, deleteAbastecimientoRemito, setAbastecimientoEstado, appendAbastecimientoRaba03, updateAbastecimientoRaba03, deleteAbastecimientoRaba03Solicitud } from "../../services/abastecimientoSupabase.js";';
      if(next.includes(importOld))next=next.replace(importOld,importNew);
      else if(!next.includes(importNew))throw new Error("[abastecimiento-write] No se encontró import de abastecimientoSupabase esperado");

      if(next.includes(DELETE_OLD))next=next.replace(DELETE_OLD,DELETE_NEW);
      else if(!next.includes(DELETE_NEW))throw new Error("[abastecimiento-write] No se encontró deleteRemito esperado");

      if(next.includes(NORMALIZE_OLD))next=next.replace(NORMALIZE_OLD,NORMALIZE_NEW);
      else if(!next.includes(NORMALIZE_NEW))throw new Error("[abastecimiento-write] No se encontró normalizeRow esperado");

      if(SAVE_RE.test(next))next=next.replace(SAVE_RE,SAVE_NEW);
      else if(!next.includes('const sameText=(a,b)=>String(a||"").trim()===String(b||"").trim();'))throw new Error("[abastecimiento-write] No se encontró guardarDatosRABA03 esperado");

      if(!next.includes("const deleteSolicitudRABA03=useCallback")){
        const marker="  const renderMainTable=()=>{";
        if(!next.includes(marker))throw new Error("[abastecimiento-write] No se encontró renderMainTable para inyectar eliminar solicitud");
        next=next.replace(marker,DELETE_SOLICITUD_HANDLER+marker);
      }

      if(!next.includes(">Eliminar</button>")){
        const rejectButton=/(<button onClick=\{\(\)=>openRejectSolicitud\(r\)\}[\s\S]*?>Rechazar<\/button>)/;
        if(!rejectButton.test(next))throw new Error("[abastecimiento-write] No se encontró botón Rechazar para agregar Eliminar solicitud");
        next=next.replace(rejectButton,"$1\n                      "+DELETE_BUTTON);
      }

      if(next.indexOf("const assignedRows=useMemo")<next.indexOf("const abastecimientoAllocation=useMemo"))throw new Error("[abastecimiento-write] assignedRows quedó antes de la asignación RABA03");
      return{code:next,map:null};
    }
  };
}
