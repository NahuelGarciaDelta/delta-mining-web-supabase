/*
 * RABA03 Supabase -> Google Sheets outbox adapter.
 * Add this file to the App Delta Apps Script project together with the versioned backend.
 * Run INSTALAR_DELTA_SUPABASE_V2() once after adding the file. It replaces only
 * the periodic Supabase trigger; the existing Sheet change triggers remain intact.
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

  var values = sheet.getRange(headerRow + 1, 1, lastRow - headerRow, 1).getDisplayValues();
  var rowsToDelete = [];
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || "").trim() === numeroSolicitud) rowsToDelete.push(headerRow + 1 + i);
  }

  rowsToDelete.sort(function(a, b) { return b - a; });
  rowsToDelete.forEach(function(rowNumber) { sheet.deleteRow(rowNumber); });
  SpreadsheetApp.flush();
  try { bumpDatasetVersion_("raba03", true); } catch (_) {}
  return { ok: true, deletedRows: rowsToDelete.length, numeroSolicitud: numeroSolicitud };
}

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

function deltaApplyOutboxEventV2_(event) {
  var domain = String((event && event.domain) || "").toLowerCase().trim();
  if (domain === "raba03" || domain === "estados_solicitudes" || domain === "abastecimiento_estados") {
    return deltaApplyAbastecimientoOutboxCompat_(event);
  }
  return deltaApplyOutboxEvent_(event);
}

function syncSupabaseOutboxToSheetsV2_() {
  var events = deltaSupabaseRpc_("app_sync_outbox_pull", { p_limit: 100 }) || [];
  var acked = [];
  var errors = [];
  (events || []).forEach(function(event) {
    try {
      deltaApplyOutboxEventV2_(event);
      acked.push(Number(event.id));
    } catch (err) {
      var message = String((err && err.message) || err || "Error desconocido");
      errors.push({ id: event.id, domain: event.domain, error: message });
      try { deltaSupabaseRpc_("app_sync_outbox_fail", { p_id: Number(event.id), p_error: message }); } catch (_) {}
    }
  });
  if (acked.length) deltaSupabaseRpc_("app_sync_outbox_ack", { p_ids: acked });
  SpreadsheetApp.flush();
  return { ok: errors.length === 0, processed: events.length, acked: acked.length, errors: errors };
}

function sincronizarDeltaConSupabaseCada5MinV2() {
  var pull = deltaSafeRun_(syncSupabaseOutboxToSheetsV2_);
  var push = syncAllConfiguredDatasetsToSupabase();
  var at = new Date().toISOString();
  var datasets = deltaStoreSyncAudit_(push.results, at);
  PropertiesService.getScriptProperties().setProperty("DELTA_SUPABASE_LAST_SYNC", at);
  return { ok: pull.ok !== false && push.ok !== false, pull: pull, push: push, datasets: datasets, at: at };
}

function INSTALAR_DELTA_SUPABASE_V2() {
  var oldHandler = "sincronizarDeltaConSupabaseCada5Min";
  var newHandler = "sincronizarDeltaConSupabaseCada5MinV2";
  ScriptApp.getProjectTriggers().forEach(function(trigger) {
    var handler = trigger.getHandlerFunction();
    if (handler === oldHandler || handler === newHandler) ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger(newHandler).timeBased().everyMinutes(5).create();
  try { setupSyncTriggers_(); } catch (error) { console.error("No se pudieron instalar triggers de versión: " + error.message); }
  return estadoSincronizacionSupabaseV2();
}

function estadoSincronizacionSupabaseV2() {
  var base = estadoSincronizacionSupabase();
  base.outboxHandler = "sincronizarDeltaConSupabaseCada5MinV2";
  base.triggers = ScriptApp.getProjectTriggers().filter(function(trigger) {
    return trigger.getHandlerFunction() === "sincronizarDeltaConSupabaseCada5MinV2";
  }).map(function(trigger) { return { handler: trigger.getHandlerFunction(), event: String(trigger.getEventType()) }; });
  return base;
}
