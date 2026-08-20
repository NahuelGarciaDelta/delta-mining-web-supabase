// one-off: sincroniza la app Supabase con el último main de delta-mining-ops.
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';

execFileSync(process.execPath,['scripts/port-original-parity.mjs'],{stdio:'inherit'});

const path='src/modules/abastecimiento/AbastecimientoModule.jsx';
let s=fs.readFileSync(path,'utf8');
const replaceOnce=(from,to)=>{
  if(s.includes(to))return;
  if(!s.includes(from))throw new Error(`No se encontró patrón de Abastecimiento: ${from.slice(0,120)}`);
  s=s.replace(from,to);
};

replaceOnce(
  'const progressiveMainRows=useProgressiveRows(sortedRows,{resetKey:tab});',
  'const progressiveMainRows=useProgressiveRows(sortedRows,{resetKey:tab,initialLimit:100,increment:100});'
);
replaceOnce('>Mostrar 250 más</button>','>Mostrar 100 más</button>');

const rabaAnchor='  },[sortedRows,remitosByCode,normCode,normalizeCentroCosto,calcularIndicadorRABA03]);\n\n  const raba03DashboardRows=useMemo(()=>{';
const rabaInsert='  },[sortedRows,remitosByCode,normCode,normalizeCentroCosto,calcularIndicadorRABA03]);\n  const progressiveRaba03Rows=useProgressiveRows(raba03DownloadRows,{resetKey:`raba03-${rabaFilterMode}-${rabaDate}-${rabaDateFrom}-${rabaDateTo}-${project}-${company}-${supervisor}-${query}`,initialLimit:100,increment:100});\n\n  const raba03DashboardRows=useMemo(()=>{';
if(!s.includes('const progressiveRaba03Rows=useProgressiveRows('))replaceOnce(rabaAnchor,rabaInsert);
replaceOnce('{raba03DownloadRows.length?raba03DownloadRows.map((r,idx)=>(', '{progressiveRaba03Rows.totalCount?progressiveRaba03Rows.visibleRows.map((r,idx)=>(');
replaceOnce(
  '<div style={{padding:"10px 12px",fontSize:11,color:C.textSub,borderTop:`1px solid ${C.border}22`}}>{fmtNum(raba03DownloadRows.length)} filas listas para descargar</div>',
  '<div style={{padding:"10px 12px",fontSize:11,color:C.textSub,borderTop:`1px solid ${C.border}22`,display:"flex",alignItems:"center",justifyContent:"center",gap:10,flexWrap:"wrap"}}><span>Mostrando {fmtNum(progressiveRaba03Rows.visibleCount)} de {fmtNum(progressiveRaba03Rows.totalCount)} registros · {fmtNum(raba03DownloadRows.length)} filas listas para descargar</span>{progressiveRaba03Rows.hasMore&&<button type="button" onClick={progressiveRaba03Rows.showMore} style={{height:30,border:`1px solid ${C.blue}55`,background:C.blueDim,color:C.blue,borderRadius:8,padding:"0 10px",fontSize:11,fontWeight:900,cursor:"pointer"}}>Mostrar 100 más</button>}</div>'
);

const remitosAnchor='  const filteredRemitos=useMemo(()=>{\n    const q=norm(remitoSearch);\n    if(!q)return remitos;\n    return (remitos||[]).filter(rem=>norm(rem.comprobante).includes(q));\n  },[remitos,remitoSearch,norm]);';
if(!s.includes('const progressiveRemitos=useProgressiveRows('))replaceOnce(remitosAnchor,remitosAnchor+'\n  const progressiveRemitos=useProgressiveRows(filteredRemitos,{resetKey:`remitos-${remitoSearch}`,initialLimit:100,increment:100});');
replaceOnce('{filteredRemitos.length?filteredRemitos.map(rem=>(', '{progressiveRemitos.totalCount?progressiveRemitos.visibleRows.map(rem=>(');
const remitosFooterOld='        )):(\n          <div style={{padding:18,color:C.textSub,fontWeight:700}}>{remitos.length?"No hay remitos que coincidan con la búsqueda.":"Todavía no hay remitos cargados."}</div>\n        )}\n      </div>';
const remitosFooterNew='        )):(\n          <div style={{padding:18,color:C.textSub,fontWeight:700}}>{remitos.length?"No hay remitos que coincidan con la búsqueda.":"Todavía no hay remitos cargados."}</div>\n        )}\n        {progressiveRemitos.totalCount>0&&<div style={{padding:"10px 12px",fontSize:11,color:C.textSub,borderTop:`1px solid ${C.border}22`,display:"flex",alignItems:"center",justifyContent:"center",gap:10}}><span>Mostrando {fmtNum(progressiveRemitos.visibleCount)} de {fmtNum(progressiveRemitos.totalCount)} remitos</span>{progressiveRemitos.hasMore&&<button type="button" onClick={progressiveRemitos.showMore} style={{height:30,border:`1px solid ${C.blue}55`,background:C.blueDim,color:C.blue,borderRadius:8,padding:"0 10px",fontSize:11,fontWeight:900,cursor:"pointer"}}>Mostrar 100 más</button>}</div>}\n      </div>';
if(!s.includes('Mostrando {fmtNum(progressiveRemitos.visibleCount)}'))replaceOnce(remitosFooterOld,remitosFooterNew);

fs.writeFileSync(path,s,'utf8');
console.log('Sincronización visual/funcional aplicada; adaptadores Supabase preservados.');
