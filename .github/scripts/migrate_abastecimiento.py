from pathlib import Path
import re

p=Path('src/modules/abastecimiento/AbastecimientoModule.jsx')
s=p.read_text(encoding='utf-8')

anchor='import { readCachedSource, writeCachedSource } from "../../services/appCache.js";'
imp='import { getAbastecimientoSnapshot, saveAbastecimientoRemito, setAbastecimientoEstado, appendAbastecimientoRaba03 } from "../../services/abastecimientoSupabase.js";'
if imp not in s:
    if anchor not in s: raise SystemExit('appCache import anchor missing')
    s=s.replace(anchor,anchor+'\n'+imp,1)

old='''      const res=await fetchAbastecimiento(`${APPS_SCRIPT_URL}?action=estados_solicitudes&force=1&_=${Date.now()}`,{cache:"no-store",redirect:"follow"});
      if(!res.ok)throw new Error(`Error HTTP ${res.status}`);
      const json=await res.json();
      if(!json.ok)throw new Error(json?.error?.message||"No se pudieron leer los estados compartidos.");'''
new='''      const json=await getAbastecimientoSnapshot();
      if(!json?.ok)throw new Error("No se pudieron leer los estados compartidos desde Supabase.");'''
if old not in s: raise SystemExit('estados GET block missing')
s=s.replace(old,new,1)
s=s.replace('(json.data||[]).forEach(r=>{','(json.estados||[]).forEach(r=>{',1)

old='''      const url=`${APPS_SCRIPT_URL}?action=remitos_cargados&limit=all&force=1&_=${Date.now()}`;
      const res=await fetchAbastecimiento(url,{method:"GET",cache:"no-store",redirect:"follow"});
      if(!res.ok)throw new Error(`Error HTTP ${res.status}`);
      const json=await res.json();
      if(!json.ok)throw new Error(json?.error?.message||"No se pudieron leer los remitos cargados.");
      const shared=buildRemitosCompartidos(json.data||[]);'''
new='''      const json=await getAbastecimientoSnapshot();
      if(!json?.ok)throw new Error("No se pudieron leer los remitos cargados desde Supabase.");
      const shared=buildRemitosCompartidos(json.remitos||[]);'''
if old not in s: raise SystemExit('remitos GET block missing')
s=s.replace(old,new,1)

old='''      const url=`${APPS_SCRIPT_URL}?action=raba03&limit=all&_=${Date.now()}`;
      const res=await fetchAbastecimiento(url,{cache:"no-store"});
      if(!res.ok)throw new Error(`Error HTTP ${res.status}`);
      const json=await res.json();
      if(!json.ok)throw new Error(json?.error?.message||"No se pudo leer RABA03");
      const raw=Array.isArray(json.data)?json.data:(Array.isArray(json?.sources?.raba03?.data)?json.sources.raba03.data:[]);'''
new='''      const json=await getAbastecimientoSnapshot();
      if(!json?.ok)throw new Error("No se pudo leer RABA03 desde Supabase");
      const raw=Array.isArray(json.raba03)?json.raba03:[];'''
if old not in s: raise SystemExit('RABA03 GET block missing')
s=s.replace(old,new,1)

pattern=r'''  const saveRemitoCompartido=useCallback\(async\(remito\)=>\{.*?\n  \},\[\]\);'''
repl='''  const saveRemitoCompartido=useCallback(async(remito)=>{
    const payload={...remito,usuarioCarga:sessionStorage.getItem("dm_user")||"APP"};
    return saveAbastecimientoRemito(payload);
  },[]);'''
s,n=re.subn(pattern,repl,s,count=1,flags=re.S)
if n!=1: raise SystemExit(f'saveRemito callback replacements={n}')

pattern=r'''  const postEstadoSolicitud=useCallback\(async\(action,payload=\{\}\)=>\{.*?\n  \},\[\]\);'''
repl='''  const postEstadoSolicitud=useCallback(async(action,payload={})=>{
    if(action==="delete_estados_solicitudes_bulk"){
      const claves=Array.isArray(payload.claves)?payload.claves:[];
      await Promise.all(claves.map(clave=>setAbastecimientoEstado({action:"delete_estado_solicitud",clave})));
      return {ok:true,deleted:claves.length};
    }
    return setAbastecimientoEstado({action,...payload});
  },[]);'''
s,n=re.subn(pattern,repl,s,count=1,flags=re.S)
if n!=1: raise SystemExit(f'postEstado callback replacements={n}')

pattern=r'''      const res=await fetch\(APPS_SCRIPT_URL,\{\n        method:"POST",\n        body:new URLSearchParams\(\{payload:JSON.stringify\(\{action:"add_raba03_rows_append_only",rows:rowsToSend\}\)\}\)\.toString\(\)\n      \}\);\n      const json=await res\.json\(\);\n      if\(!json\.ok\)throw new Error\(json\?\.error\?\.message\|\|"No se pudieron cargar las solicitudes en RABA03\."\);'''
repl='''      const json=await appendAbastecimientoRaba03(rowsToSend);
      if(!json?.ok)throw new Error("No se pudieron cargar las solicitudes en RABA03 de Supabase.");'''
s,n=re.subn(pattern,repl,s,count=1,flags=re.S)
if n!=1: raise SystemExit(f'RABA append replacements={n}')

p.write_text(s,encoding='utf-8')

t=Path('tests/abastecimiento-regression.test.mjs')
ts=t.read_text(encoding='utf-8')
guard='''\ntest("Abastecimiento usa Supabase para RABA03, remitos y estados compartidos", () => {\n  assert.match(moduleSource, /getAbastecimientoSnapshot/);\n  assert.match(moduleSource, /saveAbastecimientoRemito/);\n  assert.match(moduleSource, /setAbastecimientoEstado/);\n  assert.match(moduleSource, /appendAbastecimientoRaba03/);\n  assert.doesNotMatch(moduleSource, /action=remitos_cargados/);\n  assert.doesNotMatch(moduleSource, /action=raba03&limit=all/);\n  assert.doesNotMatch(moduleSource, /action=estados_solicitudes/);\n});\n'''
if 'Abastecimiento usa Supabase para RABA03' not in ts:
    t.write_text(ts+guard,encoding='utf-8')
