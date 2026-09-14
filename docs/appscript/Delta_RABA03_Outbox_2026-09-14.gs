/*
 * RABA03 Supabase -> Google Sheets outbox adapter.
 * Add this file to the App Delta Apps Script project together with the versioned backend.
 * The main deltaApplyOutboxEvent_ dispatcher must delegate domain === "raba03" here.
 */
function deltaApplyRaba03OutboxEvent_(event) {
  event = event || {};
  var payload = event.payload || {};
  var operation = String(event.operation || "").toLowerCase().trim();

  if (operation === "append") {
    return handleAddRABA03Rows_APPEND_ONLY_(payload.rows || []);
  }

  if (operation === "cant_enviada" || operation === "update_cant_enviada") {
    return handleSaveRABA03CantEnviada_(payload.rows || []);
  }

  if (operation === "codigos" || operation === "update_codigos") {
    return handleSaveRABA03Codigos_(payload.rows || []);
  }

  if (operation === "delete_solicitud" || operation === "delete") {
    return deltaDeleteRaba03SolicitudFromSheet_(payload);
  }

  throw new Error("Operación RABA03 de outbox no implementada: " + operation);
}

function deltaDeleteRaba03SolicitudFromSheet_(payload) {
  payload = payload || {};
  var numeroSolicitud = String(payload.numeroSolicitud || "").trim();
  if (!numeroSolicitud) throw new Error("N° de solicitud requerido para eliminar RABA03.");

  var cfg = SHEETS_CONFIG.raba03;
  if (!cfg) throw new Error("No existe SHEETS_CONFIG.raba03.");
  var ss = SpreadsheetApp.openById(cfg.id);
  var sheet = ss.getSheetByName(cfg.sheet);
  if (!sheet) throw new Error("No existe la hoja RABA03: " + cfg.sheet);

  var headerRow = Number(cfg.headerRow || 6);
  var lastRow = sheet.getLastRow();
  if (lastRow <= headerRow) return { ok: true, deletedRows: 0, numeroSolicitud: numeroSolicitud };

  // La columna A es N° de solicitud en OPS. Se lee como texto para preservar
  // exactamente la semántica visible de la planilla.
  var values = sheet.getRange(headerRow + 1, 1, lastRow - headerRow, 1).getDisplayValues();
  var rowsToDelete = [];
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || "").trim() === numeroSolicitud) rowsToDelete.push(headerRow + 1 + i);
  }

  // Borrar de abajo hacia arriba conserva los números de fila aún no procesados.
  rowsToDelete.sort(function(a, b) { return b - a; });
  rowsToDelete.forEach(function(rowNumber) { sheet.deleteRow(rowNumber); });
  SpreadsheetApp.flush();

  try { bumpDatasetVersion_("raba03", true); } catch (_) {}
  return { ok: true, deletedRows: rowsToDelete.length, numeroSolicitud: numeroSolicitud };
}

/*
 * Compatibilidad de dominio: versiones anteriores de Supabase generaron
 * "estados_solicitudes" mientras el dispatcher base esperaba
 * "abastecimiento_estados". Esta función normaliza ambos nombres.
 */
function deltaApplyAbastecimientoOutboxCompat_(event) {
  event = event || {};
  var domain = String(event.domain || "").toLowerCase().trim();
  var op = String(event.operation || "").toLowerCase().trim();
  var payload = event.payload || {};

  if (domain === "raba03") return deltaApplyRaba03OutboxEvent_(event);
  if (domain === "estados_solicitudes" || domain === "abastecimiento_estados") {
    if (op === "delete") return handleDeleteEstadoSolicitud_(event.record_key || payload.clave);
    return handleSaveEstadoSolicitud_(payload);
  }
  return null;
}
