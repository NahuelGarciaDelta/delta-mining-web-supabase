const VIEW_TARGET = '/src/modules/mantenimiento/MantenimientoProgramadoView.jsx'
const APP_TARGET = '/src/App.jsx'

export function pmVehicleScopeVitePlugin() {
  return {
    name: 'delta-pm-vehicle-scope',
    enforce: 'pre',
    transform(code, id) {
      const cleanId = id.replace(/\\/g, '/')
      let out = code

      if (cleanId.endsWith(APP_TARGET)) {
        out = out.replace(/\s*\{id:\"pmRepuestos\",icon:\"package\",label:\"Repuestos\"\},?/, '')
        return out === code ? null : { code: out, map: null }
      }

      if (!cleanId.endsWith(VIEW_TARGET)) return null

      out = out.replace(
        'num(pick(row, ["hf", "horometro final", "horómetro final", "km final", "kilometraje final"])),',
        'num(pick(row, ["hf", "horometro final", "horómetro final", "km final", "kilometraje final", "kilometraje", "km", "odometro", "odómetro", "kilometros", "kilómetros", "lectura final"])),')
      out = out.replace(
        'num(pick(row, ["hi", "horometro inicial", "horómetro inicial"])),',
        'num(pick(row, ["hi", "horometro inicial", "horómetro inicial", "km inicial", "kilometraje inicial", "odometro inicial", "odómetro inicial", "lectura inicial"])),')

      out = out.replace(
        'setRealizado(r => ({ ...r, interno: e.target.value, horometro: eq ? String(eq.horometroActual || "") : "" }))',
        'setRealizado(r => ({ ...r, interno: e.target.value, horometro: eq ? String(eq.horometroActual || "") : "", tipoPM: eq && isRoadVehicle(eq) ? "PM 8000" : "PM 250" }))')
      out = out.replace(
        'setRealizado(r => ({ ...r, interno: e.interno, horometro: String(e.horometroActual || "") }))',
        'setRealizado(r => ({ ...r, interno: e.interno, horometro: String(e.horometroActual || ""), tipoPM: isRoadVehicle(e) ? "PM 8000" : "PM 250" }))')

      out = out.replace(',"pmRepuestos"', '')
      out = out.replace(/\n\s*\{tab === \"repuestos\" && <div[\s\S]*?\n\s*<\/div>\}\n\n\s*\{tab === \"gestion\"/, '\n\n    {tab === "gestion"')
      out = out.replace(/<StatCard label=\"Disponibilidad repuestos\"[\s\S]*?\/>/, '')
      out = out.replace('La lista contiene únicamente equipos activos en ROP02 durante los últimos 7 días.', 'La lista contiene únicamente equipos y vehículos con actividad ROP02 dentro del período seleccionado.')

      return out === code ? null : { code: out, map: null }
    }
  }
}
