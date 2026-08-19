export function atrasoIchcFixesVitePlugin(){
  return {
    name:'delta-atraso-ichc-fixes',
    enforce:'pre',
    transform(code,id){
      let s=code;
      if(id.endsWith('/src/modules/oficina-tecnica/OficinaTecnicaRoute.jsx')){
        s=s.replaceAll('if(Array.isArray(rows)&&ignoredCodes?.size){','if(false&&Array.isArray(rows)&&ignoredCodes?.size){');
      }
      if(id.endsWith('/src/modules/oficina-tecnica/OficinaTecnicaModule.jsx')){
        const oldBlock='const atrasadosAceptados=atrasosFiltrados.filter(r=>r.admitido);\n  const saltosSinCausa=saltosFiltrados.filter(r=>!r.admitido).length;';
        const newBlock='const atrasadosAceptadosBase=atrasosFiltrados.filter(r=>r.admitido);\n  const saltosAceptados=saltosFiltrados.filter(r=>r.admitido);\n  const atrasadosAceptados=[...atrasadosAceptadosBase,...saltosAceptados].sort((a,b)=>String(b.fechaAdmitido||b.ultimaCarga||"").localeCompare(String(a.fechaAdmitido||a.ultimaCarga||"")));\n  const saltosSinCausa=saltosFiltrados.filter(r=>!r.admitido).length;';
        s=s.replaceAll(oldBlock,newBlock);

        // No se crea una variable saltosPendientes compartida porque este módulo
        // contiene más de una vista/bloque de Atraso y los scopes no son idénticos.
        // Filtrar inline evita referencias fuera de scope después de los transforms.
        s=s.replaceAll('Saltos de carga por equipo (${saltosFiltrados.length})','Saltos de carga por equipo (${saltosFiltrados.filter(r=>!r.admitido).length})');
        s=s.replaceAll('Saltos de carga por equipo (${saltosPendientes.length})','Saltos de carga por equipo (${saltosFiltrados.filter(r=>!r.admitido).length})');
        s=s.replaceAll('colsSaltos.filter(c=>c.key!=="accion"),saltosFiltrados,"Saltos_ROP02"','colsSaltos.filter(c=>c.key!=="accion"),saltosFiltrados.filter(r=>!r.admitido),"Saltos_ROP02"');
        s=s.replaceAll('colsSaltos.filter(c=>c.key!=="accion"),saltosPendientes,"Saltos_ROP02"','colsSaltos.filter(c=>c.key!=="accion"),saltosFiltrados.filter(r=>!r.admitido),"Saltos_ROP02"');
        s=s.replaceAll('cols={colsSaltos} rows={saltosFiltrados}','cols={colsSaltos} rows={saltosFiltrados.filter(r=>!r.admitido)}');
        s=s.replaceAll('cols={colsSaltos} rows={saltosPendientes}','cols={colsSaltos} rows={saltosFiltrados.filter(r=>!r.admitido)}');
        s=s.replaceAll(
          '<StatCard icon="prod" label="% Cumplimiento" value={`${totales.pct}%`} sub={totales.pct>=90?"ÓPTIMO":totales.pct>=70?"ATENCIÓN":"CRÍTICO"} color={semPct(totales.pct).color} small/>',
          '<StatCard icon="prod" label="% Cumplimiento" value={`${totales.pctPromedio}%`} sub={totales.pctPromedio>=90?"ÓPTIMO":totales.pctPromedio>=70?"ATENCIÓN":"CRÍTICO"} color={semPct(totales.pctPromedio).color} small/>'
        );
        s=s.replaceAll('const sem=semPct(totales.pct);','const sem=semPct(totales.pctPromedio);');
        s=s.replaceAll('>{totales.pct}%</span>','>{totales.pctPromedio}%</span>');
      }
      return s===code?null:{code:s,map:null};
    }
  };
}
