import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';

const root=process.cwd();
const originalDir=fs.mkdtempSync(path.join(os.tmpdir(),'delta-original-final-'));
const sourceRepo='https://github.com/NahuelGarciaDelta/delta-mining-ops.git';
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const source=p=>fs.readFileSync(path.join(originalDir,p),'utf8');
const write=(p,text)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,text);};
const mustReplace=(text,from,to,label)=>{if(!text.includes(from))throw new Error(`No se encontró patrón ${label}`);return text.replace(from,to);};

execFileSync('git',['clone','--depth=1',sourceRepo,originalDir],{stdio:'inherit'});
const sourceCommit=execFileSync('git',['rev-parse','HEAD'],{cwd:originalDir,encoding:'utf8'}).trim();
console.log('Original HEAD:',sourceCommit);

// 1) Desgaste: misma vista/UX de la original, pero catálogo central 100% Supabase.
{
  let s=source('src/modules/mantenimiento/DesgasteView.jsx');
  s=s.replace('import {APPS_SCRIPT_URL} from "../../config/app.js";\n','import {getWearCatalog,replaceWearCatalog} from "../../services/wearCatalogSupabase.js";\n');
  s=s.replace(/async function postCentralCatalog\(rows\)\{[\s\S]*?\n\}\n\nasync function getCentralCatalog\(\)\{[\s\S]*?\n\}\n\nfunction ArticleUsageTooltip/,
`async function postCentralCatalog(rows){\n  return replaceWearCatalog(rows);\n}\n\nasync function getCentralCatalog(){\n  return getWearCatalog();\n}\n\nfunction ArticleUsageTooltip`);
  if(s.includes('APPS_SCRIPT_URL'))throw new Error('DesgasteView todavía referencia Apps Script');
  write('src/modules/mantenimiento/DesgasteView.jsx',s);
  const wearBridge=source('src/modules/mantenimiento/wearSidebarBridge.js').replace(/\bgetComputedStyle\(/g,'window.getComputedStyle(');
  write('src/modules/mantenimiento/wearSidebarBridge.js',wearBridge);
}

// 2) MantenimientoRoute: merge manual. Conserva universo PM Supabase y agrega Desgaste.
{
  let s=read('src/modules/mantenimiento/MantenimientoRoute.jsx');
  if(!s.includes('DesgasteView')){
    s=mustReplace(s,
      'import {normalizeRMA15} from "../../shared/domain/index.jsx";\n',
      'import {normalizeRMA15} from "../../shared/domain/index.jsx";\nimport DesgasteView from "./DesgasteView.jsx";\nimport {WEAR_FLAG,WEAR_ACTIVE_EVENT,WEAR_CLOSE_EVENT} from "./wearSidebarBridge.js";\n',
      'imports desgaste');
  }
  if(!s.includes('const [wearMode,setWearMode]')){
    s=mustReplace(s,
      '  const [remote,setRemote]=React.useState(null);\n',
      '  const [remote,setRemote]=React.useState(null);\n  const [wearMode,setWearMode]=React.useState(()=>props.mode==="mantenimiento"&&sessionStorage.getItem(WEAR_FLAG)==="desgaste");\n\n  React.useEffect(()=>{\n    const openWear=()=>{if(props.mode==="mantenimiento")setWearMode(true);};\n    const closeWear=()=>setWearMode(false);\n    window.addEventListener(WEAR_ACTIVE_EVENT,openWear);\n    window.addEventListener(WEAR_CLOSE_EVENT,closeWear);\n    return()=>{window.removeEventListener(WEAR_ACTIVE_EVENT,openWear);window.removeEventListener(WEAR_CLOSE_EVENT,closeWear);};\n  },[props.mode]);\n\n  React.useEffect(()=>{\n    if(props.mode!=="mantenimiento"){setWearMode(false);return;}\n    const h=[...document.querySelectorAll(".dm-app-content h1")].find(Boolean);\n    if(h)h.textContent=wearMode?"Desgaste":"Mantenimiento";\n    return()=>{const current=[...document.querySelectorAll(".dm-app-content h1")].find(Boolean);if(current&&current.textContent==="Desgaste")current.textContent="Mantenimiento";};\n  },[wearMode,props.mode]);\n',
      'wear state');
  }
  s=s.replace('if(props.mode!=="mantenimiento"||!hasRemoteFilter){','if(wearMode||props.mode!=="mantenimiento"||!hasRemoteFilter){');
  s=s.replace('},[props.mode,hasRemoteFilter,params,props.insumos]);','},[wearMode,props.mode,hasRemoteFilter,params,props.insumos]);');
  if(!s.includes('return <DesgasteView')){
    s=mustReplace(s,
      '  return (\n    <React.Suspense',
      '  if(props.mode==="mantenimiento"&&wearMode)return <DesgasteView rma15={baseRma15} usdRate={props.usdRate}/>;\n\n  return (\n    <React.Suspense',
      'render desgaste');
  }
  if(!s.includes('buildPmEquipmentUniverse'))throw new Error('Se perdió lógica PM de Supabase');
  write('src/modules/mantenimiento/MantenimientoRoute.jsx',s);

  let idx=read('src/modules/mantenimiento/index.js');
  if(!idx.includes('wearSidebarBridge.js'))idx='import "./wearSidebarBridge.js";\n\n'+idx;
  write('src/modules/mantenimiento/index.js',idx);
}

// 3) Apariencia: UI original + persistencia Supabase. Se preserva authSession de Supabase
// para no acoplar los tests/servicios puros a módulos JSX del navegador.
{
  write('src/components/UserSettingsModal.jsx',source('src/components/UserSettingsModal.jsx'));

  let ua=source('src/services/userAppearance.js');
  ua='import {requireSupabase} from "./supabaseClient.js";\n'+ua;
  ua=ua.replace(/async function postAppearance\([\s\S]*?export async function fileToBackgroundDataUrl/,
`export async function loadCentralAppearance(_url,email){\n  const {data,error}=await requireSupabase().rpc("app_get_user_appearance",{p_email:String(email||"")});\n  if(error)throw error;\n  return normalizeAppearance({...data?.appearance,savedBackgrounds:data?.backgrounds||[]});\n}\nexport async function uploadUserBackground(_url,email,dataUrl,name){\n  const {data,error}=await requireSupabase().rpc("app_upload_user_background",{p_email:String(email||""),p_name:String(name||"Mi fondo"),p_data_url:String(dataUrl||"")});\n  if(error)throw error;\n  return data;\n}\nexport async function saveCentralAppearance(_url,email,prefs){\n  const normalized=normalizeAppearance(prefs);\n  const {data,error}=await requireSupabase().rpc("app_save_user_appearance",{p_email:String(email||""),p_appearance:normalized});\n  if(error)throw error;\n  return normalizeAppearance({...normalized,...data?.appearance,savedBackgrounds:data?.backgrounds||data?.appearance?.savedBackgrounds||normalized.savedBackgrounds});\n}\nexport async function fileToBackgroundDataUrl`);
  ua=ua.replace(/\bcreateImageBitmap\(/g,'window.createImageBitmap(');
  if(ua.includes('action:"save_user_preferences"')||ua.includes('action:"upload_user_background"'))throw new Error('userAppearance conserva transporte Apps Script');
  write('src/services/userAppearance.js',ua);
}

// 4) Login: apariencia actual de la original, autenticación sigue usando el adapter Supabase existente.
{
  let s=source('src/modules/auth/Login.jsx');
  s=s.replace('import {applyAppearance,loadCentralAppearance,readLocalAppearance,writeLocalAppearance} from "../../services/userAppearance.js";\n',
    'import {applyAppearance,loadCentralAppearance,readLocalAppearance,writeLocalAppearance} from "../../services/userAppearance.js";\nimport { authenticateUser } from "../../services/appsScriptApi.js";\n');
  s=s.replace(/  const USUARIOS_FALLBACK=\[[\s\S]*?  const AUTH_TIMEOUT_MS=20000;/,'  const AUTH_TIMEOUT_MS=20000;');
  s=s.replace(/  const usuarioActivo=\(u\)=>\{[\s\S]*?\n  \};\n\n  const cargarUsuariosAutorizados=async\(\)=>\{[\s\S]*?\n  \};\n\n/,'');
  s=s.replace(/  const handleSubmit=async\(\)=>\{[\s\S]*?\n  \};\n\n  return\(/,
`  const handleSubmit=async()=>{\n    if(submitInFlightRef.current)return;\n    const mail=normalizarMail(usuario);\n    if(!mail){showError("Ingresá tu usuario");return;}\n    if(!pass){showError("Ingresá tu contraseña");return;}\n    submitInFlightRef.current=true;setValidando(true);let timeoutId=null;\n    try{\n      const timeoutPromise=new Promise((_,reject)=>{timeoutId=window.setTimeout(()=>reject(Object.assign(new Error("La validación tardó demasiado. Intentá nuevamente."),{code:"AUTH_TIMEOUT"})),AUTH_TIMEOUT_MS);});\n      const json=await Promise.race([authenticateUser(APPS_SCRIPT_URL,mail,pass),timeoutPromise]);\n      if(!json?.ok){showError(json?.error?.message||"Usuario o contraseña incorrectos");return;}\n      const authenticatedUser=buildAuthenticatedUser(json,mail);\n      saveAuthenticatedSession(authenticatedUser,{mustChangePassword:!!json.mustChangePassword,normalizeProject:dmNormalizeAssignedProject});\n      aplicarAparienciaUsuario(mail,{central:true});\n      onLogin(authenticatedUser);\n    }catch(err){console.error("No se pudo validar el acceso",err);showError(err?.code==="AUTH_TIMEOUT"?"La validación tardó demasiado. Intentá nuevamente.":(err?.message||"No se pudo validar el acceso. Revisá la conexión."));}\n    finally{if(timeoutId!==null)window.clearTimeout(timeoutId);submitInFlightRef.current=false;setValidando(false);}\n  };\n\n  return(`);
  if(!s.includes('authenticateUser('))throw new Error('Login no quedó conectado al adapter Supabase');
  write('src/modules/auth/Login.jsx',s);
}

// 5) Ajuste puntual de Ficha Única: eliminar texto duplicado sin alterar su bridge Supabase.
{
  let s=read('src/modules/equipment/EquipmentProfileWithLastRop02.jsx');
  s=s.replace(/const isoDate=value=>\{[\s\S]*?const fmtDate=iso=>[^\n]*\n/,'');
  s=s.replace('      const date=isoDate(row?.fecha);\n      if(!code||!date)continue;\n      const current=latest.get(code);\n      if(!current||date>current.date)latest.set(code,{date,project:String(row?.proyecto||row?.lugar||row?.Proyecto||row?.Lugar||"").trim()});',
`      const raw=String(row?.fecha||"").trim();\n      const iso=raw.match(/^(\\d{4})-(\\d{2})-(\\d{2})/)?.slice(1,4).join("-")||(()=>{const m=raw.match(/^(\\d{1,2})\\/(\\d{1,2})\\/(\\d{4})/);return m?\`${'${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}' }\`:"";})();\n      if(!code||!iso)continue;\n      const current=latest.get(code);\n      if(!current||iso>current.date)latest.set(code,{date:iso,project:String(row?.proyecto||row?.lugar||row?.Proyecto||row?.Lugar||"").trim()});`);
  s=s.replace('  const latestDate=latest?.date||"";\n','');
  s=s.replace(/\n      let node=left\.querySelector\("\[data-dm-last-rop02\]"\);[\s\S]*?if\(node\.textContent!==nextText\)node\.textContent=nextText;\n/,'\n      left.querySelector("[data-dm-last-rop02]")?.remove();\n');
  s=s.replace('  },[latestDate,displayPlace,selectedCode]);','  },[displayPlace,selectedCode]);');
  write('src/modules/equipment/EquipmentProfileWithLastRop02.jsx',s);
}

// 6) Baseline actualizado al HEAD realmente portado. No se toca la capa Supabase.
write('docs/original-parity.json',JSON.stringify({
  sourceRepository:'NahuelGarciaDelta/delta-mining-ops',
  sourceCommit,
  syncedAt:new Date().toISOString(),
  policy:'UI, filtros, pestañas, navegación, cálculos, permisos, vistas y lógica de dominio se mantienen en paridad con la app original. Transporte, lectura, escritura y persistencia remota permanecen Supabase-first.',
  status:'functional-parity-current',
  notes:'Port final manual: Desgaste integrado con catálogo Supabase; MantenimientoRoute conserva universo PM Supabase; apariencia por usuario y fondos persisten vía RPC Supabase; login conserva el adapter Supabase; exportación administrativa y bootstrap permanecen activos.'
},null,2)+'\n');

// El auditor exige igualdad exacta solo para archivos sin adaptación de backend.
write('src/modules/home/ViewBienvenidaProjectFilter.jsx',source('src/modules/home/ViewBienvenidaProjectFilter.jsx'));

console.log('Port funcional final preparado contra',sourceCommit);
