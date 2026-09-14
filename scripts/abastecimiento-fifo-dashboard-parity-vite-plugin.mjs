const normalizeId=id=>String(id||"").replace(/\\/g,"/").split("?")[0];

const DOWNLOAD_RE=/  const raba03DownloadRows=useMemo\(\(\)=>\{[\s\S]*?\n  \},\[sortedRows,remitosByCode,normCode,normalizeCentroCosto,calcularIndicadorRABA03\]\);/;
const DASHBOARD_RE=/  const raba03DashboardRows=useMemo\(\(\)=>\{[\s\S]*?\n  \},\[assignedRows,remitosByCode,normCode,normalizeCentroCosto,calcularIndicadorRABA03\]\);/;
const SAVE_RE=/  const guardarDatosRABA03=useCallback\(async\(\)=>\{[\s\S]*?\n  \},\[rows,toNumber,loadRaba03,normCode,normalizeCentroCosto,remitosByCode\]\);/;
const UNMATCHED_RE=/  const enviosSinSolicitudRows=useMemo\(\(\)=>\{[\s\S]*?\n  \},\[rows,remitos,normCode,toNumber,parseRabaDateMs\]\);/;

const DOWNLOAD=`  const raba03DownloadRows=useMemo(()=>{
    const out=[];
    (sortedRows||[]).forEach(row=>{
      const unique=Array.isArray(row._matchedRemitos)?row._matchedRemitos:[];
      const base={};
      RABA03_EXPORT_COLUMNS.forEach(c=>{base[c.key]=(c.key==="fechaSolicitud"||c.key==="fechaRequerida")?formatDateLocal(row[c.key]):(row[c.key] instanceof Date?formatDateLocal(row[c.key]):(row[c.key]??""));});
      if(unique.length){
        unique.forEach(m=>out.push({
          ...base,
          numeroRemito:m.numero||"",
          fechaSalida:m.fecha||"",
          cantidadRemito:m.cantidad||"",
          indicador:calcularIndicadorRABA03(row.fechaSolicitud,m.fecha)
        }));
      }else{
        out.push({...base,numeroRemito:"",fechaSalida:"",cantidadRemito:"",indicador:""});
      }
    });
    return out;
  },[sortedRows,calcularIndicadorRABA03]);`;

const DASHBOARD=`  const raba03DashboardRows=useMemo(()=>{
    const out=[];
    (assignedRows||[]).forEach(row=>{
      const unique=Array.isArray(row._matchedRemitos)?row._matchedRemitos:[];
      if(unique.length){
        unique.forEach(m=>out.push({
          nSolicitud:row.nSolicitud,
          empresa:row.empresa||"",
          centroCosto:row.centroCosto||"SIN PROYECTO",
          codigoArticulo:row.codigoArticulo||"S/C",
          descripcion:row.descripcion||"",
          cantidadSolicitada:row.cantidadSolicitada||0,
          numeroRemito:m.numero||"",
          fechaSalida:m.fecha||"",
          cantidadRemito:m.cantidad||0,
          indicador:calcularIndicadorRABA03(row.fechaSolicitud,m.fecha)
        }));
      }
    });
    return out;
  },[assignedRows,calcularIndicadorRABA03]);`;

const SAVE=`  const guardarDatosRABA03=useCallback(async()=>{
    const payloadRows=(rows||[])
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
          cantidad:cantidadRemito
        };
      });
    if(!payloadRows.length){
      appAlert("No hay datos para guardar.");
      return;
    }
    try{
      setLoading(true);
      setError(null);
      const json=await updateAbastecimientoRaba03("cant_enviada",payloadRows);
      if(!json?.ok)throw new Error("No se pudieron guardar los datos en RABA03 de Supabase.");
      setSuccessAlert({message:String(Number(json.updatedRows||0))+" filas guardadas en RABA03 base"});
      await loadRaba03();
    }catch(err){
      const msg=err?.message||String(err);
      setError(msg);
      appAlert("Error guardando datos: "+msg);
    }finally{
      setLoading(false);
    }
  },[rows,toNumber,loadRaba03]);`;

const UNMATCHED=`  const enviosSinSolicitudRows=useMemo(()=>{
    const base=(rows||[]).map(r=>({...r,cantidadEnviada:0,cantidadRestante:Math.max(0,toNumber(r.cantidadSolicitada)),_matchedRemitos:[]}));
    return allocateRemitosToRequests(base,remitos).unmatched.sort((a,b)=>{
      const fa=parseChronoDateMs(a.fechaEnvio),fb=parseChronoDateMs(b.fechaEnvio);
      if(fa!==fb)return fb-fa;
      return String(a.codigoArticulo||"").localeCompare(String(b.codigoArticulo||""),"es",{numeric:true,sensitivity:"base"});
    });
  },[rows,remitos,toNumber,allocateRemitosToRequests]);`;

export function abastecimientoFifoDashboardParityVitePlugin(){
  return{
    name:"delta-abastecimiento-fifo-dashboard-parity",
    enforce:"pre",
    transform(code,id){
      const file=normalizeId(id);
      if(!file.endsWith("/src/modules/abastecimiento/AbastecimientoModule.jsx"))return null;
      const required=[[DOWNLOAD_RE,"descarga RABA03"],[DASHBOARD_RE,"dashboard RABA03"],[SAVE_RE,"guardado RABA03"],[UNMATCHED_RE,"envíos sin solicitud"]];
      for(const [re,label] of required){if(!re.test(code))throw new Error(`[abastecimiento-fifo] No se encontró el bloque esperado: ${label}`);}
      let next=code.replace(DOWNLOAD_RE,DOWNLOAD);
      next=next.replace(DASHBOARD_RE,DASHBOARD);
      next=next.replace(SAVE_RE,SAVE);
      next=next.replace(UNMATCHED_RE,UNMATCHED);
      return{code:next,map:null};
    }
  };
}
