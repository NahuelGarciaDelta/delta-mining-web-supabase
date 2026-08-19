export function tallerCentralNavigationVitePlugin(){
  return {
    name:'delta-taller-central-navigation',
    enforce:'pre',
    transform(code,id){
      let s=code;

      if(id.endsWith('/src/App.jsx')){
        const importAnchor='import { EquipmentProfileView } from "./modules/equipment/index.js";';
        if(s.includes(importAnchor)&&!s.includes('TallerCentralMovementPageSupabase')){
          s=s.replace(importAnchor,`${importAnchor}\nimport TallerCentralMovementPageSupabase from "./modules/taller-central/TallerCentralMovementPageSupabase.jsx";`);
        }

        // Títulos de las nuevas vistas. Se hace por regex para no depender de espacios exactos.
        if(!s.includes('tallerMovimientoSubida:"Subida de equipo"')){
          s=s.replace(/tallerCentral\s*:\s*"Taller Central"\s*,/,m=>`${m}tallerMovimientoSubida:"Subida de equipo",tallerMovimientoBaja:"Bajada de equipo",tallerMovimientoMovilizacion:"Movilización de equipo",tallerMovimientoCambio:"Cambio de equipo",`);
        }

        // Replica directamente la jerarquía de Taller Central de la app original.
        const tallerBlock=/if\(activeModule==="tallerCentral"\)\{\s*return \[\s*\{id:"bienvenida",icon:"home",label:"Bienvenida",type:"item",color:C\.accent\},\s*\{id:"equipmentProfile",icon:"truck",label:"Ficha única del equipo",type:"item",color:C\.teal\},\s*\{id:"tallerCentral",icon:"database",label:"Taller Central",type:"item",color:C\.teal\},\s*\];\s*\}/m;
        const tallerNav=`if(activeModule==="tallerCentral"){
      return [
        {id:"bienvenida",icon:"home",label:"Bienvenida",type:"item",color:C.accent},
        {id:"equipmentProfile",icon:"truck",label:"Ficha única del equipo",type:"item",color:C.teal},
        {id:"tallerCentral",icon:"database",label:"Taller Central",type:"item",color:C.teal},
        {id:"grp_taller_movimientos",icon:"truck",label:"Movimiento de equipos",type:"group",color:C.accent,children:[
          {id:"tallerMovimientoSubida",icon:"truck",label:"Subida"},
          {id:"tallerMovimientoBaja",icon:"warn",label:"Bajada"},
          {id:"tallerMovimientoMovilizacion",icon:"prod",label:"Movilización"},
          {id:"tallerMovimientoCambio",icon:"refresh",label:"Cambio de equipo"},
        ]},
      ];
    }`;
        if(tallerBlock.test(s))s=s.replace(tallerBlock,tallerNav);

        // Render de las cuatro subpestañas usando exclusivamente la implementación Supabase.
        if(!s.includes('<TallerCentralMovementPageSupabase')){
          const renderAnchor='{view==="equipmentProfile"&&<ModuleErrorBoundary name="Ficha única del equipo" onRetry={loadData}><EquipmentProfileView';
          if(s.includes(renderAnchor)){
            const movementRender='{["tallerMovimientoSubida","tallerMovimientoBaja","tallerMovimientoMovilizacion","tallerMovimientoCambio"].includes(view)&&<ModuleErrorBoundary name="Movimiento de equipos" onRetry={loadData}><TallerCentralMovementPageSupabase mode={view==="tallerMovimientoBaja"?"BAJA":view==="tallerMovimientoMovilizacion"?"MOVILIZACION":view==="tallerMovimientoCambio"?"CAMBIO_EQUIPO":"SUBIDA"} listaEquipos={listaEquipos} rop02All={rop02All}/></ModuleErrorBoundary>}\n                ';
            s=s.replace(renderAnchor,movementRender+renderAnchor);
          }
        }
      }

      // Mismo cruce Taller Central -> Atraso que en la aplicación original,
      // pero leyendo los movimientos desde las RPC de Supabase.
      if(id.endsWith('/src/modules/oficina-tecnica/OficinaTecnicaRoute.jsx')){
        if(!s.includes('getTallerMovements} from "../../services/tallerMovements.js"')){
          s=s.replace('import { registerRefreshTask } from "../../services/refreshManager.js";',
            'import { registerRefreshTask } from "../../services/refreshManager.js";\nimport {getTallerMovements} from "../../services/tallerMovements.js";');
        }
        s=s.replace('function buildAtrasoDeps(deps,{readOnly=false}={}){','function buildAtrasoDeps(deps,{readOnly=false,ignoredCodes=new Set()}={}){');
        s=s.replace(
          'const rows=readOnly&&Array.isArray(props?.rows)\n      ? props.rows.filter(row=>!row?.admitido)\n      : props?.rows;',
          'let rows=Array.isArray(props?.rows)?props.rows:props?.rows;\n    if(Array.isArray(rows)&&ignoredCodes?.size){rows=rows.filter(row=>{const raw=row?.equipo||row?.maquina||row?.interno||row?._internoRaw||row?.codigo||"";return !ignoredCodes.has(formatAtrasoEquipmentCode(raw));});}\n    if(readOnly&&Array.isArray(rows))rows=rows.filter(row=>!row?.admitido);'
        );
        if(!s.includes('tallerAtrasoCodes')){
          s=s.replace('const [rop02ViewRevision,setRop02ViewRevision]=useState(0);',
            'const [rop02ViewRevision,setRop02ViewRevision]=useState(0);\n  const [tallerAtrasoCodes,setTallerAtrasoCodes]=useState(()=>new Set());');
          s=s.replace('  // Extiende el modal de Justificar sin duplicar la lógica de Atraso.',
`  useEffect(()=>{
    if(!atrasoView)return;
    let active=true;
    Promise.all(["BAJA","MOVILIZACION","CAMBIO_EQUIPO"].map(t=>getTallerMovements(t).catch(()=>[]))).then(groups=>{
      if(!active)return;
      const codes=new Set();
      groups.flat().forEach(row=>{
        const raw=row?.INTERNO_ORIGEN||row?.interno||row?.INTERNO||"";
        const c=formatAtrasoEquipmentCode(raw);
        if(c)codes.add(c);
      });
      setTallerAtrasoCodes(codes);
    });
    return()=>{active=false;};
  },[atrasoView]);

  // Extiende el modal de Justificar sin duplicar la lógica de Atraso.`);
        }
        s=s.replace('if(atrasoView)nextProps={...nextProps,deps:buildAtrasoDeps(nextProps.deps,{readOnly:readOnlyAtraso})};',
          'if(atrasoView)nextProps={...nextProps,deps:buildAtrasoDeps(nextProps.deps,{readOnly:readOnlyAtraso,ignoredCodes:tallerAtrasoCodes})};');
        s=s.replace('},[props,rop02Equipos,atrasoView,readOnlyAtraso]);','},[props,rop02Equipos,atrasoView,readOnlyAtraso,tallerAtrasoCodes]);');
      }

      if(id.endsWith('/src/modules/oficina-tecnica/OficinaTecnicaModule.jsx')){
        const pattern=/function ViewTallerCentral\(\{listaEquipos=\[\],rop02All=\[\],onReloadLista\}\)\{[\s\S]*?\n\}\n\n\nconst OFFICE_VIEW_NAMES/;
        if(pattern.test(s)){
          const replacement=`function ViewTallerCentral({listaEquipos=[],rop02All=[],onReloadLista}){
  const rows=Array.isArray(listaEquipos)?listaEquipos:[];
  return(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <TallerCentralSummary rows={rows}/>
      {rows.length>0
        ?<ViewListaMaestraEquipos rows={rows} rop02All={rop02All} onReloadLista={onReloadLista}/>
        :<Card><div style={{padding:20,color:C.textMuted}}>Sin equipos cargados en Lista Maestra.</div></Card>}
    </div>
  );
}


const OFFICE_VIEW_NAMES`;
          s=s.replace(pattern,replacement);
        }
      }

      return s===code?null:{code:s,map:null};
    }
  };
}
