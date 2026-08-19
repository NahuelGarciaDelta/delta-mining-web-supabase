const TARGET = '/src/modules/mantenimiento/MantenimientoProgramadoView.jsx'

export function pmVehicleDisplayVitePlugin() {
  return {
    name: 'delta-pm-vehicle-display',
    enforce: 'pre',
    transform(code, id) {
      if (!id.replace(/\\/g, '/').endsWith(TARGET)) return null

      let out = code

      out = out.replace(
        'return { interno, equipo: [familia, marca, modelo].filter(Boolean).join(" — ") || interno, familia, marca, modelo, proyecto, propiedad, codigos };',
        `return {\n    interno,\n    equipo: [familia, marca, modelo].filter(Boolean).join(" — ") || interno,\n    familia, marca, modelo, proyecto, propiedad, codigos,\n    codigoNuevo: text(pick(row, ["Código nuevo", "Codigo nuevo", "CODIGO NUEVO", "Código Nuevo", "Codigo Nuevo", "codigo_nuevo"])),\n    codigoDrusila: text(pick(row, ["Código Drusila", "Codigo Drusila", "Código de Drusila", "Codigo de Drusila", "Código viejo", "Codigo viejo", "Código anterior", "Codigo anterior", "codigo_anterior", "Patente", "PATENTE", "Dominio", "DOMINIO"]))\n  };`
      )

      out = out.replace(
        'if (!key || seen.has(key) || !actividad) return;',
        'if (!key || seen.has(key) || !actividad || isRoadVehicle(e)) return;'
      )

      out = out.replace(
        'const internoFinal = listaMatch?.interno || internoRop;',
        'const internoFinal = internoRop;'
      )

      out = out.replace(
        'const cfg = configMap.get(keyFinal) || {};',
        'const cfg = configMap.get(keyFinal) || configMap.get(norm(listaMatch?.codigoNuevo)) || configMap.get(norm(listaMatch?.interno)) || configMap.get(norm(listaMatch?.codigoDrusila)) || {};'
      )

      out = out.replace(
        'const familiaRop = text(row?._tipo || row?.equipo || \'VEHÍCULO\');',
        `const familiaRop = text(row?._tipo || row?.equipo || 'VEHÍCULO');\n      const patente = text(listaMatch?.codigoDrusila || '');\n      const internoDisplay = patente && norm(patente) !== norm(internoRop) ? \`${'${internoRop} (${patente})'}\` : internoRop;`
      )

      out = out.replace(
        "        interno: internoFinal,\n        equipo: e.equipo || familiaRop || internoFinal,",
        "        interno: internoFinal,\n        internoDisplay,\n        patente,\n        equipo: e.equipo || familiaRop || internoFinal,"
      )

      out = out.replace(
        'const proyectos = useMemo(() => uniq(equipos.map(e => e.proyecto)).sort(), [equipos]);',
        `const displayInterno = row => row?.internoDisplay || row?.interno || '';\n  const proyectos = useMemo(() => uniq(equipos.map(e => e.proyecto)).sort(), [equipos]);`
      )

      out = out.replace(
        '...internos.map(v => ({ value: v, label: v }))',
        '...internos.map(v => ({ value: v, label: displayInterno(equipos.find(e => e.interno === v)) || v }))'
      )

      out = out.split('>{e.interno}</td>').join('>{displayInterno(e)}</td>')
      out = out.split('>{e.interno}</option>').join('>{displayInterno(e)}</option>')
      out = out.split('[x.interno,x.transcurridas').join('[displayInterno(x),x.transcurridas')
      out = out.split('[x.interno,x.proyMax').join('[displayInterno(x),x.proyMax')

      return out === code ? null : { code: out, map: null }
    }
  }
}
