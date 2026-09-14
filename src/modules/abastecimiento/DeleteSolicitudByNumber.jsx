import React,{useState} from "react";
import {deleteAbastecimientoRaba03Solicitud} from "../../services/abastecimientoSupabase.js";

export default function DeleteSolicitudByNumber({deps={},onDeleted}){
  const {C={},appAlert,appConfirm}=deps;
  const [busy,setBusy]=useState(false);

  const alertUser=(message)=>typeof appAlert==="function"?appAlert(message):window.alert(message);
  const confirmUser=async(message)=>typeof appConfirm==="function"?appConfirm(message):window.confirm(message);

  const handleDelete=async()=>{
    if(busy)return;
    const numero=String(window.prompt("Ingresá el N° de solicitud (columna A) a eliminar. No ingreses el N° de pedido:","")||"").trim();
    if(!numero)return;
    const confirmed=await confirmUser(`¿Eliminar completamente la solicitud N° ${numero}?\n\nSe eliminarán todas las filas de RABA03 que tengan ese N° de solicitud (columna A). El N° de pedido es otro dato distinto. Esta acción no se puede deshacer.`);
    if(!confirmed)return;

    setBusy(true);
    try{
      const json=await deleteAbastecimientoRaba03Solicitud(numero);
      const deletedRows=Number(json?.deletedRows||0);
      if(deletedRows<=0){
        await alertUser(`No se encontró ninguna fila con el N° de solicitud ${numero} en la columna A. Si ${numero} es un N° de pedido, no corresponde a este botón.`);
        return;
      }
      await alertUser(`Solicitud N° ${numero} eliminada correctamente (${deletedRows} fila${deletedRows===1?"":"s"}).`);
      if(typeof onDeleted==="function")onDeleted();
    }catch(error){
      await alertUser(`No se pudo eliminar la solicitud. ${error?.message||error}`);
    }finally{
      setBusy(false);
    }
  };

  return <div style={{display:"flex",justifyContent:"flex-end",margin:"0 0 8px 0"}}>
    <button type="button" onClick={handleDelete} disabled={busy} style={{height:34,borderRadius:9,border:`1px solid ${C.red||"#ff3b3b"}88`,background:`${C.red||"#ff3b3b"}18`,color:C.red||"#ff3b3b",padding:"0 12px",fontSize:12,fontWeight:900,cursor:busy?"wait":"pointer",opacity:busy?0.65:1}}>
      {busy?"Eliminando...":"Eliminar solicitud (N° solicitud)"}
    </button>
  </div>;
}
