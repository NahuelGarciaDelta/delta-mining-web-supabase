from pathlib import Path

p=Path('src/App.jsx')
s=p.read_text(encoding='utf-8')

old='import { preloadHistoricalDatasets } from "./services/globalPreload.js";'
new='import { preloadHistoricalDatasets } from "./services/globalPreload.js";\nimport { preloadOperationalSnapshots } from "./services/operationalSupabase.js";'
if old not in s:
    raise SystemExit('No se encontró import preloadHistoricalDatasets')
s=s.replace(old,new,1)

old='''  useEffect(()=>{\n    if(!auth)return;\n    hydrateSourcesFromCache(ALL_APP_PRELOAD_SOURCES).catch(()=>{});\n  },[auth,hydrateSourcesFromCache]);'''
new='''  useEffect(()=>{\n    if(!auth)return;\n    hydrateSourcesFromCache(ALL_APP_PRELOAD_SOURCES).catch(()=>{});\n    // Calienta en paralelo los snapshots de módulos que no forman parte de\n    // VIEW_SOURCES (PM, Stock, Licitaciones y Movimientos). No bloquea la UI.\n    preloadOperationalSnapshots().catch(()=>{});\n  },[auth,hydrateSourcesFromCache]);'''
if old not in s:
    raise SystemExit('No se encontró efecto de hidratación global')
s=s.replace(old,new,1)

replacements={
'''{view==="cambiosTurno"&&(dataHydrated?<ModuleErrorBoundary name="Control de horas mensuales" onRetry={loadData}><ViewCambiosTurno deps={OPERATIONAL_ANALYTICS_DEPS} rop02All={rop02All}/></ModuleErrorBoundary>:<BlockingDataLoader label="Cargando control de horas mensuales..." />)}''':
'''{view==="cambiosTurno"&&<ModuleErrorBoundary name="Control de horas mensuales" onRetry={loadData}><ViewCambiosTurno deps={OPERATIONAL_ANALYTICS_DEPS} rop02All={rop02All}/></ModuleErrorBoundary>}''',
'''{view==="ranking"&&(dataHydrated?<ModuleErrorBoundary name="Ranking de Operarios" onRetry={loadData}><ViewRankingOperarios deps={OPERATIONAL_ANALYTICS_DEPS} rop02All={rop02All} rop05={rop05} extState={stRanking} setExtState={setStRanking}/></ModuleErrorBoundary>:<BlockingDataLoader label="Cargando Ranking..." />)}''':
'''{view==="ranking"&&<ModuleErrorBoundary name="Ranking de Operarios" onRetry={loadData}><ViewRankingOperarios deps={OPERATIONAL_ANALYTICS_DEPS} rop02All={rop02All} rop05={rop05} extState={stRanking} setExtState={setStRanking}/></ModuleErrorBoundary>}''',
'''{view==="mant"&&(viewDataReady?<ModuleErrorBoundary name="Mantenimiento" onRetry={loadData}><MantenimientoRoute mode="mantenimiento" deps={MANTENIMIENTO_DEPS} rma15={rma15} insumos={insumos} usdRate={usdRate} extState={stMant} setExtState={setStMant}/></ModuleErrorBoundary>:<BlockingDataLoader label="Cargando" />)}''':
'''{view==="mant"&&<ModuleErrorBoundary name="Mantenimiento" onRetry={loadData}><MantenimientoRoute mode="mantenimiento" deps={MANTENIMIENTO_DEPS} rma15={rma15} insumos={insumos} usdRate={usdRate} extState={stMant} setExtState={setStMant}/></ModuleErrorBoundary>}''',
'''{view==="distMant"&&(dataHydrated&&rma15.length>0?<ModuleErrorBoundary name="Distribución de mantenimientos" onRetry={loadData}><MantenimientoRoute mode="distribucion" deps={MANTENIMIENTO_DEPS} rma15={rma15}/></ModuleErrorBoundary>:<BlockingDataLoader label="Cargando Distribución de mantenimientos..." />)}''':
'''{view==="distMant"&&<ModuleErrorBoundary name="Distribución de mantenimientos" onRetry={loadData}><MantenimientoRoute mode="distribucion" deps={MANTENIMIENTO_DEPS} rma15={rma15}/></ModuleErrorBoundary>}''',
'''{["pmProgramado","pmDashboard","pmPlanificador","pmProgramacion","pmPanel","pmRealizado","pmRepuestos","pmGestion","pmConfig","pmHistorial"].includes(view)&&(dataHydrated&&listaEquipos.length>0?<ModuleErrorBoundary name="Mantenimiento Programado" onRetry={loadData}><MantenimientoRoute mode="programado" readOnly={!can("edit","MANTENIMIENTO")} deps={MANTENIMIENTO_DEPS} listaEquipos={listaEquipos} rop02All={rop02All} initialTab={({pmProgramado:"dashboard",pmDashboard:"dashboard",pmPlanificador:"planificador",pmProgramacion:"programacion",pmPanel:"panel",pmRealizado:"realizado",pmRepuestos:"repuestos",pmGestion:"gestion",pmConfig:"config",pmHistorial:"historial"})[view]} onTabChange={tab=>navigateToView(({dashboard:"pmDashboard",planificador:"pmPlanificador",programacion:"pmProgramacion",panel:"pmPanel",realizado:"pmRealizado",repuestos:"pmRepuestos",gestion:"pmGestion",config:"pmConfig",historial:"pmHistorial"})[tab]||"pmDashboard")}/></ModuleErrorBoundary>:<BlockingDataLoader label="Cargando Mantenimiento Programado..." />)}''':
'''{["pmProgramado","pmDashboard","pmPlanificador","pmProgramacion","pmPanel","pmRealizado","pmRepuestos","pmGestion","pmConfig","pmHistorial"].includes(view)&&<ModuleErrorBoundary name="Mantenimiento Programado" onRetry={loadData}><MantenimientoRoute mode="programado" readOnly={!can("edit","MANTENIMIENTO")} deps={MANTENIMIENTO_DEPS} listaEquipos={listaEquipos} rop02All={rop02All} initialTab={({pmProgramado:"dashboard",pmDashboard:"dashboard",pmPlanificador:"planificador",pmProgramacion:"programacion",pmPanel:"panel",pmRealizado:"realizado",pmRepuestos:"repuestos",pmGestion:"gestion",pmConfig:"config",pmHistorial:"historial"})[view]} onTabChange={tab=>navigateToView(({dashboard:"pmDashboard",planificador:"pmPlanificador",programacion:"pmProgramacion",panel:"pmPanel",realizado:"pmRealizado",repuestos:"pmRepuestos",gestion:"pmGestion",config:"pmConfig",historial:"pmHistorial"})[tab]||"pmDashboard")}/></ModuleErrorBoundary>}''',
'''{view==="costosMant"&&(dataHydrated&&rma15.length>0?<ModuleErrorBoundary name="Informe de Costos" onRetry={loadData}><InformeCostosRoute readOnly={!can("edit","OFICINA TÉCNICA")} rma15={rma15} rop02={rop02All} insumos={insumos} listaEquipos={listaEquipos} usdRate={usdRate} deps={INFORME_COSTOS_DEPS}/></ModuleErrorBoundary>:<BlockingDataLoader label="Cargando Informe de Costos..." />)}''':
'''{view==="costosMant"&&<ModuleErrorBoundary name="Informe de Costos" onRetry={loadData}><InformeCostosRoute readOnly={!can("edit","OFICINA TÉCNICA")} rma15={rma15} rop02={rop02All} insumos={insumos} listaEquipos={listaEquipos} usdRate={usdRate} deps={INFORME_COSTOS_DEPS}/></ModuleErrorBoundary>}''',
'''{view==="costosUnitarios"&&(dataHydrated&&Object.keys(insumos||{}).length>0?<ModuleErrorBoundary name="Costos Unitarios" onRetry={loadData}><ViewCostosUnitarios deps={COSTOS_UNITARIOS_DEPS} insumos={insumos} rma15={rma15} usdRate={usdRate}/></ModuleErrorBoundary>:<BlockingDataLoader label="Cargando Costos Unitarios..." />)}''':
'''{view==="costosUnitarios"&&<ModuleErrorBoundary name="Costos Unitarios" onRetry={loadData}><ViewCostosUnitarios deps={COSTOS_UNITARIOS_DEPS} insumos={insumos} rma15={rma15} usdRate={usdRate}/></ModuleErrorBoundary>}''',
}
for old,new in replacements.items():
    if old not in s:
        raise SystemExit('No se encontró bloque de ruta esperado: '+old[:80])
    s=s.replace(old,new,1)

p.write_text(s,encoding='utf-8')

# PM no debe bloquear toda la pestaña durante el primer fetch. La vista monta y
# recibe el snapshot cacheado o fresco sin una pantalla completa intermedia.
p=Path('src/modules/mantenimiento/MantenimientoProgramadoView.jsx')
s=p.read_text(encoding='utf-8')
s=s.replace('const [loading, setLoading] = useState(true);','const [loading, setLoading] = useState(false);',1)
s=s.replace('useEffect(() => { load(); }, [load]);','useEffect(() => { load({ silent: true }); }, [load]);',1)
p.write_text(s,encoding='utf-8')

# Stock sigue el mismo patrón: montar la tabla inmediatamente y resolver snapshot
# desde IndexedDB/Supabase sin bloquear la subpestaña completa.
p=Path('src/modules/abastecimiento/stock/useSharedStock.js')
s=p.read_text(encoding='utf-8')
s=s.replace('const[rows,setRows]=useState([]),[meta,setMeta]=useState(null),[loading,setLoading]=useState(true),[phase,setPhase]=useState("");','const[rows,setRows]=useState([]),[meta,setMeta]=useState(null),[loading,setLoading]=useState(false),[phase,setPhase]=useState("");',1)
s=s.replace('useEffect(()=>{load().catch(()=>{});},[load]);','useEffect(()=>{load({silent:true}).catch(()=>{});},[load]);',1)
p.write_text(s,encoding='utf-8')

# Regresión: las rutas principales no deben quedar detrás de loaders de datos.
test=Path('tests/instant-navigation.test.mjs')
test.write_text('''import test from "node:test";\nimport assert from "node:assert/strict";\nimport fs from "node:fs";\n\nconst app=fs.readFileSync("src/App.jsx","utf8");\nconst historical=fs.readFileSync("src/data/historicalDataService.js","utf8");\nconst operational=fs.readFileSync("src/services/operationalSupabase.js","utf8");\n\ntest("las vistas pesadas montan sin esperar dataHydrated o arrays no vacíos",()=>{\n  for(const label of ["Cargando Distribución de mantenimientos","Cargando Mantenimiento Programado","Cargando Informe de Costos","Cargando Costos Unitarios","Cargando Ranking","Cargando control de horas mensuales"]) assert.doesNotMatch(app,new RegExp(label));\n});\n\ntest("consultas históricas devuelven cache y revalidan detrás",()=>{\n  assert.match(historical,/if\(cached\)[\\s\\S]*fetchDatasetPage\(dataset,params\)\.catch/);\n  assert.match(historical,/return cached/);\n});\n\ntest("snapshots operativos usan IndexedDB y preload global",()=>{\n  assert.match(operational,/readCachedSource/);\n  assert.match(operational,/writeCachedSource/);\n  assert.match(operational,/preloadOperationalSnapshots/);\n  assert.match(app,/preloadOperationalSnapshots\(\)\.catch/);\n});\n''',encoding='utf-8')
