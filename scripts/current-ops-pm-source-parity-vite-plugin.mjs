const PM_TARGET='/src/modules/mantenimiento/MantenimientoProgramadoView.jsx';
const PROFILE_TARGET='/src/modules/equipment/EquipmentProfileView.jsx';
const cleanId=id=>String(id||'').replace(/\\/g,'/').split('?')[0];

function replaceRequired(source,before,after,label){
  if(!source.includes(before))throw new Error(`[current-ops-pm] No se encontró ${label}`);
  return source.replace(before,after);
}

export function currentOpsPmSourceParityVitePlugin(){
  return {
    name:'delta-current-ops-pm-source-parity',
    enforce:'pre',
    transform(code,id){
      const file=cleanId(id);
      if(file.endsWith(PM_TARGET)){
        let out=code;

        if(!out.includes('from "./pmRules.js"')){
          out=replaceRequired(out,
            'import {normalizeROP02} from "../../shared/domain/index.jsx";',
            `import {normalizeROP02} from "../../shared/domain/index.jsx";\nimport {\n  TRUCK_PM_ALERT_FROM_HOURS,\n  TRUCK_PM_INTERVAL_HOURS,\n  TRUCK_PM_OVERDUE_FROM_HOURS,\n  getNextTruckPmHour,\n  hasInconsistentPmReadings,\n  isCanonicalTruckFamily,\n  positiveOr,\n  selectMaintenanceCounter,\n} from "./pmRules.js";`,
            'import de pmRules');
        }

        if(!out.includes('function esCamionPM(equipo)')){
          out=replaceRequired(out,
`function sevenDaysAgoStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 6);
  return d;
}

function equipoFromLista(row) {`,
`function sevenDaysAgoStart() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - 6);
  return d;
}

function esCamionetaPM(equipo) {
  const familia = norm(equipo?.familia || equipo?.tipoEquipo || equipo?.equipo);
  const interno = norm(equipo?.interno);
  return familia.includes("CAMIONETA") || /^CTA\\d+/.test(interno);
}

function esCamionPM(equipo) {
  return isCanonicalTruckFamily(equipo?.familia || equipo?.tipoEquipo || equipo?.equipo || "");
}

function categoriaPM(equipo) {
  return esCamionetaPM(equipo) ? "vehiculos" : "pesados";
}

function equipoFromLista(row) {`,
            'helpers de categoría PM');
        }

        out=replaceRequired(out,
`function ropHoras(row) {
  // Compatibilidad con datos normalizados (\`horometroFinal\`) y datos crudos (\`HF\`).
  return Math.max(
    num(row?.horometroFinal),
    num(row?.horometroInicial),
    num(pick(row, ["hf", "horometro final", "horómetro final", "km final", "kilometraje final"])),
    num(pick(row, ["hi", "horometro inicial", "horómetro inicial"])),
    num(row?.horas),
    num(pick(row, ["horas", "hs"]))
  );
}`,
`function ropHoras(row, esCamion = false) {
  return selectMaintenanceCounter({
    horometerCandidates: [
      row?.horometroFinal, row?.horometroInicial,
      pick(row, ["hf", "horometro final", "horómetro final"]),
      pick(row, ["hi", "horometro inicial", "horómetro inicial"]),
      row?.horas, pick(row, ["horas", "hs"]),
    ],
    mileageCandidates: [
      row?.kilometrajeFinal, row?.kmFinal,
      pick(row, ["km final", "kilometraje final"]),
    ],
  }, { isTruck: esCamion });
}`,
          'contador ROP de PM para camiones');

        out=replaceRequired(out,
`function statusFor(row) {
  const actual = num(row.horometroActual);
  const ultimo = num(row.horometroUltimoPM);
  const transcurridas = ultimo > 0 ? Math.max(0, actual - ultimo) : 0;
  const alerta = num(row.alertaDesde) || DEFAULTS.alertaDesde;
  const atrasado = num(row.atrasadoDesde) || DEFAULTS.atrasadoDesde;
  const intervalo = num(row.intervalo) || DEFAULTS.intervalo;
  let estado = "AL DÍA", color = "ok";
  const margenUrgente = Math.max(20, Math.min(50, atrasado - intervalo));
  if (!ultimo) { estado = "SIN BASE"; color = "muted"; }
  else if (transcurridas >= atrasado) { estado = "PM ATRASADO"; color = "danger"; }
  else if (transcurridas >= intervalo || transcurridas >= atrasado - margenUrgente) { estado = "PM URGENTE"; color = "danger"; }
  else if (transcurridas >= alerta) { estado = "PM PRÓXIMO"; color = "warn"; }
  return {
    ...row,
    transcurridas,
    proximoPM: ultimo ? ultimo + intervalo : 0,
    faltan: ultimo ? Math.max(0, (ultimo + intervalo) - actual) : 0,
    estado,
    color,
  };
}`,
`function statusFor(row) {
  const actual = num(row.horometroActual);
  const ultimo = num(row.horometroUltimoPM);
  const esCamion = Boolean(row.pmEsCamion);
  const intervalo = esCamion ? TRUCK_PM_INTERVAL_HOURS : positiveOr(row.intervalo, DEFAULTS.intervalo);
  const alerta = esCamion ? TRUCK_PM_ALERT_FROM_HOURS : positiveOr(row.alertaDesde, DEFAULTS.alertaDesde);
  const atrasado = esCamion ? TRUCK_PM_OVERDUE_FROM_HOURS : positiveOr(row.atrasadoDesde, DEFAULTS.atrasadoDesde);
  const inconsistente = hasInconsistentPmReadings(actual, ultimo);
  const transcurridas = ultimo > 0 && !inconsistente ? Math.max(0, actual - ultimo) : 0;
  let proximoPM = 0;
  if (ultimo && !inconsistente) proximoPM = esCamion ? getNextTruckPmHour(actual, ultimo) : ultimo + intervalo;
  let estado = "AL DÍA", color = "ok";
  const margenUrgente = Math.max(20, Math.min(50, Math.max(0, atrasado - intervalo)));
  if (!ultimo) { estado = "SIN BASE"; color = "muted"; }
  else if (inconsistente) { estado = "REVISAR DATOS"; color = "danger"; }
  else if (transcurridas >= atrasado) { estado = "PM ATRASADO"; color = "danger"; }
  else if (transcurridas >= intervalo || transcurridas >= atrasado - margenUrgente) { estado = "PM URGENTE"; color = "danger"; }
  else if (transcurridas >= alerta) { estado = "PM PRÓXIMO"; color = "warn"; }
  return {
    ...row, intervalo, alertaDesde: alerta, atrasadoDesde: atrasado,
    unidadMantenimiento: esCamion ? "h" : row.unidadMantenimiento,
    inconsistente, transcurridas, proximoPM,
    faltan: proximoPM ? Math.max(0, proximoPM - actual) : 0,
    estado, color,
  };
}`,
          'status PM actual');

        if(!out.includes('const [usoCategoriaFiltro, setUsoCategoriaFiltro]')){
          out=replaceRequired(out,
`  const [equipoHistorial, setEquipoHistorial] = useState("");
  const [remoteRop02, setRemoteRop02] = useState(null);`,
`  const [equipoHistorial, setEquipoHistorial] = useState("");
  const [usoCategoriaFiltro, setUsoCategoriaFiltro] = useState("pesados");
  const [proximoCategoriaFiltro, setProximoCategoriaFiltro] = useState("pesados");
  const [remoteRop02, setRemoteRop02] = useState(null);`,
            'filtros por categoría PM');
        }

        if(!out.includes('const truckInternos = useMemo')){
          out=replaceRequired(out,
`  const actividad7Dias = useMemo(() => {`,
`  const truckInternos = useMemo(() => {
    const set = new Set();
    (listaEquipos || []).forEach(raw => {
      const e = equipoFromLista(raw);
      const key = norm(e.interno);
      if (key && esCamionPM(e)) set.add(key);
    });
    return set;
  }, [listaEquipos]);

  const actividad7Dias = useMemo(() => {`,
            'set de camiones PM');
        }

        out=replaceRequired(out,'      const horas = ropHoras(row);','      const horas = ropHoras(row, truckInternos.has(key));','uso de horómetro para camiones');
        out=replaceRequired(out,'  }, [rop02All, fechaDesde, fechaHasta]);','  }, [rop02All, fechaDesde, fechaHasta, truckInternos]);','dependencia de camiones PM');

        if(!out.includes('const categoriaPorInterno = useMemo')){
          out=replaceRequired(out,
`  const configMap = useMemo(() => new Map(mergedConfigs.map(c => [norm(c.interno), c])), [mergedConfigs]);
  const equipos = useMemo(() => {`,
`  const configMap = useMemo(() => new Map(mergedConfigs.map(c => [norm(c.interno), c])), [mergedConfigs]);
  const categoriaPorInterno = useMemo(() => {
    const map = new Map();
    (listaEquipos || []).forEach(raw => {
      const e = equipoFromLista(raw);
      const key = norm(e.interno);
      if (key) map.set(key, categoriaPM(e));
    });
    return map;
  }, [listaEquipos]);
  const equipos = useMemo(() => {`,
            'índice categoría por interno');
        }

        out=replaceRequired(out,
`      const cfg = configMap.get(key) || {};
      base.push(statusFor({`,
`      const cfg = configMap.get(key) || {};
      const pmEsCamion = esCamionPM(e);
      base.push(statusFor({`,
          'bandera pmEsCamion');
        out=replaceRequired(out,
`        proyecto: actividad.proyecto || cfg.proyecto || e.proyecto,
        intervalo: num(cfg.intervalo) || DEFAULTS.intervalo,
        alertaDesde: num(cfg.alertaDesde) || DEFAULTS.alertaDesde,
        atrasadoDesde: num(cfg.atrasadoDesde) || DEFAULTS.atrasadoDesde,`,
`        proyecto: actividad.proyecto || cfg.proyecto || e.proyecto,
        pmEsCamion,
        intervalo: pmEsCamion ? TRUCK_PM_INTERVAL_HOURS : positiveOr(cfg.intervalo, DEFAULTS.intervalo),
        alertaDesde: pmEsCamion ? TRUCK_PM_ALERT_FROM_HOURS : positiveOr(cfg.alertaDesde, DEFAULTS.alertaDesde),
        atrasadoDesde: pmEsCamion ? TRUCK_PM_OVERDUE_FROM_HOURS : positiveOr(cfg.atrasadoDesde, DEFAULTS.atrasadoDesde),`,
          'umbrales de camión');
        out=replaceRequired(out,
`    const rank = { "PM ATRASADO": 0, "PM URGENTE": 1, "PM PRÓXIMO": 2, "SIN BASE": 3, "AL DÍA": 4 };`,
`    const rank = { "REVISAR DATOS": 0, "PM ATRASADO": 1, "PM URGENTE": 2, "PM PRÓXIMO": 3, "SIN BASE": 4, "AL DÍA": 5 };`,
          'ranking de estado PM');

        out=replaceRequired(out,
`    const intervalosRealizados = registros.map(r => num(r.horasDesdeUltimoPM || r.intervaloReal || r.horasEntrePM)).filter(v => v > 0);
    const promedioHs = intervalosRealizados.length
      ? Math.round(intervalosRealizados.reduce((a, v) => a + v, 0) / intervalosRealizados.length)
      : (conBase.length ? Math.round(conBase.reduce((a, x) => a + x.transcurridas, 0) / conBase.length) : 0);`,
`    const intervalosRealizados = registros
      .filter(r => categoriaPorInterno.get(norm(r.interno)) === "pesados")
      .map(r => num(r.horasDesdeUltimoPM || r.intervaloReal || r.horasEntrePM))
      .filter(v => v > 0);
    const conBasePesados = conBase.filter(x => categoriaPM(x) === "pesados");
    const promedioHs = intervalosRealizados.length
      ? Math.round(intervalosRealizados.reduce((a, v) => a + v, 0) / intervalosRealizados.length)
      : (conBasePesados.length ? Math.round(conBasePesados.reduce((a, x) => a + x.transcurridas, 0) / conBasePesados.length) : 0);`,
          'promedio PM por pesados');

        out=replaceRequired(out,
`        const min = x.transcurridas + 80;
        const max = x.transcurridas + 120;`,
`        const esVehiculo = categoriaPM(x) === "vehiculos";
        const incrementoMin = esVehiculo ? 250 : 80;
        const incrementoMax = esVehiculo ? 750 : 120;
        const min = x.transcurridas + incrementoMin;
        const max = x.transcurridas + incrementoMax;`,
          'proyección próximo turno');

        out=replaceRequired(out,
`  }, [visibles, registros, mergedConfigs, kpis, C, fechaHasta, mesFiltro, anioFiltro]);

  const actividadDiaria = useMemo(() => {`,
`  }, [visibles, registros, mergedConfigs, kpis, C, fechaHasta, mesFiltro, anioFiltro, categoriaPorInterno]);

  const usoDesdePMFiltrado = useMemo(() => visibles
    .filter(x => x.horometroUltimoPM > 0 && categoriaPM(x) === usoCategoriaFiltro)
    .sort((a, b) => b.transcurridas - a.transcurridas)
    .slice(0, 15), [visibles, usoCategoriaFiltro]);

  const proximoTurnoFiltrado = useMemo(() => dashboard.proximoTurno
    .filter(x => categoriaPM(x) === proximoCategoriaFiltro), [dashboard.proximoTurno, proximoCategoriaFiltro]);

  const actividadDiaria = useMemo(() => {`,
          'filtros visuales por categoría');

        out=replaceRequired(out,
`        <Card title="Horas desde el último PM por equipo"><BarList rows={visibles.filter(x=>x.horometroUltimoPM>0).sort((a,b)=>b.transcurridas-a.transcurridas).slice(0,15).map(x=>[x.interno,x.transcurridas,statusColor[x.estado]])} max={Math.max(1,...visibles.map(x=>x.transcurridas||0))}/></Card>
        <Card title="PM previstos para el próximo turno"><BarList rows={dashboard.proximoTurno.map(x=>[x.interno,x.proyMax,x.riesgo.includes("atrasado")?C?.red:C?.yellow])} max={Math.max(1,...dashboard.proximoTurno.map(x=>x.proyMax))}/></Card>`,
`        <Card title="Uso desde el último PM por equipo">
          <div style={{padding:"10px 12px 0",display:"flex",justifyContent:"flex-end"}}>
            <select value={usoCategoriaFiltro} onChange={e=>setUsoCategoriaFiltro(e.target.value)} style={{...inputStyle,minWidth:180}}>
              <option value="pesados">Equipos pesados</option>
              <option value="vehiculos">Vehículos (camionetas)</option>
            </select>
          </div>
          <BarList rows={usoDesdePMFiltrado.map(x=>[x.interno,x.transcurridas,statusColor[x.estado]])} max={Math.max(1,...usoDesdePMFiltrado.map(x=>x.transcurridas||0))}/>
        </Card>
        <Card title="PM previstos para el próximo turno">
          <div style={{padding:"10px 12px 0",display:"flex",justifyContent:"flex-end"}}>
            <select value={proximoCategoriaFiltro} onChange={e=>setProximoCategoriaFiltro(e.target.value)} style={{...inputStyle,minWidth:180}}>
              <option value="pesados">Equipos pesados</option>
              <option value="vehiculos">Vehículos (camionetas)</option>
            </select>
          </div>
          <BarList rows={proximoTurnoFiltrado.map(x=>[x.interno,x.proyMax,x.riesgo.includes("atrasado")?C?.red:C?.yellow])} max={Math.max(1,...proximoTurnoFiltrado.map(x=>x.proyMax||0))}/>
        </Card>`,
          'cards PM por categoría');

        return {code:out,map:null};
      }

      if(file.endsWith(PROFILE_TARGET)){
        let out=code;
        if(!out.includes('from "../mantenimiento/pmRules.js"')){
          out=replaceRequired(out,
            'import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";',
            'import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar } from "recharts";\nimport { getNextTruckPmHour, hasInconsistentPmReadings, isCanonicalTruckFamily, positiveOr } from "../mantenimiento/pmRules.js";',
            'import PM rules en ficha');
        }

        out=replaceRequired(out,
`  const pmInfo=useMemo(()=>{
    const cfg=pmCfgIndex.get(selectedKey)||{};
    const latestReg=pmReg[0]||null;
    const lastH=Number(latestReg?pick(latestReg,["Horometro","Horómetro","Km / hs"]):pick(cfg,["horometroUltimoPM","Horómetro último PM"]))||0;
    const lastDate=latestReg?pick(latestReg,["Fecha","Fecha PM"]):pick(cfg,["fechaUltimoPM","Fecha último PM"]);
    const interval=Number(pick(cfg,["intervalo","Intervalo"]))||250;
    const next=lastH?lastH+interval:0;
    const since=lastH&&summary.currentH?Math.max(0,summary.currentH-lastH):0;
    const remaining=next&&summary.currentH?next-summary.currentH:null;
    let status="SIN BASE";if(lastH){status=remaining!=null&&remaining<0?"ATRASADO":remaining!=null&&remaining<=50?"PRÓXIMO":"AL DÍA";}
    return{lastH,lastDate,interval,next,since,remaining,status};
  },[pmCfgIndex,selectedKey,pmReg,summary.currentH]);`,
`  const pmInfo=useMemo(()=>{
    const cfg=pmCfgIndex.get(selectedKey)||{};
    const latestReg=pmReg[0]||null;
    const lastH=Number(latestReg?pick(latestReg,["Horometro","Horómetro","Km / hs"]):pick(cfg,["horometroUltimoPM","Horómetro último PM"]))||0;
    const lastDate=latestReg?pick(latestReg,["Fecha","Fecha PM"]):pick(cfg,["fechaUltimoPM","Fecha último PM"]);
    const latestOp=op[op.length-1]||{};
    const currentH=Number(latestOp.horometroFinal??latestOp.hf??latestOp.horometro??0)||0;
    const isTruck=isCanonicalTruckFamily(pick(master||{},["Familia","Tipo","Equipo"]));
    const interval=isTruck?500:positiveOr(pick(cfg,["intervalo","Intervalo"]),250);
    const inconsistent=hasInconsistentPmReadings(currentH,lastH);
    const next=lastH&&!inconsistent?(isTruck?getNextTruckPmHour(currentH,lastH):lastH+interval):0;
    const since=lastH&&currentH&&!inconsistent?Math.max(0,currentH-lastH):0;
    const remaining=next&&currentH?next-currentH:null;
    let status="SIN BASE";
    if(inconsistent)status="REVISAR DATOS";
    else if(lastH)status=remaining!=null&&remaining<0?"ATRASADO":remaining!=null&&remaining<=Math.min(100,interval*.2)?"PRÓXIMO":"AL DÍA";
    return{lastH,lastDate,interval,next,since,remaining,status,currentH,isTruck,inconsistent,latestOp};
  },[pmCfgIndex,selectedKey,pmReg,op,master]);`,
          'cálculo PM de ficha');

        out=replaceRequired(out,
`{compactMetric("Horómetro actual",summary.currentH?\`${'${fmt(summary.currentH)}'} h\`:"—",C.blue,"Último horómetro final registrado en ROP02.",summary.lastOp?.fecha?\`Última lectura: ${'${shortDate(summary.lastOp.fecha)}'}\`:undefined,"hours")}`,
`{compactMetric("Horómetro actual",pmInfo.currentH?\`${'${fmt(pmInfo.currentH)}'} h\`:"—",pmInfo.inconsistent?C.red:C.blue,"Último horómetro final real registrado en ROP02, independiente del filtro visual.",pmInfo.latestOp?.fecha?\`Última lectura: ${'${shortDate(pmInfo.latestOp.fecha)}'}\`:undefined,"hours")}`,
          'horómetro actual de ficha');

        out=replaceRequired(out,
`{dataRow("Estado",pmInfo.status,pmInfo.status==="ATRASADO"?C.red:pmInfo.status==="PRÓXIMO"?C.yellow:C.green)}`,
`{dataRow("Estado",pmInfo.status,pmInfo.status==="ATRASADO"||pmInfo.status==="REVISAR DATOS"?C.red:pmInfo.status==="PRÓXIMO"?C.yellow:C.green)}`,
          'color estado PM de ficha');

        return {code:out,map:null};
      }
      return null;
    }
  };
}
